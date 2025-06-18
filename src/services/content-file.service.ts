import { ContentFile, IContentFile } from '../models/ContentFile';
import { Storage } from '@google-cloud/storage';
import path from 'path';
import mongoose from 'mongoose';

let storage: Storage | undefined;
let bucketName: string | undefined = process.env.GCP_STORAGE_BUCKET;

if (process.env.GOOGLE_APPLICATION_CREDENTIALS) { // Assuming credentials are a prerequisite for storage
  storage = new Storage();
  if (!bucketName) {
    console.warn("GCP_STORAGE_BUCKET environment variable not found. Using default 'your-default-bucket-name'. This might not be intended for production.");
    bucketName = 'your-default-bucket-name';
  }
} else {
  console.warn("GOOGLE_APPLICATION_CREDENTIALS not found. Google Cloud Storage service will not be available.");
}


export const uploadContentFile = async (
  file: Express.Multer.File,
  companyId: string,
  title: string,
  description?: string,
  sessionId?: string,
  fileId?: string
): Promise<{ success: boolean; data?: Partial<IContentFile>; error?: string }> => {
  if (!storage || !bucketName) {
    const errorMsg = "Google Cloud Storage not configured. Cannot upload file.";
    console.error(errorMsg);
    return { success: false, error: errorMsg };
  }
  try {
    let contentFile;
    
    // If fileId is provided, check if file exists
    if (fileId) {
      try {
        const mongoFileId = new mongoose.Types.ObjectId(fileId);
        const mongoCompanyId = new mongoose.Types.ObjectId(companyId);

        // Log the search parameters for debugging
        console.log('Searching for file with:', {
          fileId: mongoFileId,
          companyId: mongoCompanyId
        });

        contentFile = await ContentFile.findOne({
          _id: mongoFileId,
          companyId: mongoCompanyId
        });

        console.log('Found file:', contentFile);

        if (!contentFile) {
          // Improved error message
          const existingFile = await ContentFile.findById(mongoFileId);
          if (existingFile) {
            throw new Error(`File found but not owned by the company. File ID: ${fileId}, Company ID: ${companyId}`);
          } else {
            throw new Error(`File not found. File ID: ${fileId}`);
          }
        }

        // Delete existing file from GCP
        const bucket = storage.bucket(bucketName);
        // Strip query parameters before getting basename
        const urlWithoutParams = contentFile.gcpStorageUrl.split('?')[0];
        const existingBlobName = path.basename(urlWithoutParams);
        try {
          await bucket.file(existingBlobName).delete();
          console.log('Successfully deleted old GCP file:', existingBlobName);
        } catch (error) {
          console.error('Error deleting existing file from GCP:', error);
          // Continue even if delete fails
        }

        // Update file properties
        contentFile.filename = file.originalname;
        contentFile.title = title;
        contentFile.mimeType = file.mimetype;
        contentFile.size = file.size;
        if (description !== undefined) contentFile.description = description;
        if (sessionId) contentFile.sessionId = new mongoose.Types.ObjectId(sessionId);
      } catch (error: any) {
        console.error('Error processing existing file:', error);
        throw new Error(`Error processing existing file: ${error?.message || 'Unknown error'}`);
      }
    } else {
      // Create new ContentFile instance without saving
      contentFile = new ContentFile({
        filename: file.originalname,
        title,
        mimeType: file.mimetype,
        size: file.size,
        companyId: new mongoose.Types.ObjectId(companyId),
        ...(description !== undefined && { description }),
        ...(sessionId && { sessionId: new mongoose.Types.ObjectId(sessionId) }),
      });
    }

    // Use the file ID for GCP storage filename
    const fileExtension = path.extname(file.originalname);
    const uniqueFilename = `${contentFile._id}${fileExtension}`;
    const bucket = storage.bucket(bucketName);
    const blob = bucket.file(uniqueFilename);

    // Add timestamp to metadata to ensure uniqueness
    const timestamp = new Date().toISOString();

    await blob.save(file.buffer, {
      metadata: {
        contentType: file.mimetype,
        cacheControl: 'no-cache, no-store, must-revalidate',
        lastModified: timestamp,
        metadata: {
          updateTimestamp: timestamp
        }
      },
    });
    console.log('Successfully uploaded new file to GCP:', uniqueFilename);

    // Generate signed URL with query parameter to bypass cache
    const [signedUrl] = await blob.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Add cache-busting query parameter
    const baseUrl = `${signedUrl.split('?')[0]}?t=${Date.now()}`;

    // Set the GCP URL
    contentFile.gcpStorageUrl = baseUrl;
    
    await contentFile.save();
    console.log('Successfully saved content file to database');

    // Remove companyId from the response
    const responseContentFile: Partial<IContentFile> = contentFile.toObject();
    delete responseContentFile.companyId;

    return { success: true, data: responseContentFile };
  } catch (error: any) {
    console.error('Error in uploadContentFile:', error);
    return { success: false, error: error.message || 'An unknown error occurred' };
  }
};

