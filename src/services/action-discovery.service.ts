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
    'assistant.getAssistants': {
      serviceName: 'עוזר',
      actionTitle: 'קבלת רשימת עוזרים',
      description: 'קבלת רשימה של כל העוזרים עבור החברה של המשתמש הנוכחי'
    },
    'assistant.setAssistant': {
      serviceName: 'עוזר',
      actionTitle: 'הגדרת עוזר נוכחי',
      description: 'הגדרת העוזר הנוכחי'
    },
    'assistant.CREATE_ASSISTANT': {
      serviceName: 'עוזר',
      actionTitle: 'יצירת עוזר',
      description: 'פעולה ליצירת עוזר חדש'
    },
    'assistant.LIST_ASSISTANTS': {
      serviceName: 'עוזר',
      actionTitle: 'רשימת עוזרים',
      description: 'פעולה להצגת רשימת העוזרים הקיימים'
    },
    'assistant.GET_ASSISTANT': {
      serviceName: 'עוזר',
      actionTitle: 'קבלת פרטי עוזר',
      description: 'פעולה לקבלת פרטים על עוזר ספציפי'
    },
    'assistant.UPDATE_ASSISTANT': {
      serviceName: 'עוזר',
      actionTitle: 'עדכון עוזר',
      description: 'פעולה לעדכון פרטי עוזר קיים'
    },
    'assistant.DELETE_ASSISTANT': {
      serviceName: 'עוזר',
      actionTitle: 'מחיקת עוזר',
      description: 'פעולה למחיקת עוזר קיים'
    },
    'assistant.CREATE_THREAD': {
      serviceName: 'עוזר',
      actionTitle: 'יצירת שיחה',
      description: 'פעולה ליצירת שיחה חדשה עם עוזר'
    },
    'assistant.GET_THREAD': {
      serviceName: 'עוזר',
      actionTitle: 'קבלת פרטי שיחה',
      description: 'פעולה לקבלת פרטים על שיחה ספציפית'
    },
    'assistant.DELETE_THREAD': {
      serviceName: 'עוזר',
      actionTitle: 'מחיקת שיחה',
      description: 'פעולה למחיקת שיחה קיימת'
    },
    'assistant.CREATE_MESSAGE': {
      serviceName: 'עוזר',
      actionTitle: 'יצירת הודעה',
      description: 'פעולה ליצירת הודעה חדשה בשיחה'
    },
    'assistant.LIST_MESSAGES': {
      serviceName: 'עוזר',
      actionTitle: 'רשימת הודעות',
      description: 'פעולה להצגת רשימת ההודעות בשיחה'
    },
    'assistant.RUN_ASSISTANT': {
      serviceName: 'עוזר',
      actionTitle: 'הפעלת עוזר',
      description: 'פעולה להפעלת עוזר על שיחה'
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
    'aiAgentExecutor.EXECUTE_COMMAND': {
      serviceName: 'מבצע סוכן AI',
      actionTitle: 'הפעלת פקודה',
      description: 'פעולה להפעלת פקודה במבצע סוכן AI'
    },
    'aiAgentExecutor.GET_PROCESS_STATUS': {
      serviceName: 'מבצע סוכן AI',
      actionTitle: 'קבלת סטטוס תהליך',
      description: 'פעולה לקבלת סטטוס של תהליך רקע'
    },
    'aiAgentExecutor.STOP_PROCESS': {
      serviceName: 'מבצע סוכן AI',
      actionTitle: 'עצירת תהליך',
      description: 'פעולה לעצירת תהליך רקע'
    },
    'aiAgentExecutor.FILE_OPERATION': {
      serviceName: 'מבצע סוכן AI',
      actionTitle: 'פעולת קובץ',
      description: 'פעולה לביצוע פעולות על קבצים'
    },
    'aiAgentExecutor.STOP_EXECUTION': {
      serviceName: 'מבצע סוכן AI',
      actionTitle: 'עצירת ביצוע',
      description: 'פעולה לעצירת כל התהליכים וכיבוי מבצע סוכן AI'
    },
  };

  private getIconForService(serviceName: string): string {
    const iconMap: { [key: string]: string } = {
      agenda: 'calendar',
      aiAgentExecutor: 'cpu',
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
              const action = {
                id: actionId,
                serviceName: this.getLocalizedString(actionId, 'serviceName', this.toTitleCase(serviceName), language),
                actionTitle: this.getLocalizedString(actionId, 'actionTitle', this.toTitleCase(key), language),
                description: this.getLocalizedString(actionId, 'description', actionDef.description, language),
                icon: this.getIconForService(serviceName),
                service: serviceName,
                parameters: actionDef.parameters
              };
              actions.push(action);
              
              // Log the discovered action (for verification purposes)
              console.log(`Discovered action: ${JSON.stringify(action, null, 2)}`);
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
    return str.split(/(?=[A-Z])/).map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
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
    if (language === 'he' && this.translationMap[actionId] && this.translationMap[actionId][field]) {
      return this.translationMap[actionId][field];
    }
    return defaultValue;
  }
}