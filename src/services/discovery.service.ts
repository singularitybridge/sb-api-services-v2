import { readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { getLeanResponse } from '../utils/leanResponse';

export interface Integration {
  id: string;
  name: string;
  description: string;
  icon: string;
  actions: ActionInfo[];
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
  function: Function;
}

export type SupportedLanguage = 'en' | 'he';

function toSnakeCase(str: string): string {
  return str.toLowerCase().replace(/[^a-zA-Z0-9]+(.)/g, (_, chr) => '_' + chr.toLowerCase());
}

export const discoveryService = {
  discoverIntegrations: async (language: SupportedLanguage = 'en'): Promise<Integration[]> => {
    const integrationsPath = join(__dirname, '..', 'integrations');
    const integrationFolders = readdirSync(integrationsPath).filter(folder =>
      existsSync(join(integrationsPath, folder, 'integration.config.json'))
    );
    let integrations: Integration[] = [];

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

      const actionFilePath = join(integrationPath, config.actionsFile || `${folder}.actions.ts`);

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
            description: translations?.[key]?.description || actionDef.description,
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
        description: translations?.serviceDescription || config.description || '',
        icon: config.icon || 'help-circle',
        actions: actions,
      };

      integrations.push(integration);
    }

    return integrations;
  },

  discoverActions: async (language: SupportedLanguage = 'en'): Promise<ActionInfo[]> => {
    const integrations = await discoveryService.discoverIntegrations(language);
    const actions = flattenIntegrationsToActions(integrations);
    console.log('Discovered actions:', JSON.stringify(actions, null, 2));
    return actions;
  },

  getIntegrationById: async (id: string, language: SupportedLanguage = 'en'): Promise<Integration | null> => {
    const integrations = await discoveryService.discoverIntegrations(language);
    return integrations.find(integration => integration.id === toSnakeCase(id)) || null;
  },

  getIntegrationsLean: async (language: SupportedLanguage = 'en', fields?: (keyof Integration)[]): Promise<Partial<Integration>[]> => {
    const integrations = await discoveryService.discoverIntegrations(language);
    return getLeanResponse(integrations, fields || ['id', 'name', 'description', 'icon', 'actions']) as Partial<Integration>[];
  },
};

function loadTranslations(integrationPath: string, language: SupportedLanguage): any {
  const translationsPath = join(integrationPath, 'translations', `${language}.json`);
  if (existsSync(translationsPath)) {
    try {
      return require(translationsPath);
    } catch (error) {
      console.error(`Failed to load translations from ${translationsPath}:`, error);
    }
  }
  return null;
}

function flattenIntegrationsToActions(integrations: Integration[]): ActionInfo[] {
  return integrations.reduce((acc, integration) => {
    return acc.concat(integration.actions);
  }, [] as ActionInfo[]);
}