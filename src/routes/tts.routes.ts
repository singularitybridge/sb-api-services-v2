import express from 'express';
import { generateAudio } from '../services/11labs.service';
import { synthesizeText } from '../services/google.tts.service';
import path from 'path';
import { generateSpeech } from '../services/oai.speech.service';

const router = express.Router();

router.get('/files/:filename', async (req, res) => {
  const { filename } = req.params;
  const filePath = path.resolve(__dirname, `../../files/${filename}`);
  res.sendFile(filePath);
});

router.post('/generate/11labs', async (req, res) => {
  const { text, voiceId, modelId } = req.body;
  const fileInfo = await generateAudio(text, voiceId, modelId);
  res.send(fileInfo);
});

router.post('/generate/google', async (req, res) => {
  const { text, voiceLanguageCode, voiceName } = req.body;
  const fileInfo = await synthesizeText(text, voiceLanguageCode, voiceName);
  res.send(fileInfo);
});

router.post('/generate/oai', async (req, res) => {
  const { text, voice } = req.body;
  const fileInfo = await generateSpeech(text, voice);
  res.send(fileInfo);
});

export default router;
