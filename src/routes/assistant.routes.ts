import express from 'express';
import { getJob, getJobs, rerunJob } from '../services/agenda/agenda.service';
import { handleUserInput } from '../services/assistant.service';
import { Assistant } from '../models/Assistant';
import {
  createAssistant,
  deleteAssistantById,
  updateAssistantById,
} from '../services/oai.assistant.service';

const assistantRouter = express.Router();

assistantRouter.post('/user-input', async (req, res) => {
  const { userInput, assistantId, threadId } = req.body;
  const response = await handleUserInput(userInput, assistantId, threadId);
  res.send(response);
});

assistantRouter.get('/', async (req, res) => {
  const assistants = await Assistant.find({});
  res.send(assistants);
});

assistantRouter.get('/:id', async (req, res) => {
  const assistant = await Assistant.findById(req.params.id);
  res.send(assistant);
});

assistantRouter.put('/:id', async (req, res) => {
  const { id } = req.params;
  const assistantData = req.body;

  const assistant = await Assistant.findByIdAndUpdate(id, assistantData, {
    new: true,
    upsert: true,
  });

  await updateAssistantById(
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

  try {
    await newAssistant.save();

    const openAIAssistant = await createAssistant(
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
  const assistant = await Assistant.findById(id);
  if (!assistant) {
    return res.status(404).send({ message: 'Assistant not found' });
  }

  // Delete the assistant from OpenAI
  const deleted = await deleteAssistantById(assistant.assistantId);
  if (!deleted) {
    return res.status(500).send({ message: 'Failed to delete assistant from OpenAI' });
  }

  // Delete the assistant from the local database
  await Assistant.findByIdAndDelete(id);
  res.send({ message: 'Assistant deleted successfully' });
});

export { assistantRouter };
