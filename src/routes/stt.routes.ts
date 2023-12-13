import express from "express";
import {
  transcribeAudioGoogle,
  transcribeAudioWhisper,
} from "../services/speech.recognition.service";

const router = express.Router();

router.post("/transcribe/oai", async (req, res) => {
  const { audioURL } = req.body;
  const oaiWhipserResult = await transcribeAudioWhisper(audioURL);
  res.send({
    oaiWhipserResult,
  });
});

router.post("/transcribe/gcp", async (req, res) => {
  const { audioURL } = req.body;
  const googleResult = await transcribeAudioGoogle(audioURL);
  res.send({
    googleResult,
  });
});

export default router;
