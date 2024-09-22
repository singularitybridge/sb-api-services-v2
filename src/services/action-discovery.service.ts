import { readdirSync } from 'fs';
import { join } from 'path';
import { hebrewTranslations } from '../translations/he-discovery-actions';
import { initializeLinearIntegration } from '../integrations/linear';

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

export class ActionDiscoveryService {
  private actionsPath = join(__dirname, '..', 'actions');
  private integrationsPath = join(__dirname, '..', 'integrations');

  private getIconForService(serviceName: string): string {
    const iconMap: { [key: string]: string } = {
      agenda: 'calendar',
      aiAgentExecutor: 'cpu',
      assistant: 'message-square',
      calendar: 'calendar',
      content: 'file',
      contentType: 'layers',
      debug: 'bug',
      elevenlabs: 'headphones',
      fluximage: 'image',
      inbox: 'inbox',
      journal: 'book',
      jsonbin: 'database',
      linear: 'trello',
      mongodb: 'database',
      openai: 'brain',
      perplexity: 'search',
      photoroom: 'image',
      sendgrid: 'mail',
    };

    return iconMap[serviceName.toLowerCase()] || 'help-circle'; // Default icon
  }

  async discoverActions(
    language: SupportedLanguage = 'en',
  ): Promise<ActionInfo[]> {
    const regularActions = await this.discoverRegularActions(language);
    const integrationActions = await this.discoverIntegrationActions(language);
    const pluginActions = await this.discoverPluginActions(language);

    return [...regularActions, ...integrationActions, ...pluginActions];
  }

  private async discoverRegularActions(
    language: SupportedLanguage = 'en',
  ): Promise<ActionInfo[]> {
    const actionFiles = readdirSync(this.actionsPath).filter((file) =>
      file.endsWith('Actions.ts'),
    );
    let actions: ActionInfo[] = [];

    for (const file of actionFiles) {
      const serviceName = file.replace('Actions.ts', '');

      // Skip the calendar service
      if (serviceName.toLowerCase() === 'calendar') {
        continue;
      }

      const filePath = join(this.actionsPath, file);
      actions = actions.concat(await this.processActionFile(filePath, serviceName, language));
    }

    return actions;
  }

  private async discoverIntegrationActions(
    language: SupportedLanguage = 'en',
  ): Promise<ActionInfo[]> {
    let actions: ActionInfo[] = [];
    const integrationFolders = readdirSync(this.integrationsPath);

    for (const folder of integrationFolders) {
      const actionFilePath = join(this.integrationsPath, folder, `${folder}.actions.ts`);
      actions = actions.concat(await this.processActionFile(actionFilePath, folder, language));
    }

    return actions;
  }

  private async processActionFile(filePath: string, serviceName: string, language: SupportedLanguage): Promise<ActionInfo[]> {
    let actions: ActionInfo[] = [];
    try {
      const module = await import(filePath);

      let actionCreator;
      if (typeof module.default === 'function') {
        actionCreator = module.default;
      } else if (
        typeof module[`create${this.capitalize(serviceName)}Actions`] ===
        'function'
      ) {
        actionCreator =
          module[`create${this.capitalize(serviceName)}Actions`];
      } else if (
        typeof module[`create${serviceName}Actions`] === 'function'
      ) {
        actionCreator = module[`create${serviceName}Actions`];
      } else if (typeof module.createJSONBinActions === 'function') {
        actionCreator = module.createJSONBinActions;
      }

      if (actionCreator) {
        const actionObj = actionCreator({} as any); // Pass an empty context

        for (const [key, value] of Object.entries(actionObj)) {
          const actionDef = value as ActionDefinition;
          if (typeof actionDef === 'object' && actionDef.description) {
            const actionId = `${serviceName}.${key}`;
            const action = {
              id: actionId,
              serviceName: this.getLocalizedString(
                actionId,
                'serviceName',
                this.toTitleCase(serviceName),
                language,
              ),
              actionTitle: this.getLocalizedString(
                actionId,
                'actionTitle',
                this.toTitleCase(key),
                language,
              ),
              description: this.getLocalizedString(
                actionId,
                'description',
                actionDef.description,
                language,
              ),
              icon: this.getIconForService(serviceName),
              service: serviceName,
              parameters: actionDef.parameters,
            };
            actions.push(action);
          }
        }
      }
    } catch (error) {
      console.error(`Failed to process ${filePath}:`, error);
    }
    return actions;
  }

  private async discoverPluginActions(
    language: SupportedLanguage = 'en',
  ): Promise<ActionInfo[]> {
    const actions: ActionInfo[] = [];

    // For now, we're only handling the Linear integration
    const linearIntegration = initializeLinearIntegration({} as any);
    const linearActions = linearIntegration.actions;

    for (const [key, value] of Object.entries(linearActions)) {
      const actionDef = value as ActionDefinition;
      if (typeof actionDef === 'object' && actionDef.description) {
        const actionId = `linear.${key}`;
        const action = {
          id: actionId,
          serviceName: this.getLocalizedString(
            actionId,
            'serviceName',
            'Linear',
            language,
          ),
          actionTitle: this.getLocalizedString(
            actionId,
            'actionTitle',
            this.toTitleCase(key),
            language,
          ),
          description: this.getLocalizedString(
            actionId,
            'description',
            actionDef.description,
            language,
          ),
          icon: this.getIconForService('linear'),
          service: 'linear',
          parameters: actionDef.parameters,
        };
        actions.push(action);
      }
    }

    return actions;
  }

  private toTitleCase(str: string): string {
    return str
      .split(/(?=[A-Z])/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  private getLocalizedString(
    actionId: string,
    field: keyof TranslationEntry,
    defaultValue: string,
    language: SupportedLanguage,
  ): string {
    if (language === 'he') {
      const translations = hebrewTranslations as TranslationMap;
      if (translations[actionId] && translations[actionId][field]) {
        return translations[actionId][field];
      }
    }
    return defaultValue;
  }
}
