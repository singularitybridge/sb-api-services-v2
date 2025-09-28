import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { Request } from 'express';
import fs from 'fs/promises';

// Ensure upload directory exists
const UPLOAD_DIR = process.env.UPLOAD_DIR || '/tmp/workspace/uploads';

async function ensureUploadDir() {
  try {
    await fs.access(UPLOAD_DIR);
  } catch {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
  }
}

// Initialize directory
ensureUploadDir();

// Configure storage
const diskStorage = multer.diskStorage({
  destination: async (req: Request, file, cb) => {
    await ensureUploadDir();
    cb(null, UPLOAD_DIR);
  },
  filename: (req: Request, file, cb) => {
    // Generate unique filename with original extension
    const uniqueId = crypto.randomBytes(16).toString('hex');
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueId}${ext}`);
  },
});

// Configure multer with limits and filters
export const uploadMiddleware = multer({
  storage: diskStorage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max
    files: 10, // Max 10 files per request
  },
  fileFilter: (req, file, cb) => {
    // Accept all file types but log for monitoring
    console.log(`Uploading file: ${file.originalname}, type: ${file.mimetype}`);
    cb(null, true);
  },
});

// Different upload configurations
export const singleUpload = uploadMiddleware.single('file');
export const multipleUpload = uploadMiddleware.array('files', 10);
export const fieldsUpload = uploadMiddleware.fields([
  { name: 'document', maxCount: 1 },
  { name: 'attachments', maxCount: 5 },
]);
