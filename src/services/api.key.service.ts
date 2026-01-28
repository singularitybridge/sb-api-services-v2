import { Company } from '../models/Company';
import { decryptData } from './encryption.service';
import NodeCache from 'node-cache';
import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { getIntegrationApiKey } from './integration-config.service';
import { getIntegrationIdForApiKey } from './integration-registry.service';

/**
 * API Key Service
 *
 * Handles retrieval of API keys with a two-tier lookup:
 * 1. IntegrationConfig (new system) - checked first
 * 2. Company.api_keys (legacy) - fallback
 *
 * The API key to integration mapping is built dynamically from
 * integration.config.json files via integration-registry.service.
 */

// Initialize cache with a 15-minute TTL (time to live)
const apiKeyCache = new NodeCache({ stdTTL: 900 });

/**
 * Get an API key for a company.
 *
 * @param companyId - The company ID
 * @param keyType - The API key name (e.g., 'openai_api_key', 'jira_api_token')
 * @returns The decrypted API key value, or null if not found
 */
export const getApiKey = async (
  companyId: string,
  keyType: string,
): Promise<string | null> => {
  const cacheKey = `${companyId}:${keyType}`;

  // Check cache first
  const cachedKey = apiKeyCache.get<string>(cacheKey);
  if (cachedKey) {
    return cachedKey;
  }

  // 1. Try to get from IntegrationConfig first (new system)
  // Uses dynamic mapping from integration configs
  const integrationId = getIntegrationIdForApiKey(keyType);
  if (integrationId) {
    try {
      const integrationKey = await getIntegrationApiKey(
        companyId,
        integrationId,
        keyType,
      );
      if (integrationKey) {
        // Store in cache
        apiKeyCache.set(cacheKey, integrationKey);
        return integrationKey;
      }
    } catch (error) {
      // If IntegrationConfig lookup fails, fall back to legacy
      console.warn(
        `[getApiKey] IntegrationConfig lookup failed for ${keyType}, falling back to legacy`,
        error,
      );
    }
  }

  // 2. Fall back to legacy Company.api_keys
  const company = await Company.findById(companyId);
  if (!company) {
    throw new Error('Company not found');
  }

  const apiKey = company.api_keys.find((key) => key.key === keyType);
  if (!apiKey) {
    return null;
  }

  const decryptedKey = decryptData({
    value: apiKey.value,
    iv: apiKey.iv,
    tag: apiKey.tag,
  });

  // Store in cache
  apiKeyCache.set(cacheKey, decryptedKey);

  return decryptedKey;
};

/**
 * Set an API key for a company (legacy system).
 * Note: New integrations should use IntegrationConfig instead.
 */
export const setApiKey = async (
  companyId: string,
  keyType: string,
  apiKey: string,
): Promise<void> => {
  const company = await Company.findById(companyId);
  if (!company) {
    throw new Error('Company not found');
  }

  // Implementation of encryption and saving the API key
  // This part depends on your encryption service and how you store API keys
  // ...

  await company.save();

  // Update cache
  updateApiKeyCache(companyId, keyType, apiKey);
};

/**
 * Update the cached value for an API key
 */
export const updateApiKeyCache = (
  companyId: string,
  keyType: string,
  apiKey: string,
): void => {
  const cacheKey = `${companyId}:${keyType}`;
  apiKeyCache.set(cacheKey, apiKey);
};

/**
 * Invalidate the cached value for an API key
 */
export const invalidateApiKeyCache = (
  companyId: string,
  keyType: string,
): void => {
  const cacheKey = `${companyId}:${keyType}`;
  apiKeyCache.del(cacheKey);
};

/**
 * Refresh the cache for all API keys of a company (legacy system)
 */
export const refreshApiKeyCache = async (companyId: string): Promise<void> => {
  const company = await Company.findById(companyId);
  if (!company) {
    throw new Error('Company not found');
  }

  for (const apiKey of company.api_keys) {
    const keyType = apiKey.key;
    const decryptedKey = decryptData({
      value: apiKey.value,
      iv: apiKey.iv,
      tag: apiKey.tag,
    });
    updateApiKeyCache(companyId, keyType, decryptedKey);
  }
};

/**
 * Express middleware to validate that required API keys are configured.
 *
 * @param requiredKeys - Array of API key names that must be present
 * @returns Middleware function
 */
export const validateApiKeys = (requiredKeys: string[]) => {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    const missingKeys: string[] = [];

    for (const keyType of requiredKeys) {
      const apiKey = await getApiKey(req.company._id, keyType);
      if (apiKey === null) {
        missingKeys.push(keyType);
      }
    }

    if (missingKeys.length > 0) {
      return res.status(400).json({
        error: 'Missing API keys',
        missingKeys,
      });
    }

    next();
  };
};
