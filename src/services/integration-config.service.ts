// file path: /src/services/integration-config.service.ts
import NodeCache from 'node-cache';
import {
  IntegrationConfig,
  IIntegrationConfig,
  IIntegrationApiKey,
} from '../models/IntegrationConfig';
import { encryptData, decryptData } from './encryption.service';
import { getApiKey } from './api.key.service';

// Cache with 15-minute TTL (same as api.key.service)
const integrationConfigCache = new NodeCache({ stdTTL: 900 });

/**
 * Key format for caching integration configs
 */
function getCacheKey(companyId: string, integrationId?: string): string {
  return integrationId
    ? `config:${companyId}:${integrationId}`
    : `configs:${companyId}`;
}

/**
 * Key format for caching individual API keys
 */
function getApiKeyCacheKey(
  companyId: string,
  integrationId: string,
  keyName: string,
): string {
  return `apikey:${companyId}:${integrationId}:${keyName}`;
}

/**
 * Lean version of integration config for caching (without mongoose methods)
 */
export type IntegrationConfigLean = {
  _id: string;
  companyId: string;
  integrationId: string;
  apiKeys: IIntegrationApiKey[];
  enabled: boolean;
  configuredAt: Date;
  configuredBy?: string;
  updatedAt: Date;
  createdAt: Date;
};

/**
 * Get all integration configs for a company
 */
