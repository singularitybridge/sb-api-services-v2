import { Router } from 'express';
import { ApiKeyController } from '../controllers/apiKey.controller';
import {
  verifyTokenMiddleware,
  verifyAccess,
} from '../middleware/auth.middleware';

const router = Router();

// All API key routes require authentication
router.use(verifyTokenMiddleware);

// Create a new API key
router.post('/', verifyAccess(), ApiKeyController.createApiKey);

// List all API keys for the authenticated user
router.get('/', verifyAccess(), ApiKeyController.listApiKeys);

// Revoke an API key
router.delete('/:keyId', verifyAccess(), ApiKeyController.revokeApiKey);

export default router;

