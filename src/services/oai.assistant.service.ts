import OpenAI from 'openai';
import { getOpenAIClient } from './assistant.service';
import { ApiKey } from './verification.service';
import { cleanupAssistantFiles } from './file.service';
import { VectorStore } from '../models/VectorStore';
import {
  createFunctionFactory,
  ActionContext,
  FunctionFactory,
  FunctionDefinition,
  sanitizeFunctionName,
} from '../integrations/actions/factory';
import { SupportedLanguage } from './discovery.service';

// Helper function to extract o3-mini model info for API calls
// This preserves the original model name in the database while transforming it for API calls
const extractO3MiniModelInfo = (
  model: string,
): { baseModel: string; reasoningEffort?: 'low' | 'medium' | 'high' } => {
  // Check if the model follows the pattern o3-mini-{level}
  const o3MiniMatch = model.match(/^o3-mini-(low|medium|high)$/);

  if (o3MiniMatch) {
    return {
      baseModel: 'o3-mini',
      reasoningEffort: o3MiniMatch[1] as 'low' | 'medium' | 'high',
    };
  }

  // Return the original model if it doesn't match the pattern
  return { baseModel: model };
};

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

const createFunctionDefinitions = async (allowedActions: string[]) => {
  // Create a dummy context to generate function definitions
  const dummyContext: ActionContext = {
    sessionId: 'dummy-session-id',
    companyId: 'dummy-company-id',
    language: 'en' as SupportedLanguage,
  };

  // Use original allowedActions without sanitization
  const functionFactory = await createFunctionFactory(
    dummyContext,
    allowedActions,
  );

  // Create function definitions with sanitized names
  return Object.entries(functionFactory as FunctionFactory).map(
    ([funcName, funcDef]: [string, FunctionDefinition]) => ({
      type: 'function' as const,
      function: {
        name: funcName, // This is already sanitized
        description: funcDef.description,
        parameters: funcDef.parameters,
      },
    }),
  );
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

  // Create function definitions based on allowed actions
  const functionTools = await createFunctionDefinitions(allowedActions);

  // Extract model info for o3-mini models (only for API call, not for storage)
  const { baseModel, reasoningEffort } = extractO3MiniModelInfo(model);

  try {
    // Create the update parameters
    const updateParams: any = {
      instructions,
      name,
      description,
      model: baseModel, // Use the transformed model name for the API call
      tools: [{ type: 'file_search' }, ...functionTools],
    };

    // Add reasoning_effort parameter if applicable
    if (reasoningEffort) {
      updateParams.reasoning_effort = reasoningEffort;
    }

    const updatedAssistant = await openaiClient.beta.assistants.update(
      assistantId,
      updateParams,
    );

    // Validate that all allowed actions are present in the updated assistant
    const updatedTools = updatedAssistant.tools
      .filter((tool) => tool.type === 'function')
      .map((tool) => (tool as any).function.name);

    const missingActions = allowedActions.filter(
      (action) => !updatedTools.includes(sanitizeFunctionName(action)),
    );

    if (missingActions.length > 0) {
      console.warn(
        `Warning: The following actions were not successfully added to the OpenAI assistant: ${missingActions.join(
          ', ',
        )}`,
      );
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

  // Create function definitions based on allowed actions
  const functionTools = await createFunctionDefinitions(allowedActions);

  // Extract model info for o3-mini models (only for API call, not for storage)
  const { baseModel, reasoningEffort } = extractO3MiniModelInfo(model);

  try {
    // Create the assistant parameters
    const createParams: any = {
      name,
      description,
      instructions,
      model: baseModel, // Use the transformed model name for the API call
      tools: [{ type: 'file_search' }, ...functionTools],
    };

    // Add reasoning_effort parameter if applicable
    if (reasoningEffort) {
      createParams.reasoning_effort = reasoningEffort;
    }

    const assistant = await openaiClient.beta.assistants.create(createParams);

    // Create a new vector store
    const vectorStore = await openaiClient.vectorStores.create({
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
