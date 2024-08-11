// file path: /src/routes/assistant.routes.ts
import express from 'express';
import {
  deleteAssistant,
  handleSessionMessage,
} from '../services/assistant.service';
import { Assistant } from '../models/Assistant';
import {
  createAssistant,
  deleteAssistantById,
  updateAssistantById,
} from '../services/oai.assistant.service';
import {
  createNewThread,
  deleteThread,
  getMessages,
  getMessageHistoryFormatted,
} from '../services/oai.thread.service';
import { getCompletionResponse } from '../services/oai.completion.service';
import { getApiKey, validateApiKeys } from '../services/api.key.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

const assistantRouter = express.Router();

assistantRouter.post(
  '/completion',
  validateApiKeys(['openai']),
  async (req: AuthenticatedRequest, res) => {
    const {
      systemPrompt,
      userInput,
      model = 'gpt-4o',
      temperature,
      maxTokens,
    } = req.body;

    const apiKey = (await getApiKey(req.company._id, 'openai')) as string;

    try {
      const response = await getCompletionResponse(
        apiKey,
        systemPrompt,
        userInput,
        model,
        temperature,
        maxTokens,
      );
      res.json({ content: response });
    } catch (error) {
      res.status(500).json({
        error: 'An error occurred while processing the completion request',
      });
    }
  },
);

assistantRouter.get(
  '/thread/:id/messages',
  validateApiKeys(['openai']),
  async (req: AuthenticatedRequest, res) => {
    const { id } = req.params;
    const apiKey = (await getApiKey(req.company._id, 'openai')) as string;
    const messages = await getMessages(apiKey, id);
    res.send(messages);
  },
);

assistantRouter.post(
  '/thread',
  validateApiKeys(['openai']),
  async (req: AuthenticatedRequest, res) => {
    const apiKey = (await getApiKey(req.company._id, 'openai')) as string;
    const newThread = await createNewThread(apiKey);
    res.send(newThread);
  },
);

assistantRouter.delete(
  '/thread/:id',
  validateApiKeys(['openai']),
  async (req: AuthenticatedRequest, res) => {
    const { id } = req.params;
    const apiKey = (await getApiKey(req.company._id, 'openai')) as string;
    await deleteThread(apiKey, id);
    res.send({ message: 'Thread deleted successfully' });
  },
);

assistantRouter.post(
  '/user-input',
  validateApiKeys(['openai']),
  async (req: AuthenticatedRequest, res) => {
    const { userInput, sessionId } = req.body;
    const apiKey = (await getApiKey(req.company._id, 'openai')) as string;
    
    try {
      const response = await handleSessionMessage(apiKey, userInput, sessionId);
      res.send(response);
    } catch (error) {
      console.error('Error handling session message:', error);
      res.status(500).send('An error occurred while processing your request.');
    }
  },
);




assistantRouter.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const assistants = await Assistant.find({ companyId: req.user?.companyId });
    res.send(assistants);
  } catch (error) {
    res.status(500).send({ message: 'Error retrieving assistants' });
  }
});

assistantRouter.get('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const assistant = await Assistant.findOne({
      _id: req.params.id,
      companyId:
        req.user?.role === 'Admin' ? { $exists: true } : req.user?.companyId,
    });
    if (!assistant) {
      return res.status(404).send({ message: 'Assistant not found' });
    }
    res.send(assistant);
  } catch (error) {
    res.status(500).send({ message: 'Error retrieving assistant' });
  }
});

assistantRouter.put(
  '/:id',
  validateApiKeys(['openai']),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const assistantData = req.body;
      const apiKey = (await getApiKey(req.company._id, 'openai')) as string;

      const assistant = await Assistant.findOneAndUpdate(
        {
          _id: id,
          companyId:
            req.user?.role === 'Admin'
              ? { $exists: true }
              : req.user?.companyId,
        },
        assistantData,
        { new: true, upsert: false },
      );

      if (!assistant) {
        return res
          .status(404)
          .send({ message: 'Assistant not found or access denied' });
      }

      await updateAssistantById(
        apiKey,
        assistant.assistantId,
        assistant.name,
        assistant.description,
        assistant.llmModel,
        assistant.llmPrompt,
      );

      res.send(assistant);
    } catch (error) {
      res.status(500).send({ message: 'Error updating assistant' });
    }
  },
);

assistantRouter.post(
  '/',
  validateApiKeys(['openai']),
  async (req: AuthenticatedRequest, res) => {
    try {
      const assistantData = {
        ...req.body,
        companyId: req.user?.companyId,
      };
      const newAssistant = new Assistant(assistantData);
      const apiKey = (await getApiKey(req.company._id, 'openai')) as string;

      await newAssistant.save();

      const openAIAssistant = await createAssistant(
        apiKey,
        assistantData.companyId,
        newAssistant._id,
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
  },
);

assistantRouter.delete(
  '/:id',
  validateApiKeys(['openai']),
  async (req: AuthenticatedRequest, res) => {
    const { id } = req.params;

    const assistant = await Assistant.findOne({
      _id: id,
      companyId:
        req.user?.role === 'Admin' ? { $exists: true } : req.user?.companyId,
    });

    if (!assistant) {
      return res.status(404).send({ message: 'Assistant not found' });
    }

    try {
      await deleteAssistant(id, assistant.assistantId);
      res.send({ message: 'Assistant deleted successfully' });
    } catch (error) {
      res.status(500).send({ message: 'Failed to delete assistant' });
    }
  },
);

export { assistantRouter };
