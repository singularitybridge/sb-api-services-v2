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
  const { text } = req.body;
  const filename = await generateAudio(text);
  res.send(filename);
});

router.post("/generate/google", async (req, res) => {
  const { text } = req.body;
  const audioBuffer = await synthesizeText(text);
  res.send(audioBuffer);
  // You can then save the audioBuffer to a file and send the filename as response
});


export default router;
