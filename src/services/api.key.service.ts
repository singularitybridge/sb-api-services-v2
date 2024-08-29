import { Company } from '../models/Company';
import { decryptData } from './encryption.service';
import NodeCache from 'node-cache';
import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export type ApiKeyType =
  | 'openai'
  | 'labs11'
  | 'google'
  | 'twilio'
  | 'jsonbin'
  | 'getimg'
  | 'perplexity'
  | 'sendgrid'
  | 'photoroom'
  | 'telegram_bot';

// Initialize cache with a 15-minute TTL (time to live)
const apiKeyCache = new NodeCache({ stdTTL: 900 });

export const getApiKey = async (
  companyId: string,
  keyType: ApiKeyType,
): Promise<string | null> => {
  const cacheKey = `${companyId}:${keyType}`;

  // Check cache first
  const cachedKey = apiKeyCache.get<string>(cacheKey);
  if (cachedKey) {
    return cachedKey;
  }

  // If not in cache, fetch from database
  const company = await Company.findById(companyId);
  if (!company) {
    throw new Error('Company not found');
  }

  const apiKey = company.api_keys.find(
    (key) => key.key === `${keyType}_api_key`,
  );
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

export const setApiKey = async (
  companyId: string,
  keyType: ApiKeyType,
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

export const updateApiKeyCache = (
  companyId: string,
  keyType: ApiKeyType,
  apiKey: string,
): void => {
  const cacheKey = `${companyId}:${keyType}`;
  apiKeyCache.set(cacheKey, apiKey);
};

export const invalidateApiKeyCache = (
  companyId: string,
  keyType: ApiKeyType,
): void => {
  const cacheKey = `${companyId}:${keyType}`;
  apiKeyCache.del(cacheKey);
};

export const refreshApiKeyCache = async (companyId: string): Promise<void> => {
  const company = await Company.findById(companyId);
  if (!company) {
    throw new Error('Company not found');
  }

  for (const apiKey of company.api_keys) {
    const keyType = apiKey.key.split('_')[0] as ApiKeyType;
    const decryptedKey = decryptData({
      value: apiKey.value,
      iv: apiKey.iv,
      tag: apiKey.tag,
    });
    updateApiKeyCache(companyId, keyType, decryptedKey);
  }
};

export const validateApiKeys = (requiredKeys: ApiKeyType[]) => {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    const missingKeys: ApiKeyType[] = [];

    for (const keyType of requiredKeys) {
      const apiKey = await getApiKey(req.company._id, keyType);
      if (apiKey === null) {
        missingKeys.push(keyType);
      }
    }

    if (missingKeys.length > 0) {
      return res.status(400).json({
        error: 'Missing API keys',
        missingKeys: missingKeys.map((key) => `${key} API key`),
      });
    }

    next();
  };
};
