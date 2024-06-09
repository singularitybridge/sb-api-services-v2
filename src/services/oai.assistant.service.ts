import OpenAI from 'openai';
import { getOpenAIClient } from './assistant.service';
import { ApiKey } from './verification.service';
import Api from 'twilio/lib/rest/Api';

export const getAssistants = async (apiKey: string) => {
  const openaiClient = getOpenAIClient(apiKey);

  const assistants = await openaiClient.beta.assistants.list({
    limit: 20,
  });
  return assistants;
};

export const getAssistantById = async (apiKey: string, assistantId: string) => {
  const openaiClient = getOpenAIClient(apiKey);

  const assistant = await openaiClient.beta.assistants.retrieve(assistantId);
  return assistant;
};

export const updateAssistantById = async (
  apiKey: string,
  assistantId: string,
  name: string,
  description: string,
  model: string,
  instructions: string,
  //   file_ids: string[],
) => {
  const openaiClient = getOpenAIClient(apiKey);
  const updatedAssistant = await openaiClient.beta.assistants.update(
    assistantId,
    {
      instructions,
      name,
      description,
      //   tools: [{ type: 'retrieval' }],
      model,
      //   file_ids,
    },
  );
  return updatedAssistant;
};

export const createAssistant = async (
  apiKey: string,
  name: string,
  description: string,
  model: string,
  instructions: string,
) => {
  const openaiClient = getOpenAIClient(apiKey);
  const assistant = await openaiClient.beta.assistants.create({
    name,
    description,
    instructions,
    model,
    tools: [{ type: 'retrieval' }],
  });
  return assistant;
};

export const deleteAssistantById = async (
  apiKey: string,
  assistantId: string
) => {
  const openaiClient = getOpenAIClient(apiKey);
  const response = await openaiClient.beta.assistants.del(assistantId);
  return response.deleted;
};

export const verifyOpenAiKey = async (apiKey: ApiKey) => {
  if (typeof apiKey !== 'string') {
    throw new Error('Invalid API key type for OpenAI verification');
  }

  const openaiClient = new OpenAI({
    apiKey: apiKey,
  });

  try {
    await openaiClient.models.list();
    return true;
  } catch (error) {
    return false;
  }
};
