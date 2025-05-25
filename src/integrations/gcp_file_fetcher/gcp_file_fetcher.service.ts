import { ContentFile, IContentFile } from '../../models/ContentFile';
import { Storage } from '@google-cloud/storage';
import path from 'path';
import mongoose from 'mongoose';

const storage = new Storage();
const bucketName = process.env.GCP_STORAGE_BUCKET || 'sb-ai-experiments-files'; // Ensure this matches your actual bucket name

interface FetchFileParams {
  fileId: string;
}

export const fetchGcpFileContent = async (
  sessionId: string, // Included for consistency with ActionContext, though not directly used here
  companyId: string,
  params: FetchFileParams
): Promise<{ success: boolean; data?: string; error?: string }> => {
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

    const [contents] = await blob.download();
    
    // Assuming the file is text-based. For binary files, this might need adjustment
    // or the action should specify expected content type.
    const fileContentString = contents.toString('utf8');

    return { success: true, data: fileContentString };

  } catch (error: any) {
    console.error('Error in fetchGcpFileContent:', error);
    // Rethrow the error to be handled by the action layer
    throw new Error(error.message || 'Failed to fetch GCP file content due to an unknown error.');
  }
};
