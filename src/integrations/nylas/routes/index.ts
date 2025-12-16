/**
 * Nylas Routes - Router Aggregator
 *
 * Combines auth and webhook routes for the Nylas integration
 */

import { Router } from 'express';
import authRouter from './auth.routes';
import webhookRouter from './webhook.routes';

const router = Router();

// Auth endpoints (OAuth callbacks and grant management)
router.use('/', authRouter);

// Webhook endpoints
router.use('/webhooks/nylas', webhookRouter);

export default router;
