import { Router } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { validateApiKeys, getApiKey, refreshApiKeyCache } from '../../services/api.key.service';
import { Assistant } from '../../models/Assistant';
import { createAssistant } from '../../services/oai.assistant.service';
import { createDefaultAssistant } from '../../services/assistant.service';

const router = Router();

router.post(
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

router.post(
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

export default router;
