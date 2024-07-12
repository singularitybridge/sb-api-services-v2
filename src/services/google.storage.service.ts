import { Storage } from '@google-cloud/storage';

let storage: Storage;

if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  // Local development: Use the specified credentials file
  storage = new Storage({
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  });
} else {
  // In GCP: Use default credentials
  storage = new Storage();
}

export const uploadImage = (file: Express.Multer.File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const bucket = storage.bucket('sb-ai-experiments-files');
    const blob = bucket.file(file.originalname);
    const blobStream = blob.createWriteStream();

    blobStream.on('error', (err) => {
      reject(err);
    });

    blobStream.on('finish', () => {
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;
      resolve(publicUrl);
    });

    blobStream.on('error', (err) => {
      console.error('Error uploading to Cloud Storage:', err);
      reject(err);
    });    

    blobStream.end(file.buffer);
  });
};