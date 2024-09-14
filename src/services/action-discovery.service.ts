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

interface TranslationMap {
  [key: string]: {
    name: string;
    actionTitle: string;
    description: string;
  };
}

export class ActionDiscoveryService {
  private actionsPath = join(__dirname, '..', 'actions');

  private translationMap: TranslationMap = {
    'agenda.scheduleMessage': {
      name: 'יומן',
      actionTitle: 'תזמון הודעה',
      description: 'פעולה לתזמון הודעה בשירות היומן'
    },
    'assistant.createAssistant': {
      name: 'עוזר',
      actionTitle: 'יצירת עוזר',
      description: 'פעולה ליצירת עוזר חדש'
    },
    'calendar.createEvent': {
      name: 'לוח שנה',
      actionTitle: 'יצירת אירוע',
      description: 'פעולה ליצירת אירוע חדש בלוח השנה'
    },
    'inbox.createTask': {
      name: 'תיבת דואר נכנס',
      actionTitle: 'יצירת משימה',
      description: 'פעולה ליצירת משימה חדשה בתיבת הדואר הנכנס'
    },
    'journal.createEntry': {
      name: 'יומן אישי',
      actionTitle: 'יצירת רשומה',
      description: 'פעולה ליצירת רשומה חדשה ביומן האישי'
    },
    // Add more translations as needed
  };

  private getIconForService(serviceName: string): string {
    const iconMap: { [key: string]: string } = {
      agenda: 'calendar',
      aiAgentExecutor: 'cpu',
      assistant: 'message-square',
      calendar: 'calendar',
      debug: 'bug',
      elevenLabs: 'headphones',
      fluxImage: 'image',
      inbox: 'inbox',
      journal: 'book',
      jsonbin: 'database',
      linear: 'trello',
      mongoDb: 'database',
      openAi: 'brain',
      perplexity: 'search',
      photoRoom: 'image',
      sendgrid: 'mail',
      // Add more mappings as needed
    };

    return iconMap[serviceName.toLowerCase()] || 'help-circle'; // Default icon
  }

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
            const actionId = `${serviceName}.${key}`;
            actions.push({
              id: actionId,
              name: this.getLocalizedString(actionId, 'name', this.toTitleCase(serviceName), language),
              actionTitle: this.getLocalizedString(actionId, 'actionTitle', this.toTitleCase(key), language),
              description: this.getLocalizedString(actionId, 'description', actionDef.description, language),
              icon: this.getIconForService(serviceName),
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

  private getLocalizedString(
    actionId: string,
    field: 'name' | 'actionTitle' | 'description',
    defaultValue: string,
    language: SupportedLanguage
  ): string {
    if (language === 'he' && this.translationMap[actionId]) {
      return this.translationMap[actionId][field] || defaultValue;
    }
    return defaultValue;
  }
}