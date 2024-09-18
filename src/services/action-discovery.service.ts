import { readdirSync } from 'fs';
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

interface TranslationMap {
  [key: string]: {
    serviceName: string;
    actionTitle: string;
    description: string;
  };
}

export class ActionDiscoveryService {
  private actionsPath = join(__dirname, '..', 'actions');

  private translationMap: TranslationMap = {
    'agenda.scheduleMessage': {
      serviceName: 'יומן',
      actionTitle: 'תזמון הודעה',
      description: 'פעולה לתזמון הודעה בשירות היומן'
    },
    'assistant.createAssistant': {
      serviceName: 'עוזר',
      actionTitle: 'יצירת עוזר',
      description: 'פעולה ליצירת עוזר חדש'
    },
    'calendar.createEvent': {
      serviceName: 'לוח שנה',
      actionTitle: 'יצירת אירוע',
      description: 'פעולה ליצירת אירוע חדש בלוח השנה'
    },
    'inbox.createTask': {
      serviceName: 'תיבת דואר נכנס',
      actionTitle: 'יצירת משימה',
      description: 'פעולה ליצירת משימה חדשה בתיבת הדואר הנכנס'
    },
    'journal.createEntry': {
      serviceName: 'יומן אישי',
      actionTitle: 'יצירת רשומה',
      description: 'פעולה ליצירת רשומה חדשה ביומן האישי'
    },
    // Add more translations as needed
  };

  private getIconForService(serviceName: string): string {
    const iconMap: { [key: string]: string } = {
      agenda: 'calendar',
      aiAgentexecutor: 'cpu',
      assistant: 'message-square',
      calendar: 'calendar',
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
      aiagentexecutor : 'cpu',
      // Add more mappings as needed
    };

    return iconMap[serviceName.toLowerCase()] || 'help-circle'; // Default icon
  }

  async discoverActions(language: SupportedLanguage = 'en'): Promise<ActionInfo[]> {
    const actionFiles = readdirSync(this.actionsPath).filter(file => file.endsWith('Actions.ts'));
    const actions: ActionInfo[] = [];

    for (const file of actionFiles) {
      const serviceName = file.replace('Actions.ts', '');
      
      // Skip the calendar service
      if (serviceName.toLowerCase() === 'calendar') {
        continue;
      }

      const filePath = join(this.actionsPath, file);
      try {
        const module = await import(filePath);
        
        let actionCreator;
        if (typeof module.default === 'function') {
          actionCreator = module.default;
        } else if (typeof module[`create${this.capitalize(serviceName)}Actions`] === 'function') {
          actionCreator = module[`create${this.capitalize(serviceName)}Actions`];
        } else if (typeof module[`create${serviceName}Actions`] === 'function') {
          actionCreator = module[`create${serviceName}Actions`];
        } else if (typeof module.createJSONBinActions === 'function') {
          actionCreator = module.createJSONBinActions;
        }

        if (actionCreator) {
          const actionObj = actionCreator({} as any);  // Pass an empty context
          
          for (const [key, value] of Object.entries(actionObj)) {
            const actionDef = value as ActionDefinition;
            if (typeof actionDef === 'object' && actionDef.description) {
              const actionId = `${serviceName}.${key}`;
              actions.push({
                id: actionId,
                serviceName: this.getLocalizedString(actionId, 'serviceName', this.toTitleCase(serviceName), language),
                actionTitle: this.getLocalizedString(actionId, 'actionTitle', this.toTitleCase(key), language),
                description: this.getLocalizedString(actionId, 'description', actionDef.description, language),
                icon: this.getIconForService(serviceName),
                service: serviceName,
                parameters: actionDef.parameters
              });
            }
          }
        }
      } catch (error) {
        console.error(`Failed to process ${file}:`, error);
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

  private getLocalizedString(
    actionId: string,
    field: 'serviceName' | 'actionTitle' | 'description',
    defaultValue: string,
    language: SupportedLanguage
  ): string {
    if (language === 'he' && this.translationMap[actionId]) {
      return this.translationMap[actionId][field] || defaultValue;
    }
    return defaultValue;
  }
}