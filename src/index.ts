/// file_path: src/index.ts
import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { startAgenda } from './services/agenda/agenda.service';

mongoose
  .connect(`${process.env.MONGODB_URI}/sb` as string)
  .then(() => {
    console.log('Successfully connected to MongoDB');
    startAgenda();
  })
  .catch((error) => console.error('Connection error', error));

import express from 'express';
import {
  generateAuthUrl,
  initGoogleCalendar,
} from './services/google.calendar.service';


import cors from 'cors';
import policyRouter from './routes/policy.routes';

import ttsRouter from './routes/tts.routes';
import sttRouter from './routes/stt.routes';
import { twilioVoiceRouter } from './routes/omni_channel/omni.twilio.voice.routes';
import { agendaRouter } from './routes/agenda.routes';
import { assistantRouter } from './routes/assistant.routes';
import { sessionRouter } from './routes/session.routes';
import { companyRouter } from './routes/company.routes';
import { userRouter } from './routes/user.routes';
import { inboxRouter } from './routes/inbox.routes';
import { actionRouter } from './routes/action.routes';
import { verificationRouter } from './routes/verification.routes';
import { verifyTokenMiddleware } from './middleware/auth.middleware';
import { twilioMessagingRouter } from './routes/twilio/messaging.routes';
import { onboardingRouter } from './routes/onboarding.routes';
import { authRouter } from './routes/auth.routes';

const app = express();
const port = process.env.PORT || 3000;


initGoogleCalendar();
generateAuthUrl();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors());

app.use('/auth', authRouter);
app.use('/policy', policyRouter);
app.use('/twilio/voice', verifyTokenMiddleware, twilioVoiceRouter);
app.use('/twilio/messaging', verifyTokenMiddleware, twilioMessagingRouter);
app.use('/tts', verifyTokenMiddleware, ttsRouter);
app.use('/stt', verifyTokenMiddleware, sttRouter);
app.use('/session', verifyTokenMiddleware, sessionRouter);
app.use('/agenda', verifyTokenMiddleware, agendaRouter);
app.use('/assistant', verifyTokenMiddleware, assistantRouter);
app.use('/company', companyRouter);
app.use('/user', userRouter);
app.use('/inbox', verifyTokenMiddleware, inboxRouter);
app.use('/action', verifyTokenMiddleware, actionRouter);
app.use('/api', verifyTokenMiddleware, verificationRouter);
app.use('/onboarding', onboardingRouter);

export default app;

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}
