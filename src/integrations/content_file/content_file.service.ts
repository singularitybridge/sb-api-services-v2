import { uploadContentFile, getContentFiles, deleteContentFile, downloadContentFileText } from '../../services/content-file.service';
import { IContentFile, ContentFile } from '../../models/ContentFile';
import { Readable } from 'stream';
import mongoose from 'mongoose';

export const readContentFiles = async (
  sessionId: string,
  companyId: string
): Promise<{ success: boolean; data: IContentFile[] }> => {
  try {
    const files = await getContentFiles(companyId);
    return { success: true, data: files };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    throw new Error(`Failed to read content files: ${errorMessage}`);
  }
};

export const getContentFileById = async (
  sessionId: string,
  companyId: string,
  fileId: string
): Promise<{ success: boolean; data: IContentFile | null }> => {
  try {
    const file = await ContentFile.findOne({
      _id: new mongoose.Types.ObjectId(fileId),
      companyId: new mongoose.Types.ObjectId(companyId)
    });
    return { success: true, data: file };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    throw new Error(`Failed to get content file: ${errorMessage}`);
  }
};

export const getFileContentText = async (
  sessionId: string, // sessionId might not be strictly needed here if downloadContentFileText doesn't use it
  companyId: string,
  fileId: string
): Promise<{ success: boolean; data: string | null }> => {
  try {
    // Assuming downloadContentFileText is imported from '../../services/content-file.service'
    // This import will be added in the next step if not already present by the linter/IDE
    const content = await downloadContentFileText(fileId, companyId);
    return { success: true, data: content };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    // To align with other functions, we throw an error which will be caught by executeAction
    throw new Error(`Failed to get file content text: ${errorMessage}`);
  }
};

export const writeContentFile = async (
  sessionId: string,
  companyId: string,
  params: {
    title: string;
    content: string;
    description?: string;
    fileId?: string;
  }
): Promise<{ success: boolean; data: Partial<IContentFile> }> => {
  try {
    console.log('Writing content file with params:', JSON.stringify(params));

    // Create a Buffer from the content string
    const buffer = Buffer.from(params.content);
    
    // Create a readable stream from the buffer
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);

    // Create a file object that implements Express.Multer.File
    const file = {
      buffer,
      originalname: params.title,
      mimetype: 'text/plain',
      size: buffer.length,
      fieldname: 'file',
      encoding: '7bit',
      destination: '',
      filename: params.title,
      path: '',
      stream
    };

    const contentFile = await uploadContentFile(
      file,
      companyId,
      params.title,
      params.description,
      sessionId,
      params.fileId // Only pass fileId if it was provided in params
    );

    if (!contentFile || !contentFile.data) {
      throw new Error('Failed to create or update content file');
    }

    console.log('Content file created/updated successfully:', contentFile);
    return { success: true, data: contentFile.data };
  } catch (error: unknown) {
    console.error('Error in writeContentFile:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    throw new Error(`Failed to write content file: ${errorMessage}`);
  }
};

export const removeContentFile = async (
  sessionId: string,
  companyId: string,
  fileId: string
): Promise<{ success: boolean }> => {
  try {
    await deleteContentFile(fileId, companyId);
    return { success: true };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    throw new Error(`Failed to delete content file: ${errorMessage}`);
  }
};
