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
import { verifyAccess, verifyTokenMiddleware } from './middleware/auth.middleware';
import { twilioMessagingRouter } from './routes/twilio/messaging.routes';
import { onboardingRouter } from './routes/onboarding.routes';
import { authRouter } from './routes/auth.routes';
import { errorHandler } from './middleware/errorHandler.middleware';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors());

// Public routes
app.use('/auth', authRouter);
app.use('/policy', policyRouter);

// Routes that only require authentication
app.use('/tts', verifyTokenMiddleware, ttsRouter);
app.use('/stt', verifyTokenMiddleware, sttRouter);
app.use('/twilio/voice', verifyTokenMiddleware, twilioVoiceRouter);
app.use('/twilio/messaging', verifyTokenMiddleware, twilioMessagingRouter);

// Routes that require company-specific access
app.use('/assistant', verifyTokenMiddleware, verifyAccess(), assistantRouter);
app.use('/company', verifyTokenMiddleware, verifyAccess(), companyRouter);
app.use('/user', verifyTokenMiddleware, verifyAccess(), userRouter);
app.use('/inbox', verifyTokenMiddleware, verifyAccess(), inboxRouter);
app.use('/action', verifyTokenMiddleware, verifyAccess(), actionRouter);
app.use('/session', verifyTokenMiddleware, verifyAccess(),  sessionRouter);
app.use('/agenda', verifyTokenMiddleware, verifyAccess(), agendaRouter);
app.use('/api', verifyTokenMiddleware, verifyAccess(), verificationRouter);
app.use('/onboarding', verifyTokenMiddleware, verifyAccess() , onboardingRouter);


// Admin-only routes - to be added later
//app.use('/admin', verifyTokenMiddleware, verifyAccess(true), adminRouter);


// error handler
app.use(errorHandler);





export default app;

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}
