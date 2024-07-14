/// file_path: src/routes/tts.routes.ts
import express from 'express';
import { generateAudio } from '../services/11labs.service';
import { synthesizeText } from '../services/google.tts.service';
import { generateSpeech } from '../services/oai.speech.service';
import { getApiKey } from '../services/api.key.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

const router = express.Router();


router.post('/generate/11labs', async (req: AuthenticatedRequest, res) => {
  const { text, voiceId, modelId } = req.body;
  const apiKey = await getApiKey(req.company._id, 'elevenlabs');
  if (apiKey === 'not set') {
    return res.status(400).json({ error: 'ElevenLabs API key is not set' });
  }
  const fileInfo = await generateAudio(text, voiceId, modelId);
  res.send(fileInfo);
});

router.post('/generate/google', async (req: AuthenticatedRequest, res) => {
  const { text, voiceLanguageCode, voiceName } = req.body;
  const apiKey = await getApiKey(req.company._id, 'google');
  if (apiKey === 'not set') {
    return res.status(400).json({ error: 'Google API key is not set' });
  }
  const fileInfo = await synthesizeText(text, voiceLanguageCode, voiceName);
  res.send(fileInfo);
});

router.post('/generate/oai', async (req: AuthenticatedRequest, res) => {
  try {
    console.log('Received request for /generate/oai:', req.body);
    const { text, voice } = req.body;
    const apiKey = await getApiKey(req.company._id, 'openai');
    if (apiKey === 'not set') {
      throw new Error('OpenAI API key is not set');
    }
    console.log('Calling generateSpeech...');
    const fileInfo = await generateSpeech(apiKey, text, voice);
    console.log('Generated speech successfully:', fileInfo);
    res.send(fileInfo);
  } catch (error: unknown) {
    console.error('Error in /generate/oai route:', error);
    
    let errorMessage = 'An unknown error occurred';
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }
    
    res.status(500).send({ error: 'Internal server error', details: errorMessage });
  }
});


export default router;
