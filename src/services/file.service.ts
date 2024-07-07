// src/services/file.service.ts
import { OpenAI } from 'openai';
import { File } from '../models/File';
import { Assistant } from '../models/Assistant';

export async function uploadFile(
  file: Express.Multer.File, 
  assistantId: string, 
  openaiApiKey: string, 
  title?: string, 
  description?: string
) {
  const openai = new OpenAI({ apiKey: openaiApiKey });

  try {
    // Create a Blob from the buffer
    const blob = new Blob([file.buffer], { type: file.mimetype });
    
    // Create a File object
    const fileObject = new File([blob], file.originalname, { type: file.mimetype });

    // Upload file to OpenAI
    const openaiFile = await openai.files.create({
      file: fileObject,
      purpose: 'assistants',
    });

    // Create file document in MongoDB
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
    const assistant = await Assistant.findOne({ assistantId });
    if (!assistant) {
      throw new Error('Assistant not found');
    }

    const currentAssistant = await openai.beta.assistants.retrieve(assistant.assistantId);
    const updatedFileIds = [...(currentAssistant.file_ids || []), openaiFile.id];

    await openai.beta.assistants.update(assistant.assistantId, {
      file_ids: updatedFileIds,
    });

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