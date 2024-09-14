import OpenAI from 'openai';
import { getOpenAIClient } from './assistant.service';
import { ApiKey } from './verification.service';
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
  allowedActions: string[],
) => {
  const openaiClient = getOpenAIClient(apiKey);

  // Adjust allowedActions to remove service prefixes
  const adjustedAllowedActions = allowedActions.map(actionName => {
    const parts = actionName.split('.');
    return parts.length > 1 ? parts[1] : actionName;
  });

  // Create function definitions based on allowed actions
  const functionTools = createFunctionDefinitions(adjustedAllowedActions);

  try {
    const updatedAssistant = await openaiClient.beta.assistants.update(
      assistantId,
      {
        instructions,
        name,
        description,
        model,
        tools: [
          { type: 'file_search' },
          ...functionTools
        ],
      },
    );

    // Validate that all allowed actions are present in the updated assistant
    const updatedTools = updatedAssistant.tools
      .filter(tool => tool.type === 'function')
      .map(tool => (tool as any).function.name);

    // Map updated tools back to original action names with prefixes
    const updatedToolsWithPrefixes = updatedTools.map(actionName => {
      const originalAction = allowedActions.find(a => a.endsWith(actionName));
      return originalAction || actionName;
    });

    const missingActions = allowedActions.filter(action => !updatedToolsWithPrefixes.includes(action));

    if (missingActions.length > 0) {
      console.warn(`Warning: The following actions were not successfully added to the OpenAI assistant: ${missingActions.join(', ')}`);
    }

    return updatedAssistant;
  } catch (error) {
    console.error('Error updating OpenAI assistant:', error);
    throw new Error('Failed to update OpenAI assistant');
  }
};


export const createAssistant = async (
  apiKey: string,
  companyId: string,
  assistantId: string,
  name: string,
  description: string,
  model: string,
  instructions: string,
  allowedActions: string[],
) => {
  console.log('Creating assistant');

  const openaiClient = getOpenAIClient(apiKey);

  // Adjust allowedActions to remove service prefixes
  const adjustedAllowedActions = allowedActions.map(actionName => {
    const parts = actionName.split('.');
    return parts.length > 1 ? parts[1] : actionName;
  });

  // Create function definitions based on allowed actions
  const functionTools = createFunctionDefinitions(adjustedAllowedActions);

  try {
    const assistant = await openaiClient.beta.assistants.create({
      name,
      description,
      instructions,
      model,
      tools: [
        { type: 'file_search' },
        ...functionTools
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
  } catch (error) {
    console.error('Error creating OpenAI assistant:', error);
    throw new Error('Failed to create OpenAI assistant');
  }
};

const createFunctionDefinitions = (allowedActions: string[]) => {
  // Create a dummy context to generate function definitions
  const dummyContext: ActionContext = { sessionId: 'dummy-session-id', companyId: 'dummy-company-id' };

  // Adjust allowedActions to remove service prefixes
  const adjustedAllowedActions = allowedActions.map(actionName => {
    const parts = actionName.split('.');
    return parts.length > 1 ? parts[1] : actionName;
  });

  const functionFactory = createFunctionFactory(dummyContext, adjustedAllowedActions);

  // Create function definitions
  return Object.entries(functionFactory)
    .map(([funcName, funcDef]) => ({
      type: "function" as const,
      function: {
        name: funcName,
        description: funcDef.description,
        parameters: funcDef.parameters
      }
    }));
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
