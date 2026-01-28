import { Company } from '../models/Company';
import { decryptData } from './encryption.service';
import NodeCache from 'node-cache';
import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { getIntegrationApiKey } from './integration-config.service';

/**
 * Mapping from API key names to their integration IDs
 * This allows getApiKey to check IntegrationConfigs first
 */
const API_KEY_TO_INTEGRATION: Record<string, string> = {
  openai_api_key: 'openai',
  anthropic_api_key: 'anthropic',
  google_api_key: 'gemini',
  perplexity_api_key: 'perplexity',
  labs11_api_key: 'elevenlabs',
  sendgrid_api_key: 'sendgrid',
  linear_api_key: 'linear',
  replicate_api_key: 'replicate',
  mongodb_connection_string: 'mongodb',
  jira_api_token: 'jira',
  jira_domain: 'jira',
  jira_email: 'jira',
  ai_context_service_base_url: 'ai_context_service',
  ai_context_service_auth_token: 'ai_context_service',
  aws_access_key_id: 'aws_bedrock',
  aws_secret_access_key: 'aws_bedrock',
  aws_bedrock_kb_id: 'aws_bedrock',
  aws_region: 'aws_bedrock',
  nylas_api_key: 'nylas',
  nylas_grant_id: 'nylas',
  roomboss_username: 'roomboss',
  roomboss_password: 'roomboss',
  flingoos_mcp_api_key: 'flingoos_mcp',
};

export type ApiKeyType =
  | 'openai_api_key'
  | 'labs11_api_key'
  | 'google_api_key'
  | 'anthropic_api_key'
  | 'perplexity_api_key'
  | 'sendgrid_api_key'
  | 'linear_api_key'
  | 'replicate_api_key'
  | 'mongodb_connection_string'
  | 'jira_api_token'
  | 'jira_domain'
  | 'jira_email'
  | 'ai_context_service_base_url'
  | 'ai_context_service_auth_token'
  | 'aws_access_key_id'
  | 'aws_secret_access_key'
  | 'aws_bedrock_kb_id'
  | 'aws_region'
  | 'nylas_api_key'
  | 'nylas_grant_id'
  | 'roomboss_username'
  | 'roomboss_password'
  | 'flingoos_mcp_api_key';

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

  // 1. Try to get from IntegrationConfig first (new system)
  const integrationId = API_KEY_TO_INTEGRATION[keyType];
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
    const keyType = apiKey.key as ApiKeyType;
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
        missingKeys,
      });
    }

    next();
  };
};
