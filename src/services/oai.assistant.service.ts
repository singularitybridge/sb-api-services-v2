// file path: src/services/oai.assistant.service.ts
import OpenAI from 'openai';
import { getOpenAIClient } from './assistant.service';
import { ApiKey } from './verification.service';
import Api from 'twilio/lib/rest/Api';
import { cleanupAssistantFiles } from './file.service';
import { VectorStore } from '../models/VectorStore';
import { createFunctionFactory, ActionContext } from '../actions';

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
  companyId: string,
  assistantId: string,
  name: string,
  description: string,
  model: string,
  instructions: string,
) => {
  console.log('Creating assistant');

  const openaiClient = getOpenAIClient(apiKey);

  // Create a dummy context to generate function definitions
  const dummyContext: ActionContext = { sessionId: 'dummy-session-id' };
  const functionFactory = createFunctionFactory(dummyContext);

  // Create function definitions based on functionFactory
  const functionDefinitions = Object.entries(functionFactory).map(([funcName, funcDef]) => ({
    type: "function" as const,
    function: {
      name: funcName,
      description: funcDef.description,
      parameters: funcDef.parameters
    }
  }));

  const assistant = await openaiClient.beta.assistants.create({
    name,
    description,
    instructions,
    model,
    tools: [
      { type: 'file_search' },
      ...functionDefinitions
    ],
  });

  // Create a new vector store
  const vectorStore = await openaiClient.beta.vectorStores.create({
    name: `${name} Vector Store`,
  });

  const newVectorStore = new VectorStore({
    openaiId: vectorStore.id,
    assistantId: assistantId,
    companyId: companyId,
    name: vectorStore.name,
  });
  await newVectorStore.save();

  return assistant;
};


export const deleteAssistantById = async (
  apiKey: string,
  assistantId: string,
  _id: string,
) => {
  const openaiClient = getOpenAIClient(apiKey);
  await cleanupAssistantFiles(_id, apiKey);
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
