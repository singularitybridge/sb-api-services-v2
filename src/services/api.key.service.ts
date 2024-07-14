/// file_path: src/services/api.key.service.ts
import { Company } from '../models/Company';
import { decryptData } from './encryption.service';
import NodeCache from 'node-cache';

export type ApiKeyType = 'openai' | 'elevenlabs' | 'google' | 'twilio';

// Initialize cache with a 15-minute TTL (time to live)
const apiKeyCache = new NodeCache({ stdTTL: 900 });

export const getApiKey = async (companyId: string, keyType: ApiKeyType): Promise<string> => {
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

  const apiKey = company.api_keys.find(key => key.key === `${keyType}_api_key`);
  if (!apiKey) {
    return 'not set';
  }

  const decryptedKey = decryptData({ 'value': apiKey.value, 'iv': apiKey.iv, 'tag': apiKey.tag });

  // Store in cache
  apiKeyCache.set(cacheKey, decryptedKey);

  return decryptedKey;
};

export const setApiKey = async (companyId: string, keyType: ApiKeyType, apiKey: string): Promise<void> => {
  const company = await Company.findById(companyId);
  if (!company) {
    throw new Error('Company not found');
  }

  // Implementation of encryption and saving the API key
  // This part depends on your encryption service and how you store API keys
  // ...

  await company.save();

  // Update cache
  const cacheKey = `${companyId}:${keyType}`;
  apiKeyCache.set(cacheKey, apiKey);
};

export const invalidateApiKeyCache = (companyId: string, keyType: ApiKeyType): void => {
  const cacheKey = `${companyId}:${keyType}`;
  apiKeyCache.del(cacheKey);
};