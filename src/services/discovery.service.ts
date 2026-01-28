import { readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { getLeanResponse } from '../utils/leanResponse';

/**
 * Defines a required API key for an integration
 */
export interface RequiredApiKey {
  key: string; // Key identifier (e.g., "jira_api_token")
  label: string; // Display label (e.g., "API Token")
  type: 'secret' | 'text'; // secret = password field, text = regular input
  placeholder?: string; // Placeholder text for the input
  description?: string; // Optional description for the field
  helpUrl?: string; // Optional URL to help documentation
}

export interface Integration {
  id: string;
  name: string;
  displayName?: string;
  description: string;
  icon: string;
  actions: ActionInfo[];
  category?: string; // e.g., "project_management", "ai", "communication"
  requiredApiKeys?: RequiredApiKey[];
}

export interface ActionInfo {
  id: string;
  serviceName: string;
  actionTitle: string;
  description: string;
  icon: string;
  service: string;
  parameters?: object;
}

interface ActionDefinition {
  description: string;
  parameters?: object;
  function: (...args: unknown[]) => unknown;
}

export type SupportedLanguage = 'en' | 'he';

function toSnakeCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, chr) => '_' + chr.toLowerCase());
}

export const discoveryService = {
  discoverIntegrations: async (
    language: SupportedLanguage = 'en',
  ): Promise<Integration[]> => {
    // Use src path since JSON configs are not copied during TypeScript compilation
    const integrationsPath = join(__dirname, '..', '..', 'src', 'integrations');
    const integrationFolders = readdirSync(integrationsPath).filter((folder) =>
      existsSync(join(integrationsPath, folder, 'integration.config.json')),
    );
    const integrations: Integration[] = [];

    for (const folder of integrationFolders) {
      const integrationPath = join(integrationsPath, folder);
      const configFilePath = join(integrationPath, 'integration.config.json');

      let config: any;
      try {
        config = require(configFilePath);
      } catch (error) {
        console.error(`Failed to read config file for ${folder}:`, error);
        continue;
      }

      const actionFilePath = join(
        integrationPath,
        config.actionsFile || `${folder}.actions.ts`,
      );

      if (!existsSync(actionFilePath)) {
        console.log(`Action file not found for ${folder}. Skipping.`);
        continue;
      }

      let actionObj;
      try {
        const module = await import(actionFilePath);
        const actionCreator = module[config.actionCreator];

        if (typeof actionCreator === 'function') {
          actionObj = actionCreator({} as any); // Pass an empty context
        } else {
          console.log(`No valid action creator found for ${folder}.`);
          continue;
        }
      } catch (error) {
        console.error(`Failed to process ${actionFilePath}:`, error);
        continue;
      }

      // Load translations
      const translations = loadTranslations(integrationPath, language);

      const actions: ActionInfo[] = [];
      const integrationId = toSnakeCase(config.name || folder);
      for (const [key, value] of Object.entries(actionObj)) {
        const actionDef = value as ActionDefinition;
        if (typeof actionDef === 'object' && actionDef.description) {
          const action: ActionInfo = {
            id: `${integrationId}.${key}`,
            serviceName: translations?.serviceName || config.name || folder,
            actionTitle: key,
            description:
              translations?.[key]?.description || actionDef.description,
            icon: config.icon || 'help-circle',
            service: integrationId,
            parameters: actionDef.parameters,
          };
          actions.push(action);
        } else {
          console.log(`Skipped invalid action: ${key}`);
        }
      }

      const integration: Integration = {
        id: integrationId,
        name: translations?.serviceName || config.name || folder,
        displayName:
          config.displayName ||
          translations?.serviceName ||
          config.name ||
          folder,
        description:
          translations?.serviceDescription || config.description || '',
        icon: config.icon || 'help-circle',
        actions: actions,
        category: config.category,
        requiredApiKeys: config.requiredApiKeys,
      };

      integrations.push(integration);
    }

    return integrations;
  },

  discoverActions: async (
    language: SupportedLanguage = 'en',
  ): Promise<ActionInfo[]> => {
    const integrations = await discoveryService.discoverIntegrations(language);
    const actions = flattenIntegrationsToActions(integrations);
    return actions;
  },

  getIntegrationById: async (
    id: string,
    language: SupportedLanguage = 'en',
  ): Promise<Integration | null> => {
    const integrations = await discoveryService.discoverIntegrations(language);
    return (
      integrations.find((integration) => integration.id === toSnakeCase(id)) ||
      null
    );
  },

  getIntegrationsLean: async (
    language: SupportedLanguage = 'en',
    fields?: (keyof Integration)[],
  ): Promise<Partial<Integration>[]> => {
    const integrations = await discoveryService.discoverIntegrations(language);
    return getLeanResponse(
      integrations,
      fields || ['id', 'name', 'displayName', 'description', 'icon', 'actions'],
    ) as Partial<Integration>[];
  },
};

function loadTranslations(
  integrationPath: string,
  language: SupportedLanguage,
): any {
  const translationsPath = join(
    integrationPath,
    'translations',
    `${language}.json`,
  );
  if (existsSync(translationsPath)) {
    try {
      return require(translationsPath);
    } catch (error) {
      console.error(
        `Failed to load translations from ${translationsPath}:`,
        error,
      );
    }
  }
  return null;
}

function flattenIntegrationsToActions(
  integrations: Integration[],
): ActionInfo[] {
  return integrations.reduce((acc, integration) => {
    return acc.concat(integration.actions);
  }, [] as ActionInfo[]);
}
