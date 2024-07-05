import express from 'express';
import multer from 'multer';
import {
  transcribeAudioGoogle,
  transcribeAudioWhisper,
  transcribeAudioWhisperFromURL,
} from '../services/speech.recognition.service';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/transcribe/oai', upload.single('audio'), async (req, res) => {
  const apiKey = req.headers['openai-api-key'] as string;
  const language = req.body.language || 'en'; // Default to English if not specified

  try {
    if (req.file) {
      // Handle file upload
      const oaiWhisperResult = await transcribeAudioWhisper(apiKey, req.file.buffer, language);
      res.send({ text: oaiWhisperResult });
    } else if (req.body.audioURL) {
      // Handle URL-based transcription
      const oaiWhisperResult = await transcribeAudioWhisperFromURL(apiKey, req.body.audioURL, language);
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