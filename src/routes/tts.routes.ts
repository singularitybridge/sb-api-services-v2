import express from 'express';
import { synthesizeText } from '../services/google.tts.service';
import { generateSpeech } from '../services/oai.speech.service';
import { getApiKey, validateApiKeys } from '../services/api.key.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { generateAudio } from '../integrations/elevenlabs/elevenlabs.service';

const router = express.Router();

router.post(
  '/generate/11labs',
  validateApiKeys(['labs11_api_key']),
  async (req: AuthenticatedRequest, res) => {
    const { text, voiceId, modelId } = req.body;
    const apiKey = await getApiKey(req.company._id, 'labs11_api_key');

    if (apiKey === null) {
      return res.status(400).json({ error: '11labs API key is not set' });
    }

    const fileInfo = await generateAudio(apiKey, text, voiceId, modelId);
    res.send(fileInfo);
  },
);

router.post('/generate/google', async (req: AuthenticatedRequest, res) => {
  const { text, voiceLanguageCode, voiceName } = req.body;
  const apiKey = await getApiKey(req.company._id, 'google_api_key');
  if (apiKey === 'not set') {
    return res.status(400).json({ error: 'Google API key is not set' });
  }
  const fileInfo = await synthesizeText(text, voiceLanguageCode, voiceName);
  res.send(fileInfo);
});

router.post(
  '/generate/oai',
  validateApiKeys(['openai_api_key']),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { text, voice, textLimit, filename } = req.body;
      const openaiApiKey = await getApiKey(req.company._id, 'openai_api_key');

      if (!openaiApiKey) {
        res.status(401).send('OpenAI API key not found');
        return;
      }

      const fileInfo = await generateSpeech(openaiApiKey, text, voice, 'tts-1', textLimit, filename);
      res.send(fileInfo);
    } catch (error: unknown) {
      console.error('Error in /generate/oai route:', error);

      let errorMessage = 'An unknown error occurred';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }

      res
        .status(500)
        .send({ error: 'Internal server error', details: errorMessage });
    }
  },
);

export default router;
