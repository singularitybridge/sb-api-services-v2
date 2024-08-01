/// file_path: /src/services/oai.thread.service.ts
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
  const messageCount = (await getMessages(apiKey, session.threadId)).length;
  const openaiClient = getOpenAIClient(apiKey);

  await openaiClient.beta.threads.messages.create(session.threadId, {
    role: 'user',
    content: userInput,
    metadata,
  });

  console.log('create new run', session.threadId, session.assistantId);

  const newRun = await openaiClient.beta.threads.runs.create(session.threadId, {
    assistant_id: assistant?.assistantId as string,
    additional_instructions:
      messageCount === 0 ? assistant?.introMessage : undefined,
  });

  const completedRun = await pollRunStatus(apiKey, session.threadId, newRun.id);
  console.log('run completed > ' + completedRun.status);

  const messages = await openaiClient.beta.threads.messages.list(
    session.threadId,
  );
  // @ts-ignore
  const response = messages.data[0].content[0].text.value;
  return response;
};

// to be renamed to getAssistantResponse
export const handleUserInput = async (
  apiKey: string,
  userInput: string,
  assistantId: string,
  threadId: string,
): Promise<string> => {
  try {
    const openaiClient = getOpenAIClient(apiKey);
    await openaiClient.beta.threads.messages.create(threadId, {
      role: 'user',
      content: userInput,
    });

    const newRun = await openaiClient.beta.threads.runs.create(threadId, {
      assistant_id: assistantId,
      // instructions: "additional instructions",
    });

    console.log(`new run created: ${newRun.id}, for thread: ${threadId}`);

    const completedRun = await pollRunStatus(apiKey, threadId, newRun.id);
    console.log('run completed > ' + completedRun.status);

    const messages = await openaiClient.beta.threads.messages.list(threadId);
    // @ts-ignore
    const response = messages.data[0].content[0].text.value;
    return response;
  } catch (error) {
    return handleError(error as Error);
  }
};
