import express from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { getApiKey } from '../../services/api.key.service';
import { getCompletionResponse } from '../../services/oai.completion.service';

const completionRouter = express.Router();

completionRouter.post(
  '/',
  async (req: AuthenticatedRequest, res) => {
    const {
      systemPrompt,
      userInput,
      model = 'gpt-4.1-mini',
      temperature,
      pdfUrl,
      imageUrl,
      imageBase64,
      maxOutputTokens,
      maxTokens: legacyMaxTokens, // Support old name for backwards compatibility
    } = req.body;

    // Use maxOutputTokens if provided, fall back to maxTokens for backwards compatibility
    const maxTokens = maxOutputTokens || legacyMaxTokens;

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
        imageUrl,
        imageBase64,
        maxTokens,
      );
      res.json({ content: response });
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'An error occurred while processing the completion request';
      const statusCode =
        errorMessage.includes('PDF') || errorMessage.includes('image')
          ? 400
          : 500;

      res.status(statusCode).json({
        error: errorMessage,
      });
    }
  },
);

export { completionRouter };
