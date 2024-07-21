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

    const currentAssistant = await openai.beta.assistants.retrieve(assistant.assistantId);
    const currentFileIds = (currentAssistant as any).file_ids ?? [];
    const updatedFileIds = [...currentFileIds, openaiFile.id];

    // Use a type assertion to bypass TypeScript's property check
    await openai.beta.assistants.update(assistant.assistantId, {
      file_ids: updatedFileIds,
    } as any);


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

export async function listFiles(assistantId: string) {
  try {
    const files = await File.find({ assistantId });
    return files.map((file) => ({
      id: file._id,
      name: file.title,
      description: file.description,
      created_at: file.createdAt,
      filename: file.filename,
    }));
  } catch (error) {
    console.error('Error listing files:', error);
    throw error;
  }
}

export async function deleteFile(assistantId: string, fileId: string, openaiApiKey: string) {
  const openai = new OpenAI({ apiKey: openaiApiKey });

  try {
    const file = await File.findOne({ _id: fileId, assistantId });
    if (!file) {
      throw new Error('File not found');
    }

    // Delete file from OpenAI
    await openai.files.del(file.openaiFileId);

    // Remove file from Assistant
    const assistant = await Assistant.findOne({ assistantId });
    if (assistant) {
      const currentAssistant = await openai.beta.assistants.retrieve(assistant.assistantId);
      const currentFileIds = (currentAssistant as any).file_ids ?? [];
      const updatedFileIds = currentFileIds.filter((id: string) => id !== file.openaiFileId);

      // Use type assertion when updating the assistant
      await openai.beta.assistants.update(assistant.assistantId, {
        file_ids: updatedFileIds,
      } as any);

      // Use a type assertion to bypass TypeScript's property check
      await openai.beta.assistants.update(assistant.assistantId, {
        file_ids: updatedFileIds,
      } as any);

    }

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
    const files = await File.find({ assistantId });
    for (const file of files) {
      try {
        await openai.files.del(file.openaiFileId);
        await file.deleteOne();
      } catch (error) {
        console.error(`Error deleting file ${file._id}:`, error);
      }
    }
  } catch (error) {
    console.error('Error cleaning up assistant files:', error);
    throw error;
  }
}


// import { OpenAI } from 'openai';
// import { File } from '../models/File';
// import { Assistant } from '../models/Assistant';
// import fs from 'fs';
// import os from 'os';
// import path from 'path';

// export async function uploadFile(
//   file: Express.Multer.File,
//   assistantId: string,
//   openaiApiKey: string,
//   title?: string,
//   description?: string
// ) {
//   const openai = new OpenAI({ apiKey: openaiApiKey });

//   try {
//     // Create a temporary file
//     const tempFilePath = path.join(os.tmpdir(), file.originalname);
    
//     // Write the buffer to the temporary file
//     fs.writeFileSync(tempFilePath, file.buffer);

//     // Upload file to OpenAI using createReadStream
//     const openaiFile = await openai.files.create({
//       file: fs.createReadStream(tempFilePath),
//       purpose: 'assistants',
//     });

//     // Delete the temporary file
//     fs.unlinkSync(tempFilePath);

//     // Create file document in MongoDB
//     const newFile = new File({
//       filename: file.originalname,
//       title: title || file.originalname,
//       description: description,
//       mimeType: file.mimetype,
//       size: file.size,
//       openaiFileId: openaiFile.id,
//       assistantId,
//     });
//     await newFile.save();

//     // Attach file to OpenAI Assistant
//     const assistant = await Assistant.findOne({ assistantId });
//     if (!assistant) {
//       throw new Error('Assistant not found');
//     }

//     // const currentAssistant = await openai.beta.assistants.retrieve(assistant.assistantId);
//     // const updatedFileIds = [...(currentAssistant.files || []), openaiFile.id];

//     // await openai.beta.assistants.update(assistant.assistantId, {
//     //   file_ids: updatedFileIds,
//     // });

//     return {
//       message: 'File uploaded successfully',
//       fileId: newFile._id,
//       openaiFileId: openaiFile.id,
//       title: newFile.title,
//       description: newFile.description,
//     };
//   } catch (error) {
//     console.error('Error in file service:', error);
//     throw error;
//   }
// }