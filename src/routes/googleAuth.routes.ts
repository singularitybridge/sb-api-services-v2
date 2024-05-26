// File: routes/googleAuth.routes.ts
import express from 'express';
import { googleLogin, verifyBetaKey } from '../services/googleAuth.service';

const googleAuthRouter = express.Router();

googleAuthRouter.post('/google/login', async (req, res) => {
  console.log('called google login route');
  try {
    const { user, sessionToken, isNewUser } = await googleLogin(req.body.token);
    res.json({ user, sessionToken, isNewUser });
  } catch (error) {
    res.status(500).json({ error: 'Failed to login with Google' });
  }
});

googleAuthRouter.post('/beta-key', async (req, res) => {
  const { betaKey } = req.body;
  try {
    const isValid = await verifyBetaKey(betaKey);
    res.json({ isValid });
  } catch (error) {
    res.status(500).json({ error: 'Failed to verify beta key' });
  }
});

export { googleAuthRouter };
