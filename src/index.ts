import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { startAgenda } from './integrations/agenda/agenda.service';
import { initializeTelegramBots } from './services/telegram.bot';
import { initializeWebSocket } from './services/websocket';
import http from 'http';
import { logger } from './utils/logger';

const initializeApp = async () => {
  try {
    logger.info('Attempting to connect to MongoDB...');
    const dbUri = process.env.MONGODB_URI || '';
    const dbName = process.env.MONGODB_DB_NAME || 'dev';
    await mongoose.connect(dbUri, { dbName });
    logger.info(`Successfully connected to MongoDB database: ${dbName}`);

    logger.info('Starting Agenda...');
    await startAgenda();
    logger.info('Agenda started successfully');

    logger.info('Initializing Telegram bots...');
    await initializeTelegramBots();
    logger.info('Telegram bots initialized for all companies');
  } catch (error: any) {
    logger.error('Error during initialization:', { error: error.message, stack: error.stack });
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
import { teamRouter } from './routes/team.routes';
import memoryRouter from './routes/memory.routes'; // Added import for memory router

const app = express();
const port = process.env.PORT || 3000;

// Create HTTP server instance
const server = http.createServer(app);

// Initialize WebSocket service
const io = initializeWebSocket(server);

app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));
app.use(cors());

import compression from 'compression'; // Added for SSE Step 2

// Public routes
app.use('/auth', authRouter);
app.use('/policy', policyRouter);

// SSE Step 2: Skip compression() when SSE is requested for /assistant/user-input
// Note: The task card mentions /api/assistant/user-input.
// Given assistantRouter is mounted at /assistant, this middleware targets /assistant/user-input.
app.use('/assistant/user-input', (req, res, next) => {
  const acceptHeader = req.get('accept');
  // Check if acceptHeader is not undefined and includes 'text/event-stream'
  const wantsSSE = typeof acceptHeader === 'string' && acceptHeader.includes('text/event-stream');
  if (wantsSSE) {
    return next(); // no gzip for SSE
  }
  // Apply compression only if SSE is not requested for this specific route
  return compression()(req, res, next);
});

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
app.use('/teams', verifyTokenMiddleware, verifyAccess(), teamRouter);
app.use('/memory', verifyTokenMiddleware, verifyAccess(), memoryRouter); // Added memory router

// Admin-only routes - to be added later
//app.use('/admin', verifyTokenMiddleware, verifyAccess(true), adminRouter);

// error handler
app.use(errorHandler);

export default app;

if (process.env.NODE_ENV !== 'test') {
  // Use the HTTP server instead of the Express app to listen
  server.listen(port, () => {
    logger.info(`Server is running on port ${port}`);
    logger.info(`WebSocket server is available at ws://localhost:${port}/realtime`);
  });
}
