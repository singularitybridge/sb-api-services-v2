import { SessionContextData, getSessionContextData } from './session-context.service';

const renderTemplate = (template: string, data: SessionContextData): string => {
  return template.replace(/{{\s*([^}\s]+)\s*}}/g, (match, key) => {
    const keys = key.split('.');
    let value: any = data;
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k as keyof typeof value];
      } else {
        return match; // Keep original placeholder if key not found
      }
    }
    return String(value);
  });
};

export const processTemplate = async (template: string, sessionId: string): Promise<string> => {
  try {
    const data = await getSessionContextData(sessionId);
    return renderTemplate(template, data);
  } catch (error) {
    console.error('Error processing template:', error);
    return template; // Return original template if there's an error
  }
};