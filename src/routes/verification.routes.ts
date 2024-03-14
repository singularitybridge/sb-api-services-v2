// routes/verification.routes.ts
import express from 'express';
import { verifyApiKey } from '../services/verification.service'; // This service will be created in step 2

const verificationRouter = express.Router();

verificationRouter.post('/verify-api-key', async (req, res) => {
  const { apiKey, apiKeyId } = req.body;

  try {
    const isValid = await verifyApiKey(apiKey, apiKeyId);
    res.json({ apiKeyId, isValid });
  } catch (error: any) {
    res
      .status(500)
      .send({ message: `Error verifying API key: ${error.message}` });
  }
});

export { verificationRouter };
