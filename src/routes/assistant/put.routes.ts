import { Router } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { validateApiKeys, getApiKey } from '../../services/api.key.service';
import { Assistant } from '../../models/Assistant';
import { updateAllowedActions } from '../../services/allowed-actions.service';
import { validateObjectId } from '../../utils/validation';
import { promptHistoryService } from '../../services/prompt-history.service';
import { promptChangeDescriptionService } from '../../services/prompt-change-description.service';
import { resolveAssistantIdentifier } from '../../services/assistant/assistant-resolver.service';
import {
  isValidAssistantName,
  getNameValidationError,
  suggestValidName,
} from '../../utils/assistant-name-validation';
// OpenAI Assistant API calls removed as it's deprecated in favor of Vercel AI

const router = Router();

router.put(
  '/:id',
  // Remove validateObjectId since we now accept names too
  validateApiKeys(['openai_api_key']),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const assistantData = req.body;
      const { allowedActions, ...otherData } = assistantData;

      // Resolve assistant first to check if name is actually changing
      const currentAssistant = await resolveAssistantIdentifier(
        id,
        req.user?.companyId.toString() || '',
      );

      if (!currentAssistant) {
        return res
          .status(404)
          .send({ message: 'Assistant not found or access denied' });
      }

      // Only validate name if it's being changed to a new value
      if (otherData.name && otherData.name !== currentAssistant.name) {
        if (!isValidAssistantName(otherData.name)) {
          const error = getNameValidationError(otherData.name);
          const suggestion = suggestValidName(otherData.name);
          return res.status(400).json({
            error,
            suggestion: suggestion ? `Try: ${suggestion}` : undefined,
          });
        }
      }

      const apiKey = (await getApiKey(
        req.company._id,
        'openai_api_key',
      )) as string;

      // Update using the resolved assistant's _id
      const assistant = await Assistant.findOneAndUpdate(
        {
          _id: currentAssistant._id,
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

      if (allowedActions !== undefined) {
        await updateAllowedActions(
          currentAssistant._id.toString(),
          allowedActions,
        );
      }

      const updatedAssistant = await Assistant.findById(currentAssistant._id);

      // Track prompt changes in history
      if (
        otherData.llmPrompt &&
        otherData.llmPrompt !== currentAssistant.llmPrompt
      ) {
        try {
          const changeDescription =
            await promptChangeDescriptionService.generateChangeDescription(
              req.company._id.toString(),
              currentAssistant.llmPrompt || '',
              otherData.llmPrompt,
              assistant.name,
            );

          await promptHistoryService.savePromptVersion({
            assistantId: currentAssistant._id.toString(),
            companyId: req.company._id.toString(),
            promptContent: otherData.llmPrompt,
            changeType: 'update',
            changeDescription,
            previousPrompt: currentAssistant.llmPrompt,
            userId: req.user?._id?.toString(),
          });

          console.log(`Saved prompt history for assistant ${id}`);
        } catch (historyError) {
          console.error('Error saving prompt history:', historyError);
          // Don't fail the request if history tracking fails
        }
      }

      // OpenAI synchronization removed as it's deprecated in favor of Vercel AI
      console.log(`Updated assistant ${id} in local database only`);

      res.send(updatedAssistant);
    } catch (error) {
      console.error('Error updating assistant:', error);
      res.status(500).send({
        message: 'Error updating assistant',
        error: (error as Error).message,
      });
    }
  },
);

export default router;
