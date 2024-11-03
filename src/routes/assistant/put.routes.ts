import { Router } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { validateApiKeys, getApiKey } from '../../services/api.key.service';
import { Assistant } from '../../models/Assistant';
import { updateAllowedActions } from '../../services/allowed-actions.service';
import { updateAssistantById } from '../../services/oai.assistant.service';

const router = Router();

router.put(
  '/:id',
  validateApiKeys(['openai_api_key']),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const assistantData = req.body;
      const { allowedActions, ...otherData } = assistantData;

      const apiKey = (await getApiKey(req.company._id, 'openai_api_key')) as string;

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

export default router;
