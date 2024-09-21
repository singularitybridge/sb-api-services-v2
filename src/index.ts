import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { startAgenda } from './services/agenda/agenda.service';
import { initializeTelegramBots } from './services/telegram.bot';
import { Company } from './models/Company';

const initializeApp = async () => {
  try {
    console.log('Attempting to connect to MongoDB...');
    const dbUri = process.env.MONGODB_URI || '';
    const dbName = process.env.MONGODB_DB_NAME || 'dev';
    await mongoose.connect(dbUri, { dbName });
    console.log(`Successfully connected to MongoDB database: ${dbName}`);

    console.log('Starting Agenda...');
    startAgenda();
    console.log('Agenda started successfully');

    console.log('Initializing Telegram bots...');
    await initializeTelegramBots();
    console.log('Telegram bots initialized for all companies');
  } catch (error) {
    console.error('Error during initialization:', error);
    process.exit(1);
  }
};

initializeApp();

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
import {
  verifyAccess,
  verifyTokenMiddleware,
} from './middleware/auth.middleware';
import { twilioMessagingRouter } from './routes/twilio/messaging.routes';
import { onboardingRouter } from './routes/onboarding.routes';
import { authRouter } from './routes/auth.routes';
import { errorHandler } from './middleware/errorHandler.middleware';
import { fileRouter } from './routes/file.routes';
import { journalRouter } from './routes/journal.routes';
import { jsonbinRouter } from './routes/jsonbin.routes';
import { fluxImageRouter } from './routes/flux.image.routes';
import { perplexityRouter } from './routes/perplexity.routes';
import { sendgridRouter } from './routes/sendgrid.routes';
import { photoRoomRouter } from './routes/photoroom.routes';
import contentFileRouter from './routes/content-file.routes';
import actionDiscoveryRouter from './routes/action-discovery.routes';
import { contentRouter } from './routes/content.routes';
import { contentTypeRouter } from './routes/content-type.routes';

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
app.use('/file', verifyTokenMiddleware, verifyAccess(), fileRouter);
app.use(
  '/content-file',
  verifyTokenMiddleware,
  verifyAccess(),
  contentFileRouter,
);
app.use('/inbox', verifyTokenMiddleware, verifyAccess(), inboxRouter);
app.use('/action', verifyTokenMiddleware, verifyAccess(), actionRouter);
app.use(
  '/action-discovery',
  verifyTokenMiddleware,
  verifyAccess(),
  actionDiscoveryRouter,
);
app.use('/session', verifyTokenMiddleware, verifyAccess(), sessionRouter);
app.use('/agenda', verifyTokenMiddleware, verifyAccess(), agendaRouter);
app.use('/api', verifyTokenMiddleware, verifyAccess(), verificationRouter);
app.use('/journal', verifyTokenMiddleware, verifyAccess(), journalRouter);
app.use('/onboarding', verifyTokenMiddleware, verifyAccess(), onboardingRouter);
app.use('/jsonbin', verifyTokenMiddleware, verifyAccess(), jsonbinRouter);
app.use('/flux-image', verifyTokenMiddleware, verifyAccess(), fluxImageRouter);
app.use('/perplexity', verifyTokenMiddleware, verifyAccess(), perplexityRouter);
app.use('/sendgrid', verifyTokenMiddleware, verifyAccess(), sendgridRouter);
app.use('/photoroom', verifyTokenMiddleware, verifyAccess(), photoRoomRouter);
app.use('/content', verifyTokenMiddleware, verifyAccess(), contentRouter);
app.use(
  '/content-types',
  verifyTokenMiddleware,
  verifyAccess(),
  contentTypeRouter,
);

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
