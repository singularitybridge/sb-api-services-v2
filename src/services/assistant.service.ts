import OpenAI, { BadRequestError, NotFoundError } from 'openai';
import { submitToolOutputs } from '../helpers/assistant/functionFactory';
import { Session } from '../models/Session';
import { createNewThread, deleteThread, getMessages } from './oai.thread.service';
import { Assistant } from '../models/Assistant';

export const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
  threadId: string,
  runId: string,
  timeout: number = 45000,
) => {
  const startTime = Date.now();
  let lastRun;

  while (Date.now() - startTime < timeout) {
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

export const endSession = async (sessionId: string) => {
  const session = await Session.findById(sessionId);

  if (!session) return false;

  deleteThread(session.threadId);
  session.active = false;
  await session.save();

  console.log(
    `session ended, assistant: ${session.assistantId}, user: ${session.userId}`,
  );

  return true;
}

export async function getSessionMessages(sessionId: string) {
  const session = await Session.findById(sessionId);
  if (!session) {
      throw new Error('Session not found');
  }

  const messages = await getMessages(session.threadId);
  return messages;
}

export const handleSessionMessage = async (
  userInput: string,
  assistantId: string,
  userId: string,
) => {

  let threadId = ''; 


  if (!assistantId || !userId)
    return 'Something went wrong, assistantId or userId not found';

  let session = await Session.findOne({
    userId: userId,
    assistantId: assistantId,
    active: true,
  });

  if (!session) {
    
    threadId = await createNewThread();

    session = new Session({
      threadId: threadId,
      userId: userId,
      assistantId: assistantId,
      active: true,
    });

    await session.save();
  } else {
    threadId = session.threadId;
  }

  const assistant = await Assistant.findOne({ assistantId: assistantId });
  const messageCount = (await getMessages(threadId)).length;

  if (messageCount === 0 && assistant?.introMessage) {
    console.log('add intro message ...');
    // add the intro message to the thread
    await openaiClient.beta.threads.messages.create(session.threadId, {
      role: 'user',
      content: assistant.introMessage,
    });
  }

  /// handle user input and return response

  console.log('submit user input', userInput, threadId);

  await openaiClient.beta.threads.messages.create(threadId, {
    role: 'user',
    content: userInput,
  });

  console.log('create new run', threadId, assistantId);

  const newRun = await openaiClient.beta.threads.runs.create(threadId, {
    assistant_id: assistantId,
    // instructions: "additional instructions",
  });

  console.log(`new run created: ${newRun.id}, for thread: ${threadId}`);

  const completedRun = await pollRunStatus(threadId, newRun.id);
  console.log('run completed > ' + completedRun.status);

  const messages = await openaiClient.beta.threads.messages.list(threadId);
  // @ts-ignore
  const response = messages.data[0].content[0].text.value;
  return response;
};

// to be renamed to getAssistantResponse
export const handleUserInput = async (
  userInput: string,
  assistantId: string,
  threadId: string,
): Promise<string> => {
  try {
    await openaiClient.beta.threads.messages.create(threadId, {
      role: 'user',
      content: userInput,
    });

    const newRun = await openaiClient.beta.threads.runs.create(threadId, {
      assistant_id: assistantId,
      // instructions: "additional instructions",
    });

    console.log(`new run created: ${newRun.id}, for thread: ${threadId}`);

    const completedRun = await pollRunStatus(threadId, newRun.id);
    console.log('run completed > ' + completedRun.status);

    const messages = await openaiClient.beta.threads.messages.list(threadId);
    // @ts-ignore
    const response = messages.data[0].content[0].text.value;
    return response;
  } catch (error) {
    return handleError(error as Error);
  }
};
