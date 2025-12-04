/**
 * Integration Loader
 *
 * Dynamically loads and registers integrations without explicit imports.
 * This keeps the main application agnostic to specific integrations.
 *
 * Usage in src/index.ts:
 *   import { loadIntegrations } from './integrations/loader';
 *   await loadIntegrations(app);
 *
 * Configuration:
 *   Set ENABLED_INTEGRATIONS environment variable:
 *   ENABLED_INTEGRATIONS=nylas,linear,sendgrid
 *
 *   Or leave empty to load all integrations with routes:
 *   ENABLED_INTEGRATIONS=
 */

import { Express } from 'express';
import fs from 'fs';
import path from 'path';

/**
 * Integration interface that integrations can optionally implement
 */
export interface Integration {
  /**
   * Register integration routes and setup
   * @param app Express application instance
   */
  register(app: Express): Promise<void> | void;

  /**
   * Optional: Integration name for logging
   */
  name?: string;
}

/**
 * Load and register all enabled integrations
 *
 * @param app Express application instance
 * @returns Array of loaded integration names
 */
export async function loadIntegrations(app: Express): Promise<string[]> {
  const integrationsPath = path.join(__dirname);
  const loadedIntegrations: string[] = [];

  // Get list of enabled integrations from environment
  const enabledIntegrations = process.env.ENABLED_INTEGRATIONS
    ? process.env.ENABLED_INTEGRATIONS.split(',').map(i => i.trim())
    : null; // null means all integrations are enabled

  console.log('[INTEGRATION LOADER] Starting integration discovery...');
  if (enabledIntegrations) {
    console.log(`[INTEGRATION LOADER] Enabled integrations: ${enabledIntegrations.join(', ')}`);
  } else {
    console.log('[INTEGRATION LOADER] All integrations enabled (no filter)');
  }

  try {
    // Get all directories in integrations folder
    const entries = fs.readdirSync(integrationsPath, { withFileTypes: true });
    const integrationDirs = entries
      .filter(entry => entry.isDirectory())
      .filter(entry => !entry.name.startsWith('.') && entry.name !== 'actions') // Skip hidden and actions folder
      .map(entry => entry.name);

    console.log(`[INTEGRATION LOADER] Found ${integrationDirs.length} potential integrations`);

    // Load each integration
    for (const dirName of integrationDirs) {
      // Skip if not in enabled list (when filter is active)
      if (enabledIntegrations && !enabledIntegrations.includes(dirName)) {
        console.log(`[INTEGRATION LOADER] Skipping ${dirName} (not enabled)`);
        continue;
      }

      try {
        // Try to load integration index file
        const integrationIndexPath = path.join(integrationsPath, dirName, 'index');

        // Check if index file exists (TypeScript or JavaScript)
        const tsPath = `${integrationIndexPath}.ts`;
        const jsPath = `${integrationIndexPath}.js`;
        if (!fs.existsSync(tsPath) && !fs.existsSync(jsPath)) {
          console.log(`[INTEGRATION LOADER] Skipping ${dirName} (no index.ts/js file)`);
          continue;
        }

        // Dynamic import of integration
        const integration = await import(`./${dirName}`);

        // Check if integration has register function
        if (typeof integration.register === 'function') {
          console.log(`[INTEGRATION LOADER] Loading integration: ${dirName}`);

          // Call register function
          await integration.register(app);

          loadedIntegrations.push(dirName);
          console.log(`[INTEGRATION LOADER] ✓ Loaded integration: ${dirName}`);
        } else {
          console.log(`[INTEGRATION LOADER] Skipping ${dirName} (no register function)`);
        }

      } catch (error: any) {
        // Log error but continue loading other integrations
        console.error(`[INTEGRATION LOADER] ✗ Failed to load integration ${dirName}:`, error.message);

        // In development, log full stack trace
        if (process.env.NODE_ENV === 'development') {
          console.error(error.stack);
        }
      }
    }

    console.log(`[INTEGRATION LOADER] Successfully loaded ${loadedIntegrations.length} integrations:`, loadedIntegrations.join(', '));

    return loadedIntegrations;

  } catch (error: any) {
    console.error('[INTEGRATION LOADER] Fatal error during integration loading:', error.message);
    throw error;
  }
}

/**
 * Get list of available integrations (all folders with index files)
 *
 * @returns Array of integration names
 */
export function getAvailableIntegrations(): string[] {
  const integrationsPath = path.join(__dirname);

  try {
    const entries = fs.readdirSync(integrationsPath, { withFileTypes: true });
    const integrationDirs = entries
      .filter(entry => entry.isDirectory())
      .filter(entry => !entry.name.startsWith('.') && entry.name !== 'actions')
      .map(entry => entry.name);

    return integrationDirs.filter(dirName => {
      const indexPath = path.join(integrationsPath, dirName, 'index');
      return fs.existsSync(`${indexPath}.ts`) || fs.existsSync(`${indexPath}.js`);
    });

  } catch (error) {
    console.error('[INTEGRATION LOADER] Error listing integrations:', error);
    return [];
  }
}
