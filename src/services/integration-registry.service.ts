/**
 * Integration Registry Service
 *
 * Dynamically builds API key to integration mapping by scanning
 * integration.config.json files. This eliminates hardcoded mappings
 * and supports plugin-like integration architecture.
 */

import { readdirSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';

interface RequiredApiKey {
  key: string;
  label: string;
  type: 'secret' | 'text';
  placeholder?: string;
  description?: string;
  helpUrl?: string;
}

interface IntegrationConfig {
  name: string;
  displayName?: string;
  description?: string;
  icon?: string;
  category?: string;
  actionCreator?: string;
  actionsFile?: string;
  requiredApiKeys?: RequiredApiKey[];
}

// Cache for the API key to integration mapping
let apiKeyToIntegrationMap: Record<string, string> | null = null;

// Cache for all integration configs
let integrationConfigsCache: Map<string, IntegrationConfig> | null = null;

/**
 * Get all integration folders that have an integration.config.json
 */
function getIntegrationFolders(integrationsPath: string): string[] {
  try {
    return readdirSync(integrationsPath).filter((folder) => {
      const configPath = join(
        integrationsPath,
        folder,
        'integration.config.json',
      );
      return existsSync(configPath);
    });
  } catch (error) {
    console.error(
      '[IntegrationRegistry] Failed to read integrations directory:',
      error,
    );
    return [];
  }
}

/**
 * Load a single integration config
 */
function loadIntegrationConfig(configPath: string): IntegrationConfig | null {
  try {
    const content = readFileSync(configPath, 'utf-8');
    return JSON.parse(content) as IntegrationConfig;
  } catch (error) {
    console.error(
      `[IntegrationRegistry] Failed to load config: ${configPath}`,
      error,
    );
    return null;
  }
}

/**
 * Build the API key to integration mapping by scanning all integration configs.
 * Called once at startup and cached.
 */
export function buildApiKeyMapping(): Record<string, string> {
  if (apiKeyToIntegrationMap) {
    return apiKeyToIntegrationMap;
  }

  const mapping: Record<string, string> = {};
  const configs = new Map<string, IntegrationConfig>();

  // Path to integrations folder
  // Use src path since JSON configs are not copied during TypeScript compilation
  const integrationsPath = join(__dirname, '..', '..', 'src', 'integrations');
  const folders = getIntegrationFolders(integrationsPath);

  console.log(
    `[IntegrationRegistry] Scanning ${folders.length} integrations...`,
  );

  for (const folder of folders) {
    const configPath = join(
      integrationsPath,
      folder,
      'integration.config.json',
    );
    const config = loadIntegrationConfig(configPath);

    if (!config) continue;

    // Store config in cache
    configs.set(config.name, config);

    // Build API key mapping from requiredApiKeys
    if (config.requiredApiKeys && Array.isArray(config.requiredApiKeys)) {
      for (const apiKey of config.requiredApiKeys) {
        if (apiKey.key) {
          mapping[apiKey.key] = config.name;
        }
      }
    }
  }

  // Log summary
  const keyCount = Object.keys(mapping).length;
  console.log(
    `[IntegrationRegistry] Built mapping: ${keyCount} API keys across ${configs.size} integrations`,
  );

  // Cache the results
  apiKeyToIntegrationMap = mapping;
  integrationConfigsCache = configs;

  return mapping;
}

/**
 * Get the integration ID for a given API key name.
 * Returns undefined if the key is not associated with any integration.
 */
export function getIntegrationIdForApiKey(keyName: string): string | undefined {
  const mapping = buildApiKeyMapping();
  return mapping[keyName];
}

/**
 * Check if an API key name is registered with any integration
 */
export function isRegisteredApiKey(keyName: string): boolean {
  const mapping = buildApiKeyMapping();
  return keyName in mapping;
}

/**
 * Get all registered API key names
 */
export function getAllRegisteredApiKeys(): string[] {
  const mapping = buildApiKeyMapping();
  return Object.keys(mapping);
}

/**
 * Get all integration configs (cached)
 */
export function getAllIntegrationConfigs(): Map<string, IntegrationConfig> {
  if (!integrationConfigsCache) {
    buildApiKeyMapping(); // This will populate the cache
  }
  return integrationConfigsCache || new Map();
}

/**
 * Get a specific integration config by name
 */
export function getIntegrationConfig(
  integrationName: string,
): IntegrationConfig | undefined {
  const configs = getAllIntegrationConfigs();
  return configs.get(integrationName);
}

/**
 * Clear the cached mapping (useful for testing or hot reload)
 */
export function clearIntegrationRegistryCache(): void {
  apiKeyToIntegrationMap = null;
  integrationConfigsCache = null;
  console.log('[IntegrationRegistry] Cache cleared');
}

/**
 * Initialize the registry at startup.
 * Call this early in the application lifecycle.
 */
export function initializeIntegrationRegistry(): void {
  buildApiKeyMapping();
}
