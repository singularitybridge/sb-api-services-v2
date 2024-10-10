import { Session } from '../../models/Session';
import { Assistant } from '../../models/Assistant';
import { Message } from '../../models/Message';
import { getOpenAIClient } from './openai-client.service';
import { processTemplate } from '../template.service';
import { ChannelType } from '../../types/ChannelType';
import { pollRunStatus } from './run-management.service';
import mongoose from 'mongoose';

const saveSystemMessage = async (
  sessionId: mongoose.Types.ObjectId,
  assistantId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId,
  content: string,
  messageType: string,
  data?: any
) => {
  const systemMessage = new Message({
    sessionId,
    sender: 'system',
    content,
    assistantId,
    userId,
    timestamp: new Date(),
    messageType,
    data,
  });
  await systemMessage.save();
};

export const handleCustomMessage = async (
  sessionId: string,
  messageType: string,
  content: string,
  data?: any
) => {
  const session = await Session.findById(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }

  const customMessage = new Message({
    sessionId: session._id,
    sender: 'system',
    content,
    assistantId: session.assistantId,
    userId: session.userId,
    timestamp: new Date(),
    messageType,
    data,
  });
  await customMessage.save();
};

export const handleIntegrationActionUpdate = async (
  sessionId: string,
  actionName: string,
  status: 'started' | 'completed' | 'failed',
  result?: any
) => {
  const content = `Integration action '${actionName}' ${status}`;
  await handleCustomMessage(sessionId, 'integration_action_update', content, { actionName, status, result });
};

export const handleProductOffer = async (
  sessionId: string,
  productName: string,
  price: number,
  description: string
) => {
  const content = `New product offer: ${productName}`;
  await handleCustomMessage(sessionId, 'product_offer', content, { productName, price, description });
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

  const userMessage = new Message({
    sessionId: session._id,
    sender: 'user',
    content: userInput,
    assistantId: assistant._id,
    userId: session.userId,
    timestamp: new Date(),
    messageType: 'text',
    data: metadata,
  });
  await userMessage.save();

  const createdMessage = await openaiClient.beta.threads.messages.create(session.threadId, {
    role: 'user',
    content: userInput,
    metadata,
  });

  await Message.findByIdAndUpdate(userMessage._id, { openAIMessageId: createdMessage.id });

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

  const assistantMessage = new Message({
    sessionId: session._id,
    sender: 'assistant',
    content: processedResponse,
    assistantId: assistant._id,
    userId: session.userId,
    timestamp: new Date(),
    messageType: 'text',
    openAIMessageId: messages.data[0].id,
  });
  await assistantMessage.save();

  return processedResponse;
};
