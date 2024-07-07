// src/routes/file.routes.ts
import express from 'express';
import multer from 'multer';
import { uploadFile } from '../services/file.service';


const fileRouter = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

fileRouter.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { assistantId, title, description } = req.body;
    const openaiApiKey = req.headers['openai-api-key'] as string;

    if (!assistantId) {
      return res.status(400).json({ error: 'Assistant ID is required' });
    }

    if (!openaiApiKey) {
      return res.status(400).json({ error: 'OpenAI API key is required' });
    }

    const result = await uploadFile(req.file, assistantId, openaiApiKey, title, description);
    res.status(201).json(result);
  } catch (error) {
    console.error('Error in file upload:', error);
    res.status(500).json({ error: 'Error uploading file' });
  }
});

export { fileRouter};