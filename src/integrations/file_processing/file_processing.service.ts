import { downloadFile } from '../../services/file-downloader.service';
import { ContentFile } from '../../models/ContentFile';
import { Storage } from '@google-cloud/storage';
import path from 'path';
import mongoose from 'mongoose';
import xlsx from 'node-xlsx';

export interface ProcessFileRequest {
  url: string;
  fileType?: 'text' | 'excel';
}

export interface ProcessFileResponse {
  content: string;
  mimeType?: string;
  size: number;
  metadata?: {
    totalSheets?: number;
    totalRows?: number;
  };
}

/**
 * Processes a file from a URL and returns its content.
 * @param companyId The ID of the company
 * @param request The processing request containing the file URL and type
 * @returns A promise that resolves to an object indicating success or failure, with file content if successful.
 */
export const processFile = async (
  companyId: string,
  request: ProcessFileRequest,
): Promise<{
  success: boolean;
  data?: ProcessFileResponse;
  error?: string;
}> => {
  try {
    if (!request.url) {
      throw new Error('URL is required');
    }

    let fileBuffer: Buffer;
    let filename = request.url;

    // Check if it's a sandbox URL or plain filename (not a valid HTTP URL)
    const isHttpUrl = request.url.startsWith('http://') || request.url.startsWith('https://');
    const isSandboxUrl = request.url.startsWith('sandbox:');
    
    if (!isHttpUrl) {
      // Treat as sandbox file (either sandbox: prefix or plain filename)
      let searchFilename = request.url;
      
      // Remove sandbox: prefix if present
      if (isSandboxUrl) {
        searchFilename = request.url.substring('sandbox:'.length);
      }
      
      // Remove leading slash if present
      searchFilename = searchFilename.replace(/^\//, '');
      
      // Try to find the file by title/filename
      const file = await ContentFile.findOne({
        companyId: new mongoose.Types.ObjectId(companyId),
        $or: [
          { title: searchFilename },
          { filename: searchFilename }
        ]
      });

      if (!file) {
        throw new Error(`File not found: ${searchFilename}`);
      }

      // Download the file buffer from GCS
      fileBuffer = await downloadContentFileBuffer(file, companyId);
      filename = file.filename || file.title || searchFilename;
    } else {
      // Download from HTTP/HTTPS URL
      fileBuffer = await downloadFile(request.url);
    }
    
    // Process based on file type
    if (request.fileType === 'excel') {
      return processExcelFile(fileBuffer, filename);
    } else {
      // Default to text processing
      const content = fileBuffer.toString('utf-8');
      const response: ProcessFileResponse = {
        content,
        size: fileBuffer.length,
      };
      return { success: true, data: response };
    }
  } catch (error: any) {
    console.error('Error in processFile:', error);
    return {
      success: false,
      error: error.message || 'An unknown error occurred while processing file.',
    };
  }
};

/**
 * Downloads the raw file buffer from Google Cloud Storage
 */
async function downloadContentFileBuffer(file: any, companyId: string): Promise<Buffer> {
  const bucketName = process.env.GCP_STORAGE_BUCKET;
  if (!bucketName) {
    throw new Error('GCP_STORAGE_BUCKET not configured');
  }

  const storage = new Storage();
  const bucket = storage.bucket(bucketName);
  
  // Strip query parameters from gcpStorageUrl to get the blob name
  const urlWithoutParams = file.gcpStorageUrl.split('?')[0];
  const blobName = path.basename(urlWithoutParams);
  
  const [fileBuffer] = await bucket.file(blobName).download();
  return fileBuffer;
}

/**
 * Processes an Excel file and converts it to text format
 */
function processExcelFile(buffer: Buffer, filename: string): Promise<{
  success: boolean;
  data?: ProcessFileResponse;
  error?: string;
}> {
  try {
    // Parse Excel file
    const workbook = xlsx.parse(buffer, {
      cellFormula: false, // Don't parse formulas for security
      cellHTML: false,    // Don't parse HTML
      cellNF: false,      // Don't parse number formats
      sheetStubs: true,   // Include empty cells
      defval: null        // Default value for empty cells
    });

    let textContent = `Excel File: ${filename}\n`;
    let totalRows = 0;

    // Process each sheet
    workbook.forEach((sheet: any, sheetIndex: number) => {
      const { name, data } = sheet;
      
      textContent += `\n--- Sheet ${sheetIndex + 1}: ${name} ---\n`;
      
      if (!data || data.length === 0) {
        textContent += `(Empty sheet)\n`;
        return;
      }

      textContent += `Rows: ${data.length}\n\n`;
      totalRows += data.length;

      // Convert to tab-separated format
      const maxRowsToShow = 50; // Reduced from 100 to 50 to prevent Pusher payload size issues
      const rowsToProcess = Math.min(data.length, maxRowsToShow);

      for (let i = 0; i < rowsToProcess; i++) {
        const row = data[i];
        if (row && row.length > 0) {
          // Convert each cell to string, handling null/undefined
          const cellValues = row.map((cell: any) => {
            if (cell === null || cell === undefined) return '';
            return String(cell);
          });
          textContent += cellValues.join('\t') + '\n';
        }
      }

      if (data.length > maxRowsToShow) {
        textContent += `\n... (${data.length - maxRowsToShow} more rows not shown)\n`;
      }
    });

    const response: ProcessFileResponse = {
      content: textContent,
      size: buffer.length,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      metadata: {
        totalSheets: workbook.length,
        totalRows: totalRows
      }
    };

    return Promise.resolve({ success: true, data: response });

  } catch (error: any) {
    console.error('Error processing Excel file:', error);
    return Promise.resolve({
      success: false,
      error: `Failed to process Excel file: ${error.message || 'Unknown error'}`
    });
  }
}