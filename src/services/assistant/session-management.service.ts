import { Session } from '../../models/Session';
import { getMessages } from '../oai.thread.service';
import { processTemplate } from '../template.service';

export async function getSessionMessages(apiKey: string, sessionId: string) {
  const session = await Session.findById(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }

  const messages = await getMessages(apiKey, session.threadId);
  
  const processedMessages = await Promise.all(messages.map(async (message) => {
    if (message.role === 'assistant' && message.content) {
      const processedContent = await Promise.all(message.content.map(async (content: { type: string; text?: { value: string } }) => {
        if (content.type === 'text' && content.text) {
          content.text.value = await processTemplate(content.text.value, sessionId);
        }
        return content;
      }));
      message.content = processedContent;
    }
    return message;
  }));

  return processedMessages;
}