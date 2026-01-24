/**
 * Check Integration Status Tool
 *
 * Checks if integrations are properly configured (API keys set) for a company.
 * Can check single or multiple integrations at once.
 * Optionally tests the actual connection.
 */

import { z } from 'zod';
import {
  getIntegrationConfigStatuses,
  testIntegrationConnection,
  type IntegrationConfigStatus,
  type TestConnectionResult,
} from '../../services/integration-config.service';
import { join } from 'path';
import { existsSync, readdirSync } from 'fs';

/**
 * Input schema for the check_integration_status tool
 */
export const checkIntegrationStatusSchema = z.object({
  integrationIds: z
    .array(z.string())
    .optional()
    .describe(
      'Array of integration IDs to check (e.g., ["jira", "openai"]). If not provided, checks all integrations with required API keys.',
    ),
  testConnection: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      'If true, also tests the actual connection for configured integrations (makes API calls). Default: false',
    ),
});

export type CheckIntegrationStatusInput = z.infer<
  typeof checkIntegrationStatusSchema
>;

interface RequiredApiKey {
  key: string;
  label: string;
  placeholder?: string;
}

interface IntegrationRequirements {
  integrationId: string;
  name: string;
  requiredApiKeys: RequiredApiKey[];
}

/**
 * Load integration requirements from config files
 */
async function getIntegrationRequirements(
  integrationIds?: string[],
): Promise<IntegrationRequirements[]> {
  const integrationsPath = join(__dirname, '..', '..', 'integrations');
  const requirements: IntegrationRequirements[] = [];

  // Get all integration directories or filter by provided IDs
  let integrationDirs: string[];
  if (integrationIds && integrationIds.length > 0) {
    integrationDirs = integrationIds;
  } else {
    integrationDirs = readdirSync(integrationsPath, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);
  }

  for (const integrationId of integrationDirs) {
    const configPath = join(
      integrationsPath,
      integrationId,
      'integration.config.json',
    );
    if (existsSync(configPath)) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const config = require(configPath);
        if (config.requiredApiKeys && config.requiredApiKeys.length > 0) {
          requirements.push({
            integrationId,
            name: config.name || integrationId,
            requiredApiKeys: config.requiredApiKeys,
          });
        }
      } catch (e) {
        // Skip if config can't be loaded
      }
    }
  }

  return requirements;
}

interface IntegrationStatusResult {
  integrationId: string;
  name: string;
  configured: boolean;
  enabled: boolean;
  requiredKeys: string[];
  configuredKeys: string[];
  missingKeys: string[];
  connectionTest?: TestConnectionResult;
}

/**
 * Check integration status for a company
 */
export async function checkIntegrationStatus(
  input: CheckIntegrationStatusInput,
  companyId: string,
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    // Get integration requirements
    const requirements = await getIntegrationRequirements(input.integrationIds);

    if (requirements.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                message: input.integrationIds
                  ? 'No integrations found with the specified IDs that require API keys'
                  : 'No integrations found that require API keys',
                integrations: [],
              },
              null,
              2,
            ),
          },
        ],
      };
    }

    // Get configuration status for all required integrations
    const integrationIds = requirements.map((r) => r.integrationId);
    const configStatuses = await getIntegrationConfigStatuses(
      companyId,
      integrationIds,
    );

    // Build status map
    const statusMap = new Map<string, IntegrationConfigStatus>();
    for (const status of configStatuses) {
      statusMap.set(status.integrationId, status);
    }

    // Build results
    const results: IntegrationStatusResult[] = [];

    for (const req of requirements) {
      const status = statusMap.get(req.integrationId);
      const requiredKeyNames = req.requiredApiKeys.map((k) => k.key);
      const configuredKeys = status?.configuredKeys || [];
      const missingKeys = requiredKeyNames.filter(
        (k) => !configuredKeys.includes(k),
      );

      const result: IntegrationStatusResult = {
        integrationId: req.integrationId,
        name: req.name,
        configured: status?.configured || false,
        enabled: status?.enabled || false,
        requiredKeys: requiredKeyNames,
        configuredKeys,
        missingKeys,
      };

      // Test connection if requested and integration is configured
      if (input.testConnection && status?.configured) {
        result.connectionTest = await testIntegrationConnection(
          companyId,
          req.integrationId,
        );
      }

      results.push(result);
    }

    // Summarize
    const configured = results.filter((r) => r.configured && r.enabled);
    const notConfigured = results.filter((r) => !r.configured || !r.enabled);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              summary: {
                total: results.length,
                configured: configured.length,
                notConfigured: notConfigured.length,
              },
              integrations: results,
              notConfiguredList:
                notConfigured.length > 0
                  ? notConfigured.map((r) => ({
                      id: r.integrationId,
                      name: r.name,
                      missingKeys: r.missingKeys,
                    }))
                  : undefined,
            },
            null,
            2,
          ),
        },
      ],
    };
  } catch (error) {
    console.error('MCP check integration status error:', error);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              error: true,
              message:
                error instanceof Error
                  ? error.message
                  : 'Failed to check integration status',
            },
            null,
            2,
          ),
        },
      ],
    };
  }
}

/**
 * Tool metadata for registration
 */
export const checkIntegrationStatusTool = {
  name: 'check_integration_status',
  description:
    'Check if integrations are properly configured (API keys set) for the company. Returns which integrations are configured, which keys are missing, and optionally tests the actual connection. Use this before enabling integration actions for an agent to ensure the required credentials are set up.',
  inputSchema: checkIntegrationStatusSchema,
};
