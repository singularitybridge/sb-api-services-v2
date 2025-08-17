import { Request, Response } from 'express';
import { ApiKeyService } from '../services/apiKey.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';

export class ApiKeyController {
  /**
   * Create a new API key
   * @route POST /api/keys
   */
  static async createApiKey(req: AuthenticatedRequest, res: Response) {
    try {
      const { name, permissions, expiresInDays } = req.body;

      if (!name) {
        return res.status(400).json({ message: 'API key name is required' });
      }

      const apiKey = await ApiKeyService.createApiKey({
        name,
        userId: req.user!._id.toString(),
        companyId: req.company!._id.toString(),
        permissions,
        expiresInDays,
      });

      res.status(201).json({
        message:
          'API key created successfully. Please save this key securely as it will not be shown again.',
        apiKey,
      });
    } catch (error: any) {
      logger.error('Error in createApiKey controller', { error });
      res
        .status(500)
        .json({ message: 'Failed to create API key', error: error.message });
    }
  }

  /**
   * List all API keys for the authenticated user
   * @route GET /api/keys
   */
  static async listApiKeys(req: AuthenticatedRequest, res: Response) {
    try {
      const apiKeys = await ApiKeyService.listApiKeys(
        req.user!._id.toString(),
        req.company!._id.toString(),
      );

      res.json({ apiKeys });
    } catch (error: any) {
      logger.error('Error in listApiKeys controller', { error });
      res
        .status(500)
        .json({ message: 'Failed to list API keys', error: error.message });
    }
  }

  /**
   * Revoke an API key
   * @route DELETE /api/keys/:keyId
   */
  static async revokeApiKey(req: AuthenticatedRequest, res: Response) {
    try {
      const { keyId } = req.params;

      if (!keyId) {
        return res.status(400).json({ message: 'API key ID is required' });
      }

      await ApiKeyService.revokeApiKey(
        keyId,
        req.user!._id.toString(),
        req.company!._id.toString(),
      );

      res.json({ message: 'API key revoked successfully' });
    } catch (error: any) {
      logger.error('Error in revokeApiKey controller', { error });

      if (error.message === 'API key not found or access denied') {
        return res.status(404).json({ message: error.message });
      }

      res
        .status(500)
        .json({ message: 'Failed to revoke API key', error: error.message });
    }
  }
}
