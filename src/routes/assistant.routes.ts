import express from 'express';
import { threadRouter } from './assistant/thread.routes';
import { assistantRouter } from './assistant/assistant.routes';
import { completionRouter } from './assistant/completion.routes';
import { executeHandler } from './assistant/execute.routes'; // Import the handler function
import { validateApiKeys } from '../services/api.key.service';
import { validateObjectId } from '../utils/validation';

const router = express.Router();

// Mount specific routes from threadRouter
router.post('/user-input', threadRouter);

// Mount other routes
router.use('/thread', threadRouter);
router.use('/completion', completionRouter);

// Execute handler with proper parameter handling
router.post(
  '/:assistantId/execute',
  validateObjectId('assistantId'),
  validateApiKeys(['openai_api_key']),
  executeHandler,
);

// This should be last to avoid catching other routes
router.use('/', assistantRouter); // Handles routes like /assistant, /assistant/:id

export { router as assistantRouter };
