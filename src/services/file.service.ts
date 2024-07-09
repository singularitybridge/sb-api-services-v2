import { OpenAI } from 'openai';
import { File } from '../models/File';
import { Assistant } from '../models/Assistant';
import fs from 'fs';
import os from 'os';
import path from 'path';

export async function uploadFile(
  file: Express.Multer.File,
  assistantId: string,
  openaiApiKey: string,
  title?: string,
  description?: string
) {
  const openai = new OpenAI({ apiKey: openaiApiKey });

  try {
    // Create a temporary file
    const tempFilePath = path.join(os.tmpdir(), file.originalname);
    
    // Write the buffer to the temporary file
    fs.writeFileSync(tempFilePath, file.buffer);

    // Upload file to OpenAI using createReadStream
    const openaiFile = await openai.files.create({
      file: fs.createReadStream(tempFilePath),
      purpose: 'assistants',
    });

    // Delete the temporary file
    fs.unlinkSync(tempFilePath);

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

    // const currentAssistant = await openai.beta.assistants.retrieve(assistant.assistantId);
    // const updatedFileIds = [...(currentAssistant.files || []), openaiFile.id];

    // await openai.beta.assistants.update(assistant.assistantId, {
    //   file_ids: updatedFileIds,
    // });

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