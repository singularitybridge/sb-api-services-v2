// file path: /src/routes/assistant.routes.ts
import express from 'express';
import { getJob, getJobs, rerunJob } from '../services/agenda/agenda.service';
import { handleSessionMessage, handleUserInput } from '../services/assistant.service';
import { Assistant } from '../models/Assistant';
import {
  createAssistant,
  deleteAssistantById,
  updateAssistantById,
} from '../services/oai.assistant.service';
import { createNewThread, deleteThread, getMessages, getMessageHistoryFormatted } from '../services/oai.thread.service';

const assistantRouter = express.Router();

assistantRouter.get('/thread/:id/messages', async (req, res) => {
  const { id } = req.params;
  const apiKey = req.headers['openai-api-key'] as string;
  const messages = await getMessages(apiKey, id);
  res.send(messages);
});

assistantRouter.post('/thread', async (req, res) => {  
  const apiKey = req.headers['openai-api-key'] as string;
  const newThread = await createNewThread(apiKey);
  res.send(newThread);
});

assistantRouter.delete('/thread/:id', async (req, res) => {
  const { id } = req.params;
  const apiKey = req.headers['openai-api-key'] as string;
  await deleteThread(apiKey, id);
  res.send({ message: 'Thread deleted successfully' });
});

assistantRouter.post('/user-input', async (req, res) => {
  const { userInput, companyId, userId } = req.body;
  const apiKey = req.headers['openai-api-key'] as string;
  const response = await handleSessionMessage(apiKey, userInput, companyId, userId);
  res.send(response);
});

assistantRouter.post('/user-input/thread', async (req, res) => {
  
  const { userInput, assistantId, threadId } = req.body;
  const apiKey = req.headers['openai-api-key'] as string;
  const response = await handleUserInput(apiKey , userInput, assistantId, threadId);
  res.send(response);
});

assistantRouter.get('/', async (req, res) => {
  const assistants = await Assistant.find({});
  res.send(assistants);
});

assistantRouter.get('/company/:id', async (req, res) => {
  const { id } = req.params;
  const assistants = await Assistant.find({ companyId: id });
  res.send(assistants);
});

assistantRouter.get('/:id', async (req, res) => {
  const assistant = await Assistant.findById(req.params.id);
  res.send(assistant);
});

assistantRouter.put('/:id', async (req, res) => {
  const { id } = req.params;
  const assistantData = req.body;
  const apiKey = req.headers['openai-api-key'] as string;

  const assistant = await Assistant.findByIdAndUpdate(id, assistantData, {
    new: true,
    upsert: true,
  });

  await updateAssistantById(
    apiKey,
    assistant.assistantId,
    assistant.name,
    assistant.description,
    assistant.llmModel,
    assistant.llmPrompt,
  );

  res.send(assistant);
});

assistantRouter.post('/', async (req, res) => {
  const assistantData = req.body;
  const newAssistant = new Assistant(assistantData);
  const apiKey = req.headers['openai-api-key'] as string;

  try {
    await newAssistant.save();

    const openAIAssistant = await createAssistant(
      apiKey,
      assistantData.name,
      assistantData.description,
      assistantData.llmModel,
      assistantData.llmPrompt,
    );

    newAssistant.assistantId = openAIAssistant.id;
    await newAssistant.save();

    res.send(newAssistant);
  } catch (err) {

    if (err instanceof Error && 'code' in err && err.code === 11000) {
      res.status(400).send({
        message:
          'Duplicate key error: an assistant with this phone number already exists.',
      });
    } else {
      res.status(500).send({
        message: `An error occurred while trying to create the assistant : ${err}`,
      });
    }
  }
});

assistantRouter.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const apiKey = req.headers['openai-api-key'] as string;
  console.log("assistant id ------ "+id);
  
  const assistant = await Assistant.findById(id);
  if (!assistant) {
    return res.status(404).send({ message: 'Assistant not found ---- ' });
  }

  // Delete the assistant from OpenAI
  const deleted = await deleteAssistantById(apiKey, assistant.assistantId);
  if (!deleted) {
    return res.status(500).send({ message: 'Failed to delete assistant from OpenAI' });
  }

  // Delete the assistant from the local database
  await Assistant.findByIdAndDelete(id);
  res.send({ message: 'Assistant deleted successfully' });
});

export { assistantRouter };
