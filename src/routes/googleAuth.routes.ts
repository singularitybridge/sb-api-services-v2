import express from 'express';
import { getSystemUsers, googleLogin } from '../services/googleAuth.service';

const systemUserRouter = express.Router();


systemUserRouter.post('/login', async (req, res) => {
  console.log('called company router');
  const { user, sessionToken } = await googleLogin(req.body.token);
  res.json({ user, sessionToken });
});


systemUserRouter.get('/', async (req, res) => {
  const companies = await getSystemUsers();
  res.json(companies);
});

export { systemUserRouter as googleAuthRouter };
