import express from 'express';
import { googleLogin } from '../services/googleAuth.service';

const systemUserRouter = express.Router();


systemUserRouter.post('/login', async (req, res) => {
  console.log('called company router');
  const { user, sessionToken } = await googleLogin(req.body.token);
  res.json({ user, sessionToken });
});


export { systemUserRouter as googleAuthRouter };

