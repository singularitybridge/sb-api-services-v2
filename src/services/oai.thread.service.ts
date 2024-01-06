import { openaiClient } from './assistant.service';

export const createNewThread = async (): Promise<string> => {
  const thread = await openaiClient.beta.threads.create();
  return thread.id;
};

export const deleteThread = async (threadId: string): Promise<void> => {
  try {
    await openaiClient.beta.threads.del(threadId);
  } catch (error) {
    console.log('Thread not found');
  }
};

export const getMessages = async (threadId: string): Promise<any[]> => {
  const messages = await openaiClient.beta.threads.messages.list(threadId);
  return messages.data;
}


export const getMessageHistoryFormatted = (messages: any[]): string => {
  let formattedMessages = '';

  for (const message of messages) {
    const role = message.role === 'user' ? 'human' : 'ai';
    const content = message.content[0].text.value;
    formattedMessages += `${role}: ${content}\n`;
  }

  return formattedMessages;
};
