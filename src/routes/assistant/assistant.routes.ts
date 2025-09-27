import express from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { validateApiKeys, getApiKey } from '../../services/api.key.service';
import { Assistant } from '../../models/Assistant';
import { deleteAssistant } from '../../services/assistant.service';
import { updateAllowedActions } from '../../services/allowed-actions.service';
import { validateObjectId } from '../../utils/validation';
import { resolveAssistantIdentifier } from '../../services/assistant/assistant-resolver.service';

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
  // Remove validateObjectId since we now accept names too
  validateApiKeys(['openai_api_key']),
  async (req: AuthenticatedRequest, res) => {
    const { id } = req.params;

    try {
      // Use resolver to handle both ID and name
      const companyId =
        req.user?.role === 'Admin' ? null : req.user?.companyId?.toString();

      let assistant;
      if (req.user?.role === 'Admin' && !companyId) {
        // Admin can access any assistant - try to resolve without company constraint
        assistant = await Assistant.findOne({
          $or: [{ _id: id }, { name: id }],
        });
      } else {
        // Regular user - use resolver with company constraint
        assistant = await resolveAssistantIdentifier(id, companyId || '');
      }

      if (!assistant) {
        return res.status(404).send({ message: 'Assistant not found' });
      }

      await deleteAssistant(assistant._id.toString(), assistant.assistantId);
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
  // Remove validateObjectId since we now accept names too
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

      // Use resolver to get the actual assistant
      const assistant = await resolveAssistantIdentifier(
        id,
        req.user?.companyId?.toString() || '',
      );

      if (!assistant) {
        return res.status(404).send({ message: 'Assistant not found' });
      }

      const updatedAssistant = await updateAllowedActions(
        assistant._id.toString(),
        allowedActions,
      );

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
