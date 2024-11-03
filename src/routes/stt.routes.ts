//file_path:src/routes/stt.routes.ts
import express from 'express';
import multer from 'multer';
import {
  transcribeAudioGoogle,
  transcribeAudioWhisper,
  transcribeAudioWhisperFromURL,
} from '../services/speech.recognition.service';
import { getApiKey, validateApiKeys } from '../services/api.key.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/transcribe/oai', 
  validateApiKeys(['openai_api_key']),
  upload.single('audio'), 
  async (req: AuthenticatedRequest, res) => {
    const language = req.body.language || 'en'; // Default to English if not specified

    try {

      const openaiApiKey = await getApiKey(req.company._id, 'openai_api_key');

      if (!openaiApiKey) {
        res.status(401).send('OpenAI API key not found');
        return;
      }

      if (req.file) {
        const oaiWhisperResult = await transcribeAudioWhisper(openaiApiKey, req.file.buffer, language);
        res.send({ text: oaiWhisperResult });
      } else if (req.body.audioURL) {
        const oaiWhisperResult = await transcribeAudioWhisperFromURL(openaiApiKey, req.body.audioURL, language);
        res.send({ text: oaiWhisperResult });
      } else {
        res.status(400).send('No audio file uploaded or URL provided');
      }
    } catch (error) {
      console.error('Error in /transcribe/oai:', error);
      res.status(500).send('Error transcribing audio');
    }
});



router.post('/transcribe/gcp', async (req, res) => {
  const { audioURL, language = 'en-US' } = req.body; // Default to English (US) if not specified
  const googleResult = await transcribeAudioGoogle(audioURL, language);
  res.send({
    text: googleResult,
  });
});

export default router;