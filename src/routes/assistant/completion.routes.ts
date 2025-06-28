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
      model = 'gpt-4o-mini',
      temperature,
      pdfUrl,
    } = req.body;

    const apiKey = (await getApiKey(
      req.company._id,
      'openai_api_key',
    )) as string;

    try {
      const response = await getCompletionResponse(
        apiKey,
        systemPrompt,
        userInput,
        model,
        temperature,
        pdfUrl,
      );
      res.json({ content: response });
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'An error occurred while processing the completion request';
      const statusCode = errorMessage.includes('PDF') ? 400 : 500;

      res.status(statusCode).json({
        error: errorMessage,
      });
    }
  },
);

export { completionRouter };
