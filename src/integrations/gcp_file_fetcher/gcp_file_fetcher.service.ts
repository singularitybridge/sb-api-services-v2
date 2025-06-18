import { ContentFile, IContentFile } from '../../models/ContentFile';
import { Storage } from '@google-cloud/storage';
import path from 'path';
import mongoose from 'mongoose';
import pdf from 'pdf-parse';

let storage: Storage | undefined;
let bucketName: string | undefined = process.env.GCP_STORAGE_BUCKET;

if (process.env.GOOGLE_APPLICATION_CREDENTIALS) { // Assuming credentials are a prerequisite for storage
  storage = new Storage();
  if (!bucketName) {
    console.warn("GCP_STORAGE_BUCKET environment variable not found. Using default 'sb-ai-experiments-files'. This might not be intended for production.");
    bucketName = 'sb-ai-experiments-files';
  }
} else {
  console.warn("GOOGLE_APPLICATION_CREDENTIALS not found. GCP file fetcher service will not be available.");
}

interface FetchFileParams {
  fileId: string;
  returnAs?: 'string' | 'buffer'; // Added option to return buffer
}

export const fetchGcpFileContent = async (
  sessionId: string, // Included for consistency with ActionContext, though not directly used here
  companyId: string,
  params: FetchFileParams
): Promise<{ success: boolean; data?: string | Buffer; error?: string }> => { // Updated return type
  if (!storage || !bucketName) {
    const errorMsg = "Google Cloud Storage not configured. Cannot fetch file.";
    console.error(errorMsg);
    // Return a structured error response instead of throwing, to align with expected return type
    return { success: false, error: errorMsg }; 
  }
  if (!params.fileId) {
    throw new Error('The fileId parameter is missing.');
  }
  if (!mongoose.Types.ObjectId.isValid(params.fileId)) {
    throw new Error('Invalid fileId format.');
  }
  if (!mongoose.Types.ObjectId.isValid(companyId)) {
    // This should ideally be caught earlier or ensured by ActionContext
    throw new Error('Invalid companyId format.');
  }

  try {
    const fileObjectId = new mongoose.Types.ObjectId(params.fileId);
    const companyObjectId = new mongoose.Types.ObjectId(companyId);

    const fileDocument = await ContentFile.findOne({
      _id: fileObjectId,
      companyId: companyObjectId,
    });

    if (!fileDocument) {
      // Check if the file exists at all to give a more specific error
      const exists = await ContentFile.findById(fileObjectId);
      if (exists) {
        throw new Error(`File with ID ${params.fileId} found but does not belong to company ID ${companyId}.`);
      }
      throw new Error(`ContentFile not found with ID ${params.fileId} for company ID ${companyId}.`);
    }

    if (!fileDocument.gcpStorageUrl) {
      throw new Error(`GCP storage URL not found for file ID ${params.fileId}.`);
    }

    // Extract blob name from GCP storage URL
    // Example URL: https://storage.googleapis.com/bucket-name/blob-name.txt?t=timestamp
    const urlWithoutParams = fileDocument.gcpStorageUrl.split('?')[0];
    const blobName = path.basename(urlWithoutParams);

    if (!blobName) {
      throw new Error(`Could not extract blob name from URL: ${fileDocument.gcpStorageUrl}`);
    }

    const bucket = storage.bucket(bucketName);
    const blob = bucket.file(blobName);

    const [exists] = await blob.exists();
    if (!exists) {
      throw new Error(`File not found in GCP bucket. Bucket: ${bucketName}, Blob: ${blobName}`);
    }

    const [contents] = await blob.download(); // contents is a Buffer

    if (params.returnAs === 'buffer') {
      return { success: true, data: contents };
    }
    
    // Handle PDF files with proper text extraction
    if (fileDocument.mimeType === 'application/pdf') {
      try {
        const pdfData = await pdf(contents);
        return { success: true, data: pdfData.text };
      } catch (pdfError: any) {
        console.error('Error parsing PDF:', pdfError);
        return { success: false, error: `Failed to parse PDF: ${pdfError.message}` };
      }
    }
    
    // Default to string for other text-based files
    const fileContentString = contents.toString('utf8');
    return { success: true, data: fileContentString };

  } catch (error: any) {
    console.error('Error in fetchGcpFileContent:', error);
    // Rethrow the error to be handled by the action layer
    throw new Error(error.message || 'Failed to fetch GCP file content due to an unknown error.');
  }
};
