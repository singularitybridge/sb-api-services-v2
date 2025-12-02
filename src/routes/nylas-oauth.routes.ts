/**
 * Nylas OAuth Routes
 *
 * Handles per-user OAuth flow for connecting email/calendar accounts
 *
 * Routes:
 * - GET  /api/nylas/oauth/auth        - Initiate OAuth (get authorization URL)
 * - GET  /api/nylas/oauth/callback    - Handle OAuth callback
 * - GET  /api/nylas/oauth/status      - Check connection status
 * - POST /api/nylas/oauth/disconnect  - Disconnect account
 */

import express, { Router, Request, Response, NextFunction } from 'express';
import { verifyAccess, AuthenticatedRequest } from '../middleware/auth.middleware';
import {
  getAuthorizationUrl,
  exchangeCodeForGrant,
  storeGrant,
  disconnectAccount,
  getAccountStatus,
  parseState,
  safeDisconnectWithBackup,
  cleanupRelatedData,
  verifyDeletionSafety,
  rollbackDeletion,
  listBackups,
} from '../services/nylas-oauth.service';
import { User } from '../models/User';
import { Company } from '../models/Company';

const router: Router = express.Router();

// ==========================================
// Query Token Authentication Middleware
// ==========================================

/**
 * Middleware to authenticate via token query parameter
 * This allows direct OAuth URL access without frontend session
 *
 * Usage: http://localhost:3000/api/nylas/oauth/auth?provider=google&token=abc123
 *
 * If token is valid, sets req.user and req.company, then continues to next middleware
 * If token is invalid or missing, continues without setting user (existing auth will handle it)
 */
async function authenticateQueryToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Check if token is provided in query parameter
    const queryToken = req.query.token as string | undefined;

    // If no query token, skip this middleware (let regular auth handle it)
    if (!queryToken) {
      return next();
    }

    console.log('[OAUTH TOKEN AUTH] Attempting authentication via query token');

    // Find user with matching auth token
    const user = await User.findOne({
      'authTokens.token': queryToken,
    }).lean();

    if (!user) {
      console.log('[OAUTH TOKEN AUTH] Invalid token provided');
      return next(); // Let regular auth middleware handle the error
    }

    // Token found, validate it's not expired (optional - tokens don't have expiry by default)
    const tokenObj = user.authTokens?.find(t => t.token === queryToken);
    if (!tokenObj) {
      console.log('[OAUTH TOKEN AUTH] Token not found in user tokens');
      return next();
    }

    // Get user's company
    const company = await Company.findById(user.companyId).lean();
    if (!company) {
      console.log('[OAUTH TOKEN AUTH] Company not found for user');
      return next();
    }

    // Set authenticated user and company on request
    req.user = user as any;
    req.company = company as any;

    console.log('[OAUTH TOKEN AUTH] Successfully authenticated via query token:', {
      userId: user._id,
      email: user.email,
      companyId: company._id,
    });

    // Continue to next middleware (verifyAccess)
    next();
  } catch (error: any) {
    console.error('[OAUTH TOKEN AUTH] Error:', error.message);
    // Don't fail the request, let regular auth middleware handle it
    next();
  }
}



// ==========================================
// OAuth Initiation
// ==========================================

/**
 * GET /api/nylas/oauth/auth
 * Generate OAuth authorization URL for user to connect their account
 *
 * Query params:
 * - provider: 'google' | 'microsoft' (default: 'google')
 * - redirect: Optional custom redirect URL after completion
 * - token: Optional auth token for direct URL access (without frontend session)
 *
 * Response:
 * - authUrl: URL to redirect user to for authorization
 * - state: State parameter for verification
 */
router.get(
  '/auth',
  authenticateQueryToken, // Try query token auth first
  verifyAccess(),          // Then verify access (either token or session auth)
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?._id.toString();
      const companyId = req.company?._id.toString();

      if (!userId || !companyId) {
        res.status(401).json({
          success: false,
          error: 'User ID or Company ID missing',
        });
        return;
      }

      const provider = (req.query.provider as 'google' | 'microsoft') || 'google';
      const customRedirect = req.query.redirect as string | undefined;

      // Generate authorization URL
      const { url, state } = await getAuthorizationUrl({
        companyId,
        userId,
        provider,
        state: customRedirect,
      });

      console.log('[NYLAS OAUTH] Generated authorization URL for user:', {
        userId,
        email: req.user?.email,
        provider,
      });

      // If accessed via browser (direct URL), redirect to OAuth
      // If accessed via API/AJAX, return JSON
      const acceptHeader = req.get('accept') || '';
      const isBrowserRequest = acceptHeader.includes('text/html');

      if (isBrowserRequest || req.query.token) {
        // Direct browser access - redirect to Google OAuth
        console.log('[NYLAS OAUTH] Redirecting to Google authorization...');
        res.redirect(url);
      } else {
        // API request - return JSON
        res.json({
          success: true,
          authUrl: url,
          state,
          provider,
        });
      }
    } catch (error: any) {
      console.error('[NYLAS OAUTH] Auth initiation error:', error.message);

      // Check if this is a browser request for better error handling
      const acceptHeader = req.get('accept') || '';
      const isBrowserRequest = acceptHeader.includes('text/html');

      if (isBrowserRequest || req.query.token) {
        // Browser request - redirect to error page
        const errorRedirect = process.env.NYLAS_ERROR_REDIRECT || 'http://localhost:5173/settings/integrations?error=auth_failed';
        res.redirect(`${errorRedirect}&message=${encodeURIComponent(error.message)}`);
      } else {
        // API request - return JSON error
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    }
  }
);