export const downloadContentFileText = async (fileId: string, companyId: string): Promise<string | null> => {
  if (!storage || !bucketName) {
    const errorMsg = "Google Cloud Storage not configured. Cannot download file text.";
    console.error(errorMsg);
    throw new Error(errorMsg); // Or return null depending on desired error handling
  }
  try {
    console.log(`Attempting to download content for file ID: ${fileId} for company: ${companyId}`);
    
    const fileMetadata = await ContentFile.findOne({ 
      _id: new mongoose.Types.ObjectId(fileId), 
      companyId: new mongoose.Types.ObjectId(companyId) 
    });

    if (!fileMetadata) {
      console.error(`File metadata not found or not owned by the company. FileId: ${fileId}, CompanyId: ${companyId}`);
      // Consider throwing an error or returning null based on desired behavior for "not found"
      return null; 
    }

    console.log(`File metadata found: ${JSON.stringify(fileMetadata)}`);

    const bucket = storage.bucket(bucketName);
    // Strip query parameters from gcpStorageUrl to get the blob name
    const urlWithoutParams = fileMetadata.gcpStorageUrl.split('?')[0];
    const blobName = path.basename(urlWithoutParams);
    
    console.log(`Attempting to download blob: ${blobName} from bucket: ${bucketName}`);
    
    const [fileBuffer] = await bucket.file(blobName).download();
    console.log(`Blob ${blobName} downloaded successfully`);
    
    // Assuming text files are UTF-8 encoded. For other types, more complex handling might be needed.
    return fileBuffer.toString('utf-8');

  } catch (error: any) {
    console.error('Error in downloadContentFileText:', error);
    // Rethrow or handle as appropriate for the service layer
    throw new Error(`Failed to download content file text: ${error.message || 'An unknown error occurred'}`);
  }
};

export const getContentFiles = async (companyId: string): Promise<IContentFile[]> => {
  try {
    return await ContentFile.find({ companyId: new mongoose.Types.ObjectId(companyId) });
  } catch (error) {
    console.error('Error fetching content files:', error);
    throw error;
  }
};

export const deleteContentFile = async (fileId: string, companyId: string): Promise<{ success: boolean; error?: string }> => {
  if (!storage || !bucketName) {
    const errorMsg = "Google Cloud Storage not configured. Cannot delete file.";
    console.error(errorMsg);
    return { success: false, error: errorMsg };
  }
  try {
    console.log(`Attempting to delete file with ID: ${fileId} for company: ${companyId}`);
    
    const file = await ContentFile.findOne({ 
      _id: new mongoose.Types.ObjectId(fileId), 
      companyId: new mongoose.Types.ObjectId(companyId) 
    });

    if (!file) {
      console.error(`File not found or not owned by the company. FileId: ${fileId}, CompanyId: ${companyId}`);
      return { success: false, error: 'File not found or not owned by the company' };
    }

    console.log(`File found in database: ${JSON.stringify(file)}`);

    const bucket = storage.bucket(bucketName);
    // Strip query parameters before getting basename
    const urlWithoutParams = file.gcpStorageUrl.split('?')[0];
    const blobName = path.basename(urlWithoutParams);
    console.log(`Attempting to delete blob: ${blobName} from bucket: ${bucketName}`);
    
    const blob = bucket.file(blobName);

    await blob.delete();
    console.log(`Blob ${blobName} deleted successfully from GCS`);

    await file.deleteOne();
    console.log(`File document deleted successfully from database`);

    return { success: true };
  } catch (error: any) {
    console.error('Error in deleteContentFile:', error);
    return { success: false, error: error.message || 'An unknown error occurred' };
  }
};
