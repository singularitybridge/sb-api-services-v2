import { Router } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import {
  validateApiKeys,
  getApiKey,
  refreshApiKeyCache,
} from '../../services/api.key.service';
import { Assistant } from '../../models/Assistant';
// OpenAI Assistant API calls removed as it's deprecated in favor of Vercel AI
import { createDefaultAssistant } from '../../services/assistant.service';
import mongoose from 'mongoose'; // Added for ObjectId generation

const router = Router();

router.post(
  '/',
  validateApiKeys(['openai_api_key']),
  async (req: AuthenticatedRequest, res) => {
    try {
      await refreshApiKeyCache(req.company._id.toString());

      const assistantData = {
        ...req.body,
        companyId: req.user?.companyId,
      };
      const newAssistant = new Assistant(assistantData);
      // const apiKey = (await getApiKey(req.company._id, 'openai_api_key')) as string; // Not needed

      // Generate a unique ID for assistantId instead of getting it from OpenAI
      newAssistant.assistantId = new mongoose.Types.ObjectId().toString();
      await newAssistant.save();

      // OpenAI assistant creation removed as it's deprecated in favor of Vercel AI
      console.log(
        `Created assistant ${newAssistant._id} in local database only`,
      );

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
  validateApiKeys(['openai_api_key']),
  async (req: AuthenticatedRequest, res) => {
    try {
      const companyId = req.company._id;
      const apiKey = (await getApiKey(companyId, 'openai_api_key')) as string;

      if (!apiKey) {
        return res.status(400).json({ message: 'OpenAI API key not found' });
      }

      const defaultAssistant = await createDefaultAssistant(
        companyId.toString(),
        apiKey,
      );
      res.status(201).json(defaultAssistant);
    } catch (error) {
      console.error('Error creating default assistant:', error);
      res.status(500).json({
        message: 'Failed to create default assistant',
        error: (error as Error).message,
      });
    }
  },
);

export default router;
