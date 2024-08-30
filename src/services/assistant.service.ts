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
import { processTemplate } from './template.service';
import { findUserByIdentifier, getUserById } from './user.service';
import { sendTelegramMessage as sendTelegramBotMessage } from './telegram.bot';
import { ChannelType } from '../types/ChannelType';

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
        companyId
      );
    }

    await new Promise((resolve) =>
      setTimeout(resolve, Math.min(500, timeout - (Date.now() - startTime))),
    );
  }

  throw new Error('Timeout exceeded while waiting for run to complete');
};

export async function getSessionMessages(apiKey: string, sessionId: string) {
  const session = await Session.findById(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }

  const messages = await getMessages(apiKey, session.threadId);
  
  // Process each message with the template
  const processedMessages = await Promise.all(messages.map(async (message) => {
    if (message.role === 'assistant' && message.content) {
      const processedContent = await Promise.all(message.content.map(async (content: { type: string; text?: { value: string } }) => {
        if (content.type === 'text' && content.text) {
          content.text.value = await processTemplate(content.text.value, sessionId);
        }
        return content;
      }));
      message.content = processedContent;
    }
    return message;
  }));

  return processedMessages;
}

const sendTelegramMessage = async (userId: string, message: string, companyId: string) => {
  console.log(`Attempting to send Telegram message to user ${userId}`);
  const user = await getUserById(userId);
  if (user) {
    const telegramId = user.identifiers.find(i => i.key === 'tg_user_id')?.value;
    if (telegramId) {
      console.log(`Found Telegram ID ${telegramId} for user ${userId}`);
      try {
        await sendTelegramBotMessage(companyId, parseInt(telegramId), message);
        console.log(`Successfully sent Telegram message to user ${userId}`);
      } catch (error) {
        console.error(`Error sending Telegram message to user ${userId}:`, error);
      }
    } else {
      console.log(`No Telegram ID found for user ${userId}`);
    }
  } else {
    console.log(`User ${userId} not found`);
  }
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

  const messageCount = (await getMessages(apiKey, session.threadId)).length;
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

  const completedRun = await pollRunStatus(apiKey, session.threadId, newRun.id, sessionId, session.companyId);
  console.log('run completed > ' + completedRun.status);

  const messages = await openaiClient.beta.threads.messages.list(
    session.threadId,
  );
  // @ts-ignore
  const response = messages.data[0].content[0].text.value;
  
  // Process the assistant's response with template placeholders
  const processedResponse = await processTemplate(response, sessionId);

  // Send both user input and assistant's response to Telegram only if the channel is 'telegram'
  if (channel === ChannelType.TELEGRAM) {
    console.log(`Sending Telegram message for user ${session.userId}`);
    await sendTelegramMessage(session.userId.toString(), processedResponse, session.companyId);
  }

  return processedResponse;
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
    introMessage: 'Hello {{user.name}}! I\'m your default AI assistant for {{company.name}}. How can I help you today?',
    voice: 'en-US-Standard-C',
    language: 'en',
    llmModel: 'gpt-4',
    llmPrompt: 'You are a helpful AI assistant for {{company.name}}. Your name is {{assistant.name}}. Provide friendly and professional assistance to {{user.name}}. When referring to the user, use their name {{user.name}} or their email {{user.email}}. Always include placeholders like {{user.name}} or {{company.name}} in your responses, as they will be automatically replaced with the actual values.',
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