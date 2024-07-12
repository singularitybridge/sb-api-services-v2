/// file_path: src/routes/auth.routes.ts
import express from 'express';
import { extractTokenFromHeader, verifyToken } from '../services/token.service';
import { googleLogin, verifyBetaKey } from '../services/googleAuth.service';

const authRouter = express.Router();

authRouter.post('/verify-token', async (req, res) => {
  try {
    console.log('Received authorization header:', req.headers.authorization); // Log the entire authorization header
    const token = extractTokenFromHeader(req.headers.authorization);
    console.log('Extracted token:', token); // Log the extracted token
    const { company } = await verifyToken(token);
    
    res.json({ 
      message: 'Token is valid',
      company
    });
  } catch (error) {
    console.error('Token verification failed:', error);
    res.status(401).json({ message: 'Invalid token', error: (error as any).message });
  }
});



authRouter.post('/google/login', async (req, res) => {
  console.log('called google login route');
  try {
    const { user, sessionToken, isNewUser } = await googleLogin(req.body.token);
    res.json({ user, sessionToken, isNewUser });
  } catch (error) {
    res.status(500).json({ error: 'Failed to login with Google' });
  }
});

authRouter.post('/beta-key', async (req, res) => {
  const { betaKey } = req.body;
  try {
    const isValid = await verifyBetaKey(betaKey);
    res.json({ isValid });
  } catch (error) {
    res.status(500).json({ error: 'Failed to verify beta key' });
  }
});

export { authRouter };