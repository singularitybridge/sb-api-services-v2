import express from 'express';
import { threadRouter } from './assistant/thread.routes';
import { assistantRouter } from './assistant/assistant.routes';
import { completionRouter } from './assistant/completion.routes';

const router = express.Router();

// Mount specific routes from threadRouter
router.post('/user-input', threadRouter);

// Mount other routes
router.use('/thread', threadRouter);
router.use('/', assistantRouter);
router.use('/completion', completionRouter);

export { router as assistantRouter };