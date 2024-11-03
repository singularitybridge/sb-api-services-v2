import express from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { validateApiKeys, getApiKey } from '../../services/api.key.service';
import { getCompletionResponse } from '../../services/oai.completion.service';

const completionRouter = express.Router();

completionRouter.post(
  '/',
  validateApiKeys(['openai_api_key']),
  async (req: AuthenticatedRequest, res) => {
    const {
      systemPrompt,
      userInput,
      model = 'gpt-4o',
      temperature,
    } = req.body;

    const apiKey = (await getApiKey(req.company._id, 'openai_api_key')) as string;

    try {
      const response = await getCompletionResponse(
        apiKey,
        systemPrompt,
        userInput,
        model,
        temperature,
      );
      res.json({ content: response });
    } catch (error) {
      res.status(500).json({
        error: 'An error occurred while processing the completion request',
      });
    }
  },
);

export { completionRouter };