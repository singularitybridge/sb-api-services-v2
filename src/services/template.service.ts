import Handlebars from 'handlebars';
import { getSessionContextData } from './session-context.service';

export const processTemplate = async (template: string, sessionId: string): Promise<string> => {
  try {
    const data = await getSessionContextData(sessionId);
    const compiledTemplate = Handlebars.compile(template);
    return compiledTemplate(data);
  } catch (error) {
    console.error('Error processing template:', error);
    return template; // Return original template if there's an error
  }
};