import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { startAgenda } from './integrations/agenda/agenda.service';
import { initializeTelegramBots } from './services/telegram.bot';
import { initializeWebSocket } from './services/websocket';
import http from 'http';

const initializeApp = async () => {
  try {
    console.log('Attempting to connect to MongoDB...');
    const dbUri = process.env.MONGODB_URI || '';
    const dbName = process.env.MONGODB_DB_NAME || 'dev';
    await mongoose.connect(dbUri, { dbName });
    console.log(`Successfully connected to MongoDB database: ${dbName}`);

    console.log('Starting Agenda...');
    await startAgenda();
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
import { jsonbinRouter } from './routes/jsonbin.routes';
import contentFileRouter from './routes/content-file.routes';
import { contentRouter } from './routes/content.routes';
import { contentTypeRouter } from './routes/content-type.routes';
import integrationRouter from './routes/integration.routes';

const app = express();
const port = process.env.PORT || 3000;

// Create HTTP server instance
const server = http.createServer(app);

// Initialize WebSocket service
const io = initializeWebSocket(server);

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
app.use('/session', verifyTokenMiddleware, verifyAccess(), sessionRouter);
app.use('/api', verifyTokenMiddleware, verifyAccess(), verificationRouter);
app.use('/onboarding', verifyTokenMiddleware, verifyAccess(), onboardingRouter);
app.use('/jsonbin', verifyTokenMiddleware, verifyAccess(), jsonbinRouter);
app.use('/content', verifyTokenMiddleware, verifyAccess(), contentRouter);
app.use(
  '/content-type',
  verifyTokenMiddleware,
  verifyAccess(),
  contentTypeRouter,
);
app.use(
  '/integrations',
  verifyTokenMiddleware,
  verifyAccess(),
  integrationRouter
);

// Admin-only routes - to be added later
//app.use('/admin', verifyTokenMiddleware, verifyAccess(true), adminRouter);

// error handler
app.use(errorHandler);

export default app;

if (process.env.NODE_ENV !== 'test') {
  // Use the HTTP server instead of the Express app to listen
  server.listen(port, () => {
    console.log(`Server is running on port ${port}`);
    console.log(`WebSocket server is available at ws://localhost:${port}/realtime`);
  });
}
