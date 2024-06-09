import { getOpenAIClient } from './assistant.service';

export const createNewThread = async (apiKey:string): Promise<string> => {
  const openaiClient = getOpenAIClient(apiKey);
  const thread = await openaiClient.beta.threads.create();
  return thread.id;
};

export const deleteThread = async (apiKey:string, threadId: string): Promise<void> => {
  try {
    const openaiClient = getOpenAIClient(apiKey);
    await openaiClient.beta.threads.del(threadId);
  } catch (error) {
    console.log('Thread not found');
  }
};

export const getMessages = async (apiKey:string, threadId: string): Promise<any[]> => {
  const openaiClient = getOpenAIClient(apiKey);
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
