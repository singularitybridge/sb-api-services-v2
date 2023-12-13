import express from "express";
import { generateAudio } from "../services/11labs.service";
import { synthesizeText } from "../services/google.tts.service";

const router = express.Router();

router.get("/files/:filename", async (req, res) => {
  const { filename } = req.params;
  const filePath = `./files/${filename}`;
  res.download(filePath);
});

router.post("/generate/11labs", async (req, res) => {
  const { text, voiceId, modelId } = req.body;
  const fileInfo = await generateAudio(text, voiceId, modelId);
  res.send(fileInfo);
});

router.post("/generate/google", async (req, res) => {
  const { text, voiceLanguageCode, voiceName } = req.body;
  const fileInfo = await synthesizeText(text, voiceLanguageCode, voiceName);
  res.send(fileInfo);  
});


export default router;