// ==========================================
// OAuth Callback
// ==========================================

/**
 * GET /api/nylas/oauth/callback
 * Handle OAuth callback from Nylas
 * Exchanges authorization code for grant and stores it
 *
 * Query params (from Nylas):
 * - code: Authorization code
 * - state: State parameter for verification
 * - error: Error code if authorization failed
 *
 * Redirects to frontend with success/error message
 */
router.get(
  '/callback',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { code, state, error, error_description } = req.query;

      // Check for OAuth errors
      if (error) {
        console.error('[NYLAS OAUTH] Authorization failed:', error, error_description);

        // Redirect to frontend with error
        const errorRedirect = process.env.NYLAS_ERROR_REDIRECT || 'http://localhost:5173/settings/integrations?error=oauth_failed';
        res.redirect(`${errorRedirect}&reason=${encodeURIComponent(error as string)}`);
        return;
      }

      // Validate required parameters
      if (!code || !state) {
        res.status(400).json({
          success: false,
          error: 'Missing code or state parameter',
        });
        return;
      }

      // Parse and validate state
      let parsedState;
      try {
        parsedState = parseState(state as string);
      } catch (error: any) {
        res.status(400).json({
          success: false,
          error: 'Invalid or expired state',
        });
        return;
      }

      const { userId, companyId, custom: customRedirect } = parsedState;

      console.log('[NYLAS OAUTH] Processing callback:', {
        userId,
        companyId,
      });

      // Exchange code for grant
      const grantInfo = await exchangeCodeForGrant(
        code as string,
        companyId,
        userId
      );

      console.log('[NYLAS OAUTH] About to store grant:', {
        hasId: !!grantInfo.id,
        hasEmail: !!grantInfo.email,
        grantId: grantInfo.id,
      });

      // Store grant in database
      await storeGrant(userId, companyId, grantInfo);

      console.log('[NYLAS OAUTH] Grant stored successfully!');

      // Redirect to frontend with success
      const successRedirect = customRedirect || process.env.NYLAS_SUCCESS_REDIRECT || 'http://localhost:5173/settings/integrations?connected=true';
      res.redirect(`${successRedirect}&email=${encodeURIComponent(grantInfo.email)}`);
    } catch (error: any) {
      console.error('[NYLAS OAUTH] Callback error:', error.message);
      console.error('[NYLAS OAUTH] Full error:', error);
      console.error('[NYLAS OAUTH] Error stack:', error.stack);

      // Redirect to frontend with error
      const errorRedirect = process.env.NYLAS_ERROR_REDIRECT || 'http://localhost:5173/settings/integrations?error=connection_failed';
      res.redirect(`${errorRedirect}&message=${encodeURIComponent(error.message)}`);
    }
  }
);

// ==========================================
// Connection Status
// ==========================================

/**
 * GET /api/nylas/oauth/status
 * Check if user has connected Nylas account
 *
 * Response:
 * - connected: boolean
 * - email: string (if connected)
 * - provider: string (if connected)
 * - lastValidated: Date (if connected)
 */
