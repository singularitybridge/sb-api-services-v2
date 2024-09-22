import { readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { hebrewTranslations } from '../translations/he-discovery-actions';

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

interface TranslationEntry {
  serviceName: string;
  actionTitle: string;
  description: string;
}

type TranslationMap = {
  [key: string]: TranslationEntry;
};

export const actionDiscoveryService = {
  getIconForService: (serviceName: string): string => {
    const iconMap: { [key: string]: string } = {
      linear: 'trello',
      perplexity: 'search',
      photoroom: 'image',
      // Add more mappings as needed
    };

    return iconMap[serviceName.toLowerCase()] || 'help-circle'; // Default icon
  },

  discoverActions: async (language: SupportedLanguage = 'en'): Promise<ActionInfo[]> => {
    const integrationsPath = join(__dirname);
    const integrationFolders = readdirSync(integrationsPath).filter(folder => 
      folder !== 'action-discovery.service.ts' && existsSync(join(integrationsPath, folder))
    );
    let actions: ActionInfo[] = [];

    console.log('Integration folders:', integrationFolders);

    for (const folder of integrationFolders) {
      const actionFilePath = join(integrationsPath, folder, `${folder}.actions.ts`);
      console.log(`Processing integration: ${folder}`);
      console.log(`Looking for file: ${actionFilePath}`);
      
      if (!existsSync(actionFilePath)) {
        console.log(`Action file not found for ${folder}. Skipping.`);
        continue;
      }

      try {
        const module = await import(actionFilePath);
        console.log(`Imported module for ${folder}:`, Object.keys(module));
        
        const expectedActionCreatorName = `create${capitalize(folder)}Actions`;
        console.log(`Looking for action creator: ${expectedActionCreatorName}`);
        
        // Find the action creator function, ignoring case
        const actionCreator = module.default || Object.values(module).find(
          (exp): exp is Function => 
            typeof exp === 'function' && 
            exp.name.toLowerCase() === expectedActionCreatorName.toLowerCase()
        );

        if (actionCreator) {
          console.log(`Found action creator for ${folder}: ${actionCreator.name}`);
          const actionObj = actionCreator({} as any); // Pass an empty context

          console.log(`Action object for ${folder}:`, Object.keys(actionObj));

          for (const [key, value] of Object.entries(actionObj)) {
            const actionDef = value as ActionDefinition;
            if (typeof actionDef === 'object' && actionDef.description) {
              const actionId = `${folder}.${key}`;
              const action = {
                id: actionId,
                serviceName: getLocalizedString(actionId, 'serviceName', toTitleCase(folder), language),
                actionTitle: getLocalizedString(actionId, 'actionTitle', toTitleCase(key), language),
                description: getLocalizedString(actionId, 'description', actionDef.description, language),
                icon: actionDiscoveryService.getIconForService(folder),
                service: folder,
                parameters: actionDef.parameters,
              };
              actions.push(action);
              console.log(`Added action: ${actionId}`);
            } else {
              console.log(`Skipped invalid action: ${key}`);
            }
          }
        } else {
          console.log(`No action creator found for ${folder}. Available exports:`, Object.keys(module));
        }
      } catch (error) {
        console.error(`Failed to process ${actionFilePath}:`, error);
      }
    }

    console.log('Discovered actions:', actions.map(a => a.id));
    return actions;
  },
};

const toTitleCase = (str: string): string =>
  str.split(/(?=[A-Z])/)
     .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
     .join(' ');

const capitalize = (str: string): string =>
  str.charAt(0).toUpperCase() + str.slice(1);

const getLocalizedString = (
  actionId: string,
  field: keyof TranslationEntry,
  defaultValue: string,
  language: SupportedLanguage,
): string => {
  if (language === 'he') {
    const translations = hebrewTranslations as TranslationMap;
    if (translations[actionId] && translations[actionId][field]) {
      return translations[actionId][field];
    }
  }
  return defaultValue;
};