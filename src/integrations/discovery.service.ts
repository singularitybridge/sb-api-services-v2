import { readdirSync, existsSync } from 'fs';
import { join } from 'path';

interface ActionInfo {
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

type SupportedLanguage = 'en' | 'he';

export const discoveryService = {
  discoverActions: async (language: SupportedLanguage = 'en'): Promise<ActionInfo[]> => {
    const integrationsPath = join(__dirname);
    const integrationFolders = readdirSync(integrationsPath).filter(folder =>
      existsSync(join(integrationsPath, folder, 'integration.config.json'))
    );
    let actions: ActionInfo[] = [];

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

      for (const [key, value] of Object.entries(actionObj)) {
        const actionDef = value as ActionDefinition;
        if (typeof actionDef === 'object' && actionDef.description) {
          const actionId = `${folder}.${key}`;
          const action = {
            id: actionId,
            serviceName: translations?.serviceName || config.name || folder,
            actionTitle: translations?.[key]?.actionTitle || key,
            description: translations?.[key]?.description || actionDef.description,
            icon: config.icon || 'help-circle',
            service: folder,
            parameters: actionDef.parameters,
          };
          actions.push(action);
        } else {
          console.log(`Skipped invalid action: ${key}`);
        }
      }
    }

    return actions;
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