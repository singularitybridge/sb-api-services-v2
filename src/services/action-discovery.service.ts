import { readdirSync } from 'fs';
import { join } from 'path';

interface ActionInfo {
  id: string;
  name: string;
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

export class ActionDiscoveryService {
  private actionsPath = join(__dirname, '..', 'actions');

  async discoverActions(language: SupportedLanguage = 'en'): Promise<ActionInfo[]> {
    const actionFiles = readdirSync(this.actionsPath).filter(file => file.endsWith('Actions.ts'));
    const actions: ActionInfo[] = [];

    for (const file of actionFiles) {
      const serviceName = file.replace('Actions.ts', '');
      const filePath = join(this.actionsPath, file);
      const module = await import(filePath);
      
      if (typeof module.default === 'function' || typeof module[`create${this.capitalize(serviceName)}Actions`] === 'function') {
        const actionCreator = module.default || module[`create${this.capitalize(serviceName)}Actions`];
        const actionObj = actionCreator({} as any);  // Pass an empty context
        
        for (const [key, value] of Object.entries(actionObj)) {
          const actionDef = value as ActionDefinition;
          if (typeof actionDef === 'object' && actionDef.description) {
            actions.push({
              id: `${serviceName}.${key}`,
              name: this.getLocalizedString(this.toTitleCase(serviceName), language),
              actionTitle: this.getLocalizedString(this.toTitleCase(key), language),
              description: this.getLocalizedString(actionDef.description, language, `פעולה ${key} משירות ${serviceName}`),
              icon: 'default-icon', // TODO: Implement icon logic
              service: serviceName,
              parameters: actionDef.parameters
            });
          }
        }
      }
    }

    return actions;
  }

  private toTitleCase(str: string): string {
    return str.replace(/([A-Z])/g, ' $1').trim().replace(/^./, s => s.toUpperCase());
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  private getLocalizedString(enString: string, language: SupportedLanguage, heString?: string): string {
    if (language === 'he' && heString) {
      return heString;
    }
    return enString;
  }
}