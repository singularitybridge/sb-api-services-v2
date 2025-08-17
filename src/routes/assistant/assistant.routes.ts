import express from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { validateApiKeys, getApiKey } from '../../services/api.key.service';
import { Assistant } from '../../models/Assistant';
import { deleteAssistant } from '../../services/assistant.service';
import { updateAllowedActions } from '../../services/allowed-actions.service';
import { validateObjectId } from '../../utils/validation';

import getRoutes from './get.routes';
import putRoutes from './put.routes';
import postRoutes from './post.routes';

const assistantRouter = express.Router();

// Use the separated route handlers
assistantRouter.use('/', getRoutes);
assistantRouter.use('/', putRoutes);
assistantRouter.use('/', postRoutes);

assistantRouter.delete(
  '/:id',
  validateObjectId('id'),
  validateApiKeys(['openai_api_key']),
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
      res.status(500).send({
        message: `Failed to delete assistant: ${(error as Error).message}`,
      });
    }
  },
);

assistantRouter.patch(
  '/:id/allowed-actions',
  validateObjectId('id'),
  validateApiKeys(['openai_api_key']),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const { allowedActions } = req.body;

      if (!Array.isArray(allowedActions)) {
        return res
          .status(400)
          .send({ message: 'allowedActions must be an array of strings' });
      }

      const updatedAssistant = await updateAllowedActions(id, allowedActions);

      if (!updatedAssistant) {
        return res.status(404).send({ message: 'Assistant not found' });
      }

      res.send(updatedAssistant);
    } catch (error) {
      console.error('Error updating allowed actions:', error);
      if (
        error instanceof Error &&
        error.message.startsWith('Failed to add actions:')
      ) {
        return res.status(400).send({
          message: 'Error updating allowed actions',
          failedActions: error.message.split(':')[1].trim().split(', '),
        });
      }
      res.status(500).send({
        message: 'Error updating allowed actions',
        error: (error as Error).message,
      });
    }
  },
);

export { assistantRouter };
