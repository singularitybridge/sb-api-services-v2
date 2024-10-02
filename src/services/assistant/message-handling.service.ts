import { Session } from '../../models/Session';
import { Assistant } from '../../models/Assistant';
import { getOpenAIClient } from './openai-client.service';
import { processTemplate } from '../template.service';
import { ChannelType } from '../../types/ChannelType';
import { submitToolOutputs } from '../oai.thread.service';
import mongoose from 'mongoose';

const pollRunStatus = async (
  apiKey: string,
  threadId: string,
  runId: string,
  sessionId: string,
  companyId: string,
  allowedActions: string[],
  timeout: number = 90000,
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
        companyId,
        allowedActions
      );
    }

    await new Promise((resolve) =>
      setTimeout(resolve, Math.min(500, timeout - (Date.now() - startTime))),
    );
  }

  throw new Error('Timeout exceeded while waiting for run to complete');
};

export const handleSessionMessage = async (
  apiKey: string,
  userInput: string,
  sessionId: string,
  channel: ChannelType = ChannelType.WEB,
  metadata?: Record<string, string>,
): Promise<string> => {
  console.log(`Handling session message for session ${sessionId} on channel ${channel}`);
  const session = await Session.findById(sessionId);
  if (!session || !session.active || session.channel !== channel) {
    throw new Error('Invalid or inactive session, or channel mismatch');
  }

  const assistant = await Assistant.findOne({
    _id: new mongoose.Types.ObjectId(session.assistantId),
  });

  if (!assistant) {
    throw new Error('Assistant not found');
  }

  const messageCount = (await getOpenAIClient(apiKey).beta.threads.messages.list(session.threadId)).data.length;
  const openaiClient = getOpenAIClient(apiKey);

  await openaiClient.beta.threads.messages.create(session.threadId, {
    role: 'user',
    content: userInput,
    metadata,
  });

  console.log('create new run', session.threadId, session.assistantId);

  const processedIntroMessage = messageCount === 0
    ? await processTemplate(assistant.introMessage, sessionId)
    : undefined;

  const processedLlmPrompt = await processTemplate(assistant.llmPrompt, sessionId);

  const newRun = await openaiClient.beta.threads.runs.create(session.threadId, {
    assistant_id: assistant.assistantId as string,
    additional_instructions: processedIntroMessage,
    instructions: processedLlmPrompt,
  });

  const completedRun = await pollRunStatus(apiKey, session.threadId, newRun.id, sessionId, session.companyId, assistant.allowedActions);
  console.log('run completed > ' + completedRun.status);

  const messages = await openaiClient.beta.threads.messages.list(
    session.threadId,
  );
  // @ts-ignore
  const response = messages.data[0].content[0].text.value;
  
  const processedResponse = await processTemplate(response, sessionId);

  return processedResponse;
};