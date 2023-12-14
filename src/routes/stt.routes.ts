import express from 'express';
import {
  transcribeAudioGoogle,
  transcribeAudioWhisper,
} from '../services/speech.recognition.service';

const router = express.Router();

router.post('/transcribe/oai', async (req, res) => {
  const { audioURL } = req.body;
  const oaiWhipserResult = await transcribeAudioWhisper(audioURL);
  res.send({
    text: oaiWhipserResult,
  });
});

router.post('/transcribe/gcp', async (req, res) => {
  const { audioURL } = req.body;
  const googleResult = await transcribeAudioGoogle(audioURL);
  res.send({
    text: googleResult,
  });
});

export default router;