export async function getIntegrationConfigs(
  companyId: string,
): Promise<IntegrationConfigLean[]> {
  const cacheKey = getCacheKey(companyId);

  const cached = integrationConfigCache.get<IntegrationConfigLean[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const configs = await IntegrationConfig.find({ companyId }).lean();
  integrationConfigCache.set(cacheKey, configs);

  return configs as unknown as IntegrationConfigLean[];
}

/**
 * Get a specific integration config
 */
export async function getIntegrationConfig(
  companyId: string,
  integrationId: string,
): Promise<IntegrationConfigLean | null> {
  const cacheKey = getCacheKey(companyId, integrationId);

  const cached = integrationConfigCache.get<IntegrationConfigLean>(cacheKey);
  if (cached) {
    return cached;
  }

  const config = await IntegrationConfig.findOne({
    companyId,
    integrationId,
  }).lean();

  if (config) {
    integrationConfigCache.set(cacheKey, config);
  }

  return config as unknown as IntegrationConfigLean | null;
}

/**
 * Input type for saving API keys (unencrypted)
 */
export interface ApiKeyInput {
  key: string;
  value: string;
}

/**
 * Save or update an integration config with API keys
 */
export async function saveIntegrationConfig(
  companyId: string,
  integrationId: string,
  apiKeys: ApiKeyInput[],
  userId?: string,
): Promise<IIntegrationConfig> {
  // Encrypt API keys
  const encryptedKeys: IIntegrationApiKey[] = apiKeys.map((key) => {
    const encrypted = encryptData(key.value);
    return {
      key: key.key,
      value: encrypted.value,
      iv: encrypted.iv,
      tag: encrypted.tag,
    };
  });

  const config = await IntegrationConfig.findOneAndUpdate(
    { companyId, integrationId },
    {
      $set: {
        apiKeys: encryptedKeys,
        enabled: true,
        configuredAt: new Date(),
        ...(userId && { configuredBy: userId }),
      },
    },
    { upsert: true, new: true },
  );

  // Invalidate caches
  invalidateIntegrationConfigCache(companyId, integrationId);

  return config;
}

/**
 * Delete an integration config
 */
export async function deleteIntegrationConfig(
  companyId: string,
  integrationId: string,
): Promise<boolean> {
  const result = await IntegrationConfig.deleteOne({
    companyId,
    integrationId,
  });

  // Invalidate caches
  invalidateIntegrationConfigCache(companyId, integrationId);

  return result.deletedCount > 0;
}

/**
 * Get a specific API key from an integration config (decrypted)
 */
export async function getIntegrationApiKey(
  companyId: string,
  integrationId: string,
  keyName: string,
): Promise<string | null> {
  const cacheKey = getApiKeyCacheKey(companyId, integrationId, keyName);

  // Check cache first
  const cached = integrationConfigCache.get<string>(cacheKey);
  if (cached) {
    return cached;
  }

  const config = await getIntegrationConfig(companyId, integrationId);
  if (!config) {
    return null;
  }

  const apiKey = config.apiKeys.find((k) => k.key === keyName);
  if (!apiKey) {
    return null;
  }

  const decryptedKey = decryptData({
    value: apiKey.value,
    iv: apiKey.iv,
    tag: apiKey.tag,
  });

  // Cache the decrypted key
  integrationConfigCache.set(cacheKey, decryptedKey);

  return decryptedKey;
}

/**
 * Get API key with fallback to legacy Company.api_keys
 * This ensures backwards compatibility during migration
 */
export async function getApiKeyWithFallback(
  companyId: string,
  integrationId: string,
  keyName: string,
): Promise<string | null> {
  // 1. Check new IntegrationConfig first
  const newKey = await getIntegrationApiKey(companyId, integrationId, keyName);
  if (newKey) {
    return newKey;
  }

  // 2. Fall back to legacy Company.api_keys
  return getApiKey(companyId, keyName);
}

/**
 * Check if an integration is configured (has at least one API key set)
 */
export async function isIntegrationConfigured(
  companyId: string,
  integrationId: string,
): Promise<boolean> {
  const config = await getIntegrationConfig(companyId, integrationId);
  return config !== null && config.apiKeys.length > 0 && config.enabled;
}

/**
 * Get all configured integration IDs for a company
 */
export async function getConfiguredIntegrationIds(
  companyId: string,
): Promise<string[]> {
  const configs = await getIntegrationConfigs(companyId);
  return configs
    .filter((c) => c.enabled && c.apiKeys.length > 0)
    .map((c) => c.integrationId);
}

/**
 * Invalidate caches for an integration config
 */
function invalidateIntegrationConfigCache(
  companyId: string,
  integrationId: string,
): void {
  // Delete specific config cache
  integrationConfigCache.del(getCacheKey(companyId, integrationId));

  // Delete all configs cache for company
  integrationConfigCache.del(getCacheKey(companyId));

  // Delete all API key caches for this integration
  // Note: We can't easily enumerate all keys, so we use a pattern
  // In practice, the 15-minute TTL will handle cleanup
  const keys = integrationConfigCache.keys();
  for (const key of keys) {
    if (key.startsWith(`apikey:${companyId}:${integrationId}:`)) {
      integrationConfigCache.del(key);
    }
  }
}

/**
 * Get integration config status for UI display
 * Returns configs with status information (without decrypted keys)
 */
export interface IntegrationConfigStatus {
  integrationId: string;
  configured: boolean;
  enabled: boolean;
  configuredAt?: Date;
  configuredKeys: string[]; // List of key names that are configured
}

export async function getIntegrationConfigStatuses(
  companyId: string,
  integrationIds: string[],
): Promise<IntegrationConfigStatus[]> {
  const configs = await getIntegrationConfigs(companyId);
  const configMap = new Map(configs.map((c) => [c.integrationId, c]));

  return integrationIds.map((integrationId) => {
    const config = configMap.get(integrationId);
    return {
      integrationId,
      configured: config !== undefined && config.apiKeys.length > 0,
      enabled: config?.enabled ?? false,
      configuredAt: config?.configuredAt,
      configuredKeys: config?.apiKeys.map((k) => k.key) ?? [],
    };
  });
}

/**
 * Result of testing an integration connection
 */
export interface TestConnectionResult {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Test an integration connection using its validateConnection function
 * Each integration can export a validateConnection function to test its API keys
 * @param companyId - Company ID
 * @param integrationId - Integration ID
 * @param providedApiKeys - Optional API keys to test with (for testing unsaved values)
 */
export async function testIntegrationConnection(
  companyId: string,
  integrationId: string,
  providedApiKeys?: Record<string, string>,
): Promise<TestConnectionResult> {
  const { join } = await import('path');
  const { existsSync } = await import('fs');

  // Load the integration module
  const integrationsPath = join(__dirname, '..', 'integrations');
  const integrationPath = join(integrationsPath, integrationId);

  if (!existsSync(integrationPath)) {
    return {
      success: false,
      error: `Integration "${integrationId}" not found`,
    };
  }

  // Load config to get the actions file name
  const configFilePath = join(integrationPath, 'integration.config.json');
  if (!existsSync(configFilePath)) {
    return {
      success: false,
      error: `Integration config not found for "${integrationId}"`,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const integrationConfig = require(configFilePath);
  const actionsFile =
    integrationConfig.actionsFile || `${integrationId}.actions.ts`;
  const actionsFilePath = join(integrationPath, actionsFile);

  if (!existsSync(actionsFilePath)) {
    return {
      success: false,
      error: `Actions file not found for "${integrationId}"`,
    };
  }

  // Import the module and check for validateConnection
  try {
    const module = await import(actionsFilePath);

    if (typeof module.validateConnection !== 'function') {
      return {
        success: false,
        error: `Integration "${integrationId}" does not support connection testing`,
      };
    }

    // Use provided API keys or load from saved config
    let apiKeys: Record<string, string>;

    if (providedApiKeys && Object.keys(providedApiKeys).length > 0) {
      // Use the provided (unsaved) API keys
      apiKeys = providedApiKeys;
    } else {
      // Load and decrypt saved API keys
      const config = await getIntegrationConfig(companyId, integrationId);
      if (!config || config.apiKeys.length === 0) {
        return {
          success: false,
          error: 'No API keys to test. Please enter your credentials.',
        };
      }

      apiKeys = {};
      for (const key of config.apiKeys) {
        const decryptedValue = decryptData({
          value: key.value,
          iv: key.iv,
          tag: key.tag,
        });
        apiKeys[key.key] = decryptedValue;
      }
    }

    // Call the validation function
    const result = await module.validateConnection(apiKeys);
    return result;
  } catch (error: any) {
    console.error(`Error testing connection for ${integrationId}:`, error);
    return {
      success: false,
      error: error.message || 'Failed to test connection',
    };
  }
}
