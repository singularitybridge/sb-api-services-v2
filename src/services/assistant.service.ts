/// file_path: /src/services/assistant.service.ts
import OpenAI, { BadRequestError, NotFoundError } from 'openai';
import { Session } from '../models/Session';
import {
  createNewThread,
  deleteThread,
  getMessages,
  submitToolOutputs,
} from './oai.thread.service';
import { Assistant, IAssistant } from '../models/Assistant';
import mongoose from 'mongoose';
import { getApiKey } from './api.key.service';
import { createAssistant, deleteAssistantById } from './oai.assistant.service';

export const getOpenAIClient = (apiKey: string) => {
  return new OpenAI({
    apiKey,
  });
};

const handleError = (error: Error): string => {
  let response = 'Something went wrong, ';

  if (error instanceof NotFoundError) {
    response += 'Thread not found:' + error.message;
  } else if (error instanceof BadRequestError) {
    response += 'Bad request: ' + error.message;
    console.log('bad request');
  } else {
    throw error;
  }

  return response;
};

const pollRunStatus = async (
  apiKey: string,
  threadId: string,
  runId: string,
  sessionId: string,
  companyId: string,
  timeout: number = 45000,
) => {
  const startTime = Date.now();
  let lastRun;

  while (Date.now() - startTime < timeout) {
    const openaiClient = getOpenAIClient(apiKey);
    const run = await openaiClient.beta.threads.runs.retrieve(threadId, runId);
    console.log(`check run id:${runId} status: ${run.status}`);
    lastRun = run;

    const completedStatuses = ['completed', 'cancelled', 'failed', 'expired'];
    if (completedStatuses.includes(run.status)) {
      return run;
    }

    if (
      run.status === 'requires_action' &&
      run.required_action?.type === 'submit_tool_outputs'
    ) {
      await submitToolOutputs(
        openaiClient,
        threadId,
        runId,
        run.required_action.submit_tool_outputs.tool_calls,
        sessionId,
        companyId
      );
    }

    await new Promise((resolve) =>
      setTimeout(resolve, Math.min(500, timeout - (Date.now() - startTime))),
    );
  }

  throw new Error('Timeout exceeded while waiting for run to complete');
};

export async function getSessionMessages(apiKey:string, sessionId: string) {
  const session = await Session.findById(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }

  const messages = await getMessages(apiKey, session.threadId);
  return messages;
}

export const handleSessionMessage = async (
  apiKey: string,
  userInput: string,
  sessionId: string,
  metadata?: Record<string, string>,
): Promise<string> => {
  const session = await Session.findById(sessionId);
  if (!session || !session.active) {
    throw new Error('Invalid or inactive session');
  }

  const assistant = await Assistant.findOne({
    _id: new mongoose.Types.ObjectId(session.assistantId),
  });

  if (!assistant) {
    throw new Error('Assistant not found');
  }

  const messageCount = (await getMessages(apiKey, session.threadId)).length;
  const openaiClient = getOpenAIClient(apiKey);

  await openaiClient.beta.threads.messages.create(session.threadId, {
    role: 'user',
    content: userInput,
    metadata,
  });

  console.log('create new run', session.threadId, session.assistantId);

  const newRun = await openaiClient.beta.threads.runs.create(session.threadId, {
    assistant_id: assistant.assistantId as string,
    additional_instructions:
      messageCount === 0 ? assistant.introMessage : undefined,
  });

  const completedRun = await pollRunStatus(apiKey, session.threadId, newRun.id, sessionId, session.companyId);
  console.log('run completed > ' + completedRun.status);

  const messages = await openaiClient.beta.threads.messages.list(
    session.threadId,
  );
  // @ts-ignore
  const response = messages.data[0].content[0].text.value;
  return response;
};

export async function deleteAssistant(id: string, assistantId: string): Promise<void> {
  try {
    // First, find the assistant in the local database
    const assistant = await Assistant.findById(id);
    if (!assistant) {
      throw new Error('Assistant not found in local database');
    }

    // Delete the assistant from the local database
    await Assistant.findByIdAndDelete(id);

    // Attempt to delete the assistant from OpenAI
    try {
      const apiKey = await getApiKey(assistant.companyId.toString(), 'openai') as string;
      await deleteAssistantById(apiKey, assistantId, id);
    } catch (error) {
      // Log a warning if OpenAI deletion fails, but don't throw an error
      console.warn(`Warning: Failed to delete assistant from OpenAI: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    console.log(`Successfully deleted assistant ${id} from MongoDB.`);
  } catch (error) {
    console.error('Error in deleteAssistant:', error);
    throw error; // Re-throw the error to be caught by the route handler
  }
}

export async function createDefaultAssistant(companyId: string, apiKey: string): Promise<IAssistant> {
  const defaultAssistantData = {
    name: 'Default Assistant',
    description: 'Your company\'s default AI assistant',
    introMessage: 'Hello! I\'m your default AI assistant. How can I help you today?',
    voice: 'en-US-Standard-C',
    language: 'en',
    llmModel: 'gpt-4',
    llmPrompt: 'You are a helpful AI assistant for a new company. Provide friendly and professional assistance.',
    companyId: companyId,
  };

  const assistant = new Assistant(defaultAssistantData);
  await assistant.save();

  const openAIAssistant = await createAssistant(
    apiKey,
    companyId,
    assistant._id,
    assistant.name,
    assistant.description,
    assistant.llmModel,
    assistant.llmPrompt
  );

  assistant.assistantId = openAIAssistant.id;
  await assistant.save();

  return assistant;
}