// file path: /src/services/file.service.ts

import { OpenAI } from 'openai';
import { File } from '../models/File';
import { Assistant } from '../models/Assistant';
import fs from 'fs';
import os from 'os';
import path from 'path';
import mongoose from 'mongoose';
import { VectorStore } from '../models/VectorStore';

export async function uploadFile(
  file: Express.Multer.File,
  assistantId: string,
  openaiApiKey: string,
  title?: string,
  description?: string
) {
  const openai = new OpenAI({ apiKey: openaiApiKey });

  try {
    // Check if the file is empty
    if (file.size === 0) {
      throw new Error('File buffer is empty. Please upload a valid file.');
    }

    // Validate the MIME type
    const supportedMimeTypes = [
      'c', 'cpp', 'css', 'csv', 'docx', 'gif', 'html', 'java', 'jpeg', 'jpg', 'js', 'json',
      'md', 'pdf', 'php', 'png', 'pptx', 'py', 'rb', 'tar', 'tex', 'ts', 'txt', 'webp', 'xlsx', 'xml', 'zip'
    ];
    const fileExtension = path.extname(file.originalname).substring(1);
    if (!supportedMimeTypes.includes(fileExtension)) {
      throw new Error(`Unsupported file format: ${file.mimetype}. Supported formats are: ${supportedMimeTypes.join(', ')}`);
    }
    const tempFilePath = path.join(os.tmpdir(), file.originalname);

    // Write the buffer to the temporary file
    fs.writeFileSync(tempFilePath, file.buffer);

    // Upload file to OpenAI using createReadStream
    console.log('Uploading file to OpenAI');
    const openaiFile = await openai.files.create({
      file: fs.createReadStream(tempFilePath),
      purpose: 'assistants',
    });

    // Find the assistant in MongoDB
    const assistant = await Assistant.findOne({
      _id: new mongoose.Types.ObjectId(assistantId),
    });
    if (!assistant) {
      throw new Error('Assistant not found');
    }

    // Find the associated vector store
    const vectorStore = await VectorStore.findOne({ assistantId: assistant._id });
    if (!vectorStore) {
      throw new Error('Vector store not found');
    }


    // Create Vector store file
    const vectorStoreFile = await openai.beta.vectorStores.files.create(
      vectorStore.openaiId,
      {
        file_id: openaiFile.id,
      }
    );
    console.log('Vector store file created:', vectorStoreFile);

    // Delete the temporary file
    fs.unlinkSync(tempFilePath);

    // Create file document in MongoDB
    console.log('Creating file document in MongoDB');
    const newFile = new File({
      filename: file.originalname,
      title: title || file.originalname,
      description: description,
      mimeType: file.mimetype,
      size: file.size,
      openaiFileId: openaiFile.id,
      assistantId,
    });
    await newFile.save();

    // Attach file to OpenAI Assistant
    const updateResponse = await openai.beta.assistants.update(assistant.assistantId, {
      tool_resources: { file_search: { vector_store_ids: [vectorStoreFile.vector_store_id] } },
      tools: [{ type: 'file_search' }],
    } as any);

    console.log('Assistant updated successfully');
    return {
      message: 'File uploaded successfully',
      fileId: newFile._id,
      openaiFileId: openaiFile.id,
      title: newFile.title,
      description: newFile.description,
    };

  } catch (error) {
    console.error('Error in file service:', error);
    throw error;
  }
}



export async function listAllOpenAIFiles(openaiApiKey: string) {
  const openai = new OpenAI({ apiKey: openaiApiKey });

  try {
    const files = await openai.files.list();
    return files;
  } catch (error) {
    console.error('Error listing files:', error);
    throw error;
  }
}

export async function listFiles(assistantId: string, openaiApiKey: string) {
  const openai = new OpenAI({ apiKey: openaiApiKey });

  try {
    // Fetch assistant details from MongoDB
    const assistant = await Assistant.findOne({
      _id: new mongoose.Types.ObjectId(assistantId),
    });
    if (!assistant) {
      throw new Error('Assistant not found');
    }

    // Fetch files from MongoDB
    const files = await File.find({ assistantId: assistant._id });

    // Fetch file details from OpenAI
    const openaiFiles = await openai.files.list();

    // Combine MongoDB and OpenAI data
    const combinedFiles = await Promise.all(files.map(async (file) => {
      const openaiFile = openaiFiles.data.find(f => f.id === file.openaiFileId);

      return {
        fileId : file._id.toString(),
        name: file.title,
        description: file.description,
        created_at: file.createdAt,
        filename: file.filename,
        openai_id: file.openaiFileId,
        purpose: openaiFile?.purpose,
        bytes: openaiFile?.bytes,
        status: openaiFile?.status,
      };
    }));

    return combinedFiles;
  } catch (error) {
    console.error('Error listing files:', error);
    throw error;
  }
}

export async function deleteFile(assistantId: string, fileId: string, openaiApiKey: string) {
  const openai = new OpenAI({ apiKey: openaiApiKey });

  try {
    // Find the file in MongoDB
    const file = await File.findOne({ _id: new mongoose.Types.ObjectId(fileId), assistantId });
    if (!file) {
      throw new Error('File not found');
    }

    // Delete file from OpenAI
    await openai.files.del(file.openaiFileId);

    // Delete file record from MongoDB
    await file.deleteOne();

    return {
      id: file._id,
      deleted: true,
    };
  } catch (error) {
    console.error('Error deleting file:', error);
    throw error;
  }
}

export async function cleanupAssistantFiles(assistantId: string, openaiApiKey: string) {
  const openai = new OpenAI({ apiKey: openaiApiKey });

  try {
    const vectorStore = await VectorStore.findOne({ assistantId });
    if (vectorStore) {
      try {
        // Delete the vector store from OpenAI
        await openai.beta.vectorStores.del(vectorStore.openaiId);

        // Delete the vector store document from MongoDB
        await vectorStore.deleteOne();

      } catch (error) {
        console.error(`Error deleting vector store ${vectorStore._id}:`, error);
      }

      const files = await File.find({ assistantId });
      for (const file of files) {
        try {
          await openai.files.del(file.openaiFileId);
          await file.deleteOne();
        } catch (error) {
          console.error(`Error deleting file ${file._id}:`, error);
        }
      }
    }
  } catch (error) {
    console.error('Error cleaning up assistant files:', error);
    throw error;
  }
}