router.get(
  '/status',
  verifyAccess(),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?._id.toString();
      const companyId = req.company?._id.toString();

      if (!userId || !companyId) {
        res.status(401).json({
          success: false,
          error: 'User ID or Company ID missing',
        });
        return;
      }

      const status = await getAccountStatus(userId, companyId);

      res.json({
        success: true,
        ...status,
      });
    } catch (error: any) {
      console.error('[NYLAS OAUTH] Status check error:', error.message);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

// ==========================================
// Disconnect Account
// ==========================================

/**
 * POST /api/nylas/oauth/disconnect
 * Disconnect user's Nylas account
 * Revokes grant and marks account as inactive
 *
 * Response:
 * - success: boolean
 * - message: string
 */
router.post(
  '/disconnect',
  verifyAccess(),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?._id.toString();
      const companyId = req.company?._id.toString();

      if (!userId || !companyId) {
        res.status(401).json({
          success: false,
          error: 'User ID or Company ID missing',
        });
        return;
      }

      await disconnectAccount(userId, companyId);

      res.json({
        success: true,
        message: 'Account disconnected successfully',
      });
    } catch (error: any) {
      console.error('[NYLAS OAUTH] Disconnect error:', error.message);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

// ==========================================
// Safe Deletion & Backup (Admin Only)
// ==========================================

/**
 * POST /api/nylas/oauth/safe-disconnect
 * Safely disconnect user's account with automatic backup
 * Admin only
 *
 * Body:
 * - userId: string (required)
 * - companyId: string (optional, defaults to admin's company)
 *
 * Response:
 * - success: boolean
 * - backupFile: string (backup filename for rollback)
 * - disconnected: boolean
 */
router.post(
  '/safe-disconnect',
  verifyAccess(true), // Admin only
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { userId, companyId } = req.body;

      if (!userId) {
        res.status(400).json({
          success: false,
          error: 'userId is required',
        });
        return;
      }

      const targetCompanyId = companyId || req.company?._id.toString();

      if (!targetCompanyId) {
        res.status(400).json({
          success: false,
          error: 'companyId missing',
        });
        return;
      }

      const result = await safeDisconnectWithBackup(userId, targetCompanyId);

      res.json({
        success: true,
        ...result,
        message: result.disconnected
          ? 'Account disconnected safely with backup created'
          : 'No account to disconnect (already disconnected), backup created',
      });
    } catch (error: any) {
      console.error('[NYLAS OAUTH] Safe disconnect error:', error.message);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * POST /api/nylas/oauth/cleanup
 * Clean up related data after disconnection
 * Deactivates EmailProfiles and deletes cache
 * Admin only
 *
 * Body:
 * - userId: string (required)
 * - companyId: string (optional, defaults to admin's company)
 *
 * Response:
 * - success: boolean
 * - profilesDeactivated: number
 * - cacheDeleted: number
 */
router.post(
  '/cleanup',
  verifyAccess(true), // Admin only
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { userId, companyId } = req.body;

      if (!userId) {
        res.status(400).json({
          success: false,
          error: 'userId is required',
        });
        return;
      }

      const targetCompanyId = companyId || req.company?._id.toString();

      if (!targetCompanyId) {
        res.status(400).json({
          success: false,
          error: 'companyId missing',
        });
        return;
      }

      const result = await cleanupRelatedData(userId, targetCompanyId);

      res.json({
        success: true,
        ...result,
        message: 'Related data cleaned up successfully',
      });
    } catch (error: any) {
      console.error('[NYLAS OAUTH] Cleanup error:', error.message);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * GET /api/nylas/oauth/verify-deletion/:userId
 * Verify deletion was safe
 * Admin only
 *
 * Params:
 * - userId: string
 *
 * Query:
 * - companyId: string (optional, defaults to admin's company)
 *
 * Response:
 * - success: boolean
 * - verification: DeletionVerification
 */
router.get(
  '/verify-deletion/:userId',
  verifyAccess(true), // Admin only
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;
      const companyId = (req.query.companyId as string) || req.company?._id.toString();

      if (!companyId) {
        res.status(400).json({
          success: false,
          error: 'companyId missing',
        });
        return;
      }

      const verification = await verifyDeletionSafety(userId, companyId);

      const allPassed = Object.values(verification).every(
        v => v === true || (Array.isArray(v) && v.length === 0)
      );

      res.json({
        success: true,
        verification,
        allPassed,
        message: allPassed
          ? 'All verification checks passed'
          : 'Some verification checks failed',
      });
    } catch (error: any) {
      console.error('[NYLAS OAUTH] Verification error:', error.message);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * POST /api/nylas/oauth/rollback
 * Rollback deletion from backup
 * Admin only
 *
 * Body:
 * - userId: string (required)
 * - companyId: string (required)
 * - backupFile: string (required)
 *
 * Response:
 * - success: boolean
 * - restored: boolean
 * - message: string
 */
router.post(
  '/rollback',
  verifyAccess(true), // Admin only
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { userId, companyId, backupFile } = req.body;

      if (!userId || !companyId || !backupFile) {
        res.status(400).json({
          success: false,
          error: 'userId, companyId, and backupFile are required',
        });
        return;
      }

      const result = await rollbackDeletion(userId, companyId, backupFile);

      res.json({
        success: true,
        ...result,
      });
    } catch (error: any) {
      console.error('[NYLAS OAUTH] Rollback error:', error.message);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * GET /api/nylas/oauth/backups/:userId
 * List available backups for a user
 * Admin only
 *
 * Params:
 * - userId: string
 *
 * Response:
 * - success: boolean
 * - backups: Array<{ fileName, timestamp, size }>
 */
router.get(
  '/backups/:userId',
  verifyAccess(true), // Admin only
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;

      const backups = await listBackups(userId);

      res.json({
        success: true,
        backups,
        count: backups.length,
      });
    } catch (error: any) {
      console.error('[NYLAS OAUTH] List backups error:', error.message);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

export default router;
