import { Express, Request, Response, NextFunction } from 'express';
import nylasRouter from './routes';

/**
 * Registers all Nylas routes on the Express app.
 * Handles both primary and backward-compatible paths.
 *
 * Routes registered:
 * - POST /api/integrations/nylas/auth/link-grant (public - V3 OAuth callback)
 * - GET /api/integrations/nylas/auth/grant/:userId (authenticated)
 * - DELETE /api/integrations/nylas/auth/grant/:userId (admin only)
 * - GET /api/integrations/nylas/auth/company-grants/:companyId (admin only)
 * - POST /api/integrations/nylas/auth/webhooks/nylas/callback (public - V3 webhooks)
 *
 * @param app - Express application instance
 */
export function registerNylasRoutes(app: Express): void {
  // Primary path (new structure)
  // All Nylas auth, grant management, and webhook routes
  app.use('/api/integrations/nylas/auth', nylasRouter);

  // Backward compatibility for V3 microservice (transitional)
  // Redirects /api/nylas-auth/* to nylasRouter
  // TODO: Remove after V3 microservice is updated to use new path
  app.use('/api/nylas-auth', (req: Request, res: Response, next: NextFunction) => {
    console.warn(
      `[DEPRECATED] /api/nylas-auth${req.path} → Use /api/integrations/nylas/auth`,
    );
    req.url = req.path; // Preserve the original path for router matching
    nylasRouter(req, res, next);
  });
}
