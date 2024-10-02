import OpenAI from 'openai';

export const getOpenAIClient = (apiKey: string) => {
  return new OpenAI({
    apiKey,
  });
};