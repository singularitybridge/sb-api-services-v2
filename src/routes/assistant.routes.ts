import express from 'express';
import { threadRouter } from './assistant/thread.routes';
import { assistantRouter } from './assistant/assistant.routes';
import { completionRouter } from './assistant/completion.routes';
import { executeHandler } from './assistant/execute.routes'; // Import the handler function
import workspaceExecuteRouter from './assistant/workspace-execute.routes'; // Import workspace execute router
// validateApiKeys removed — no longer needed
import { validateObjectId } from '../utils/validation';

const router = express.Router();

// Mount specific routes from threadRouter
router.post('/user-input', threadRouter);

// Mount other routes
router.use('/thread', threadRouter);
router.use('/completion', completionRouter);

// Execute handler with proper parameter handling
// Removed validateObjectId since we now accept names too
router.post(
  '/:assistantId/execute',
  executeHandler,
);

// Workspace execute handler for bidirectional workspace communication
router.use('/', workspaceExecuteRouter);

// This should be last to avoid catching other routes
router.use('/', assistantRouter); // Handles routes like /assistant, /assistant/:id

export { router as assistantRouter };
