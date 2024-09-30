import express from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { validateApiKeys, getApiKey, refreshApiKeyCache } from '../../services/api.key.service';
import { Assistant } from '../../models/Assistant';
import { getAssistants, deleteAssistant, createDefaultAssistant } from '../../services/assistant.service';
import { updateAllowedActions } from '../../services/allowed-actions.service';
import { createAssistant, updateAssistantById } from '../../services/oai.assistant.service';

const assistantRouter = express.Router();

assistantRouter.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const assistants = await getAssistants(req.user!.companyId.toString());
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
      const { allowedActions, ...otherData } = assistantData;

      const apiKey = (await getApiKey(req.company._id, 'openai')) as string;

      const assistant = await Assistant.findOneAndUpdate(
        {
          _id: id,
          companyId:
            req.user?.role === 'Admin'
              ? { $exists: true }
              : req.user?.companyId,
        },
        otherData,
        { new: true, upsert: false },
      );

      if (!assistant) {
        return res
          .status(404)
          .send({ message: 'Assistant not found or access denied' });
      }

      if (allowedActions) {
        await updateAllowedActions(id, allowedActions);
      }

      const updatedAssistant = await Assistant.findById(id);

      await updateAssistantById(
        apiKey,
        updatedAssistant!.assistantId,
        updatedAssistant!.name,
        updatedAssistant!.description,
        updatedAssistant!.llmModel,
        updatedAssistant!.llmPrompt,
        updatedAssistant!.allowedActions
      );

      res.send(updatedAssistant);
    } catch (error) {
      console.error('Error updating assistant:', error);
      res.status(500).send({ message: 'Error updating assistant', error: (error as Error).message });
    }
  },
);

assistantRouter.post(
  '/',
  validateApiKeys(['openai']),
  async (req: AuthenticatedRequest, res) => {
    try {
      await refreshApiKeyCache(req.company._id.toString());

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
        assistantData.allowedActions
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
        console.error('Error creating assistant:', err);
        res.status(500).send({
          message: `An error occurred while trying to create the assistant: ${err}`,
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

    try {
      const assistant = await Assistant.findOne({
        _id: id,
        companyId:
          req.user?.role === 'Admin' ? { $exists: true } : req.user?.companyId,
      });

      if (!assistant) {
        return res.status(404).send({ message: 'Assistant not found' });
      }

      await deleteAssistant(id, assistant.assistantId);
      res.send({ message: 'Assistant deleted successfully' });
    } catch (error) {
      console.error('Error deleting assistant:', error);
      res.status(500).send({ message: `Failed to delete assistant: ${(error as Error).message}` });
    }
  },
);

assistantRouter.post(
  '/default',
  validateApiKeys(['openai']),
  async (req: AuthenticatedRequest, res) => {
    try {
      const companyId = req.company._id;
      const apiKey = await getApiKey(companyId, 'openai') as string;

      if (!apiKey) {
        return res.status(400).json({ message: 'OpenAI API key not found' });
      }

      const defaultAssistant = await createDefaultAssistant(companyId.toString(), apiKey);
      res.status(201).json(defaultAssistant);
    } catch (error) {
      console.error('Error creating default assistant:', error);
      res.status(500).json({ message: 'Failed to create default assistant', error: (error as Error).message });
    }
  }
);

assistantRouter.patch(
  '/:id/allowed-actions',
  validateApiKeys(['openai']),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const { allowedActions } = req.body;

      if (!Array.isArray(allowedActions)) {
        return res.status(400).send({ message: 'allowedActions must be an array of strings' });
      }

      const updatedAssistant = await updateAllowedActions(id, allowedActions);

      if (!updatedAssistant) {
        return res.status(404).send({ message: 'Assistant not found' });
      }

      res.send(updatedAssistant);
    } catch (error) {
      console.error('Error updating allowed actions:', error);
      if (error instanceof Error && error.message.startsWith('Failed to add actions:')) {
        return res.status(400).send({ message: 'Error updating allowed actions', failedActions: error.message.split(':')[1].trim().split(', ') });
      }
      res.status(500).send({ message: 'Error updating allowed actions', error: (error as Error).message });
    }
  }
);

export { assistantRouter };