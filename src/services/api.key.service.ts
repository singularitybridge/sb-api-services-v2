import NodeCache from 'node-cache';
import { getIntegrationApiKey } from './integration-config.service';
import { getIntegrationIdForApiKey } from './integration-registry.service';

/**
 * API Key Service
 *
 * Retrieves API keys from IntegrationConfig (the sole source of truth).
 * The API key to integration mapping is built dynamically from
 * integration.config.json files via integration-registry.service.
 */

// Short TTL so key updates propagate quickly (single instance, but covers restart gaps)
const apiKeyCache = new NodeCache({ stdTTL: 120 });

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

  const cachedKey = apiKeyCache.get<string>(cacheKey);
  if (cachedKey) {
    return cachedKey;
  }

  const integrationId = getIntegrationIdForApiKey(keyType);
  if (integrationId) {
    const integrationKey = await getIntegrationApiKey(
      companyId,
      integrationId,
      keyType,
    );
    if (integrationKey) {
      apiKeyCache.set(cacheKey, integrationKey);
      return integrationKey;
    }
  }

  return null;
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
