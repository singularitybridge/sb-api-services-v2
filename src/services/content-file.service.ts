import { ContentFile, IContentFile } from '../models/ContentFile';
import { Storage } from '@google-cloud/storage';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import mongoose from 'mongoose';

const storage = new Storage();
const bucketName = process.env.GCP_STORAGE_BUCKET || 'your-default-bucket-name';

export const uploadContentFile = async (
  file: Express.Multer.File,
  companyId: string,
  title: string,
  description?: string
): Promise<IContentFile> => {
  try {
    const fileExtension = path.extname(file.originalname);
    const uniqueFilename = `${uuidv4()}${fileExtension}`;
    const bucket = storage.bucket(bucketName);
    const blob = bucket.file(uniqueFilename);

    await blob.save(file.buffer, {
      metadata: {
        contentType: file.mimetype,
      },
    });

    const [url] = await blob.getSignedUrl({
      action: 'read',
      expires: '03-01-2500', // Set a far future expiration date
    });

    const contentFile = new ContentFile({
      filename: file.originalname,
      title,
      description,
      mimeType: file.mimetype,
      size: file.size,
      gcpStorageUrl: url,
      companyId: new mongoose.Types.ObjectId(companyId),
    });

    await contentFile.save();

    return contentFile;
  } catch (error) {
    console.error('Error uploading content file:', error);
    throw error;
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

export const deleteContentFile = async (fileId: string, companyId: string): Promise<{ deleted: boolean }> => {
  try {
    const file = await ContentFile.findOne({ _id: new mongoose.Types.ObjectId(fileId), companyId: new mongoose.Types.ObjectId(companyId) });

    if (!file) {
      throw new Error('File not found or not owned by the company');
    }

    const bucket = storage.bucket(bucketName);
    const blob = bucket.file(path.basename(file.gcpStorageUrl));

    await blob.delete();
    await file.deleteOne();

    return { deleted: true };
  } catch (error) {
    console.error('Error deleting content file:', error);
    throw error;
  }
};