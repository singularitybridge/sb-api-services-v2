import { ApiKey, IApiKey } from '../models/ApiKey';
import { IUser } from '../models/User';
import { ICompany } from '../models/Company';
import { logger } from '../utils/logger';

interface CreateApiKeyInput {
  name: string;
  userId: string;
  companyId: string;
  permissions?: string[];
  expiresInDays?: number;
}

interface ApiKeyResponse {
  id: string;
  name: string;
  key?: string; // Only returned on creation
  permissions?: string[];
  expiresAt: Date;
  createdAt: Date;
}

export class ApiKeyService {
  /**
   * Create a new API key
   */
  static async createApiKey(input: CreateApiKeyInput): Promise<ApiKeyResponse> {
    try {
      const {
        name,
        userId,
        companyId,
        permissions,
        expiresInDays = 365,
      } = input;

      // Generate API key and hash
      const { key, hashedKey } = (ApiKey as any).generateApiKey();

      // Calculate expiration date (default 1 year)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);

      // Create API key document - DO NOT store the raw key
      const apiKey = await ApiKey.create({
        name,
        hashedKey,
        userId,
        companyId,
        permissions,
        expiresAt,
        isActive: true,
      });

      logger.info('API key created', {
        userId,
        companyId,
        apiKeyId: apiKey._id,
        name,
      });

      // Return the key only on creation
      return {
        id: apiKey._id.toString(),
        name: apiKey.name,
        key, // This is the only time we return the actual key
        permissions: apiKey.permissions,
        expiresAt: apiKey.expiresAt,
        createdAt: apiKey.createdAt,
      };
    } catch (error) {
      logger.error('Error creating API key', { error, input });
      throw error;
    }
  }

  /**
   * List all API keys for a user/company
   */
  static async listApiKeys(
    userId: string,
    companyId: string,
  ): Promise<ApiKeyResponse[]> {
    try {
      const apiKeys = await ApiKey.find({
        userId,
        companyId,
        isActive: true,
      }).select('-key -hashedKey');

      return apiKeys.map((key) => ({
        id: key._id.toString(),
        name: key.name,
        permissions: key.permissions,
        expiresAt: key.expiresAt,
        createdAt: key.createdAt,
      }));
    } catch (error) {
      logger.error('Error listing API keys', { error, userId, companyId });
      throw error;
    }
  }

  /**
   * Revoke an API key
   */
  static async revokeApiKey(
    apiKeyId: string,
    userId: string,
    companyId: string,
  ): Promise<void> {
    try {
      const result = await ApiKey.updateOne(
        {
          _id: apiKeyId,
          userId,
          companyId,
        },
        {
          isActive: false,
        },
      );

      if (result.matchedCount === 0) {
        throw new Error('API key not found or access denied');
      }

      logger.info('API key revoked', { apiKeyId, userId, companyId });
    } catch (error) {
      logger.error('Error revoking API key', {
        error,
        apiKeyId,
        userId,
        companyId,
      });
      throw error;
    }
  }

  /**
   * Validate an API key and return user/company info
   */
  static async validateApiKey(
    apiKey: string,
  ): Promise<{ user: IUser; company: ICompany; apiKeyDoc: IApiKey } | null> {
    try {
      // Hash the provided key
      const hashedKey = (ApiKey as any).hashApiKey(apiKey);

      // Find the API key
      const apiKeyDoc = await ApiKey.findOne({
        hashedKey,
        isActive: true,
        expiresAt: { $gt: new Date() },
      })
        .populate('userId')
        .populate('companyId');

      if (!apiKeyDoc) {
        return null;
      }

      // Update last used timestamp
      apiKeyDoc.lastUsed = new Date();
      await apiKeyDoc.save();

      return {
        user: apiKeyDoc.userId as unknown as IUser,
        company: apiKeyDoc.companyId as unknown as ICompany,
        apiKeyDoc,
      };
    } catch (error) {
      logger.error('Error validating API key', { error });
      return null;
    }
  }

  /**
   * Clean up expired API keys (can be run as a scheduled job)
   */
  static async cleanupExpiredKeys(): Promise<number> {
    try {
      const result = await ApiKey.deleteMany({
        expiresAt: { $lt: new Date() },
      });

      logger.info('Cleaned up expired API keys', {
        count: result.deletedCount,
      });
      return result.deletedCount || 0;
    } catch (error) {
      logger.error('Error cleaning up expired API keys', { error });
      return 0;
    }
  }
}
