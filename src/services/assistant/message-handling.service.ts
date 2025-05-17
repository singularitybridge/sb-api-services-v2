import { Session } from '../../models/Session';
import { Assistant } from '../../models/Assistant';
import { Message, IMessage } from '../../models/Message'; // Added IMessage
import { processTemplate } from '../template.service';
import { ChannelType } from '../../types/ChannelType';
import { SupportedLanguage } from '../discovery.service'; // Added import
import mongoose from 'mongoose';
import { getMessagesBySessionId } from '../../services/message.service';
import { createFunctionFactory } from '../../integrations/actions/loaders';
import { executeFunctionCall } from '../../integrations/actions/executors';
import { FunctionCall } from '../../integrations/actions/types';
import { getApiKey } from '../api.key.service'; 

// Vercel AI SDK imports
import { generateText, tool, streamText, CoreMessage, StreamTextResult, Tool } from 'ai'; // Updated import
import { z, ZodTypeAny } from 'zod';
import { trimToWindow } from '../../utils/tokenWindow'; 
import { getProvider } from './provider.service'; 


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

// Removed custom StreamTextResultType

export const handleSessionMessage = async (
  userInput: string,
  sessionId: string,
  channel: ChannelType = ChannelType.WEB,
  metadata?: Record<string, string>,
): Promise<string | StreamTextResult<Record<string, Tool<any, any>>, unknown>> => { // Corrected return type
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
  console.log(`Fetched assistant details: Provider='${assistant.llmProvider}', Model='${assistant.llmModel}'`);

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

  const dbMessages = await getMessagesBySessionId(sessionId.toString());
  const history: CoreMessage[] = dbMessages
    .filter(msg => (msg.sender === 'user' || msg.sender === 'assistant') && typeof msg.content === 'string')
    .map((msg: IMessage) => ({
      role: msg.sender as 'user' | 'assistant',
      content: msg.content as string, 
    }));

  const actionContext = { sessionId: sessionId.toString(), companyId: session.companyId.toString(), language: session.language as SupportedLanguage };
  const functionFactory = await createFunctionFactory(actionContext, assistant.allowedActions);
  
  const toolsForSdk: Record<string, Tool<any, any>> = {}; // Changed type to Tool<any, any>
  for (const funcName in functionFactory) {
    const funcDef = functionFactory[funcName];
    const zodShape: Record<string, ZodTypeAny> = {};
    if (funcDef.parameters && funcDef.parameters.properties) {
      for (const paramName in funcDef.parameters.properties) {
        const paramDef = funcDef.parameters.properties[paramName] as any;
        let zodType: ZodTypeAny;
        switch (paramDef.type) {
          case 'string': zodType = z.string(); break;
          case 'number': zodType = z.number(); break;
          case 'integer': zodType = z.number().int(); break;
          case 'boolean': zodType = z.boolean(); break;
          case 'array':
            if (paramDef.items && paramDef.items.type === 'string') zodType = z.array(z.string());
            else if (paramDef.items && paramDef.items.type === 'number') zodType = z.array(z.number());
            else if (paramDef.items && paramDef.items.type === 'boolean') zodType = z.array(z.boolean());
            else zodType = z.array(z.any());
            break;
          case 'object': zodType = z.record(z.any()); break;
          default: zodType = z.any();
        }
        if (paramDef.description) zodType = zodType.describe(paramDef.description);
        if (!funcDef.parameters.required?.includes(paramName)) zodType = zodType.optional();
        zodShape[paramName] = zodType;
      }
    }
    const zodSchema = Object.keys(zodShape).length > 0 ? z.object(zodShape) : z.object({});
    let executeFunc = async (args: any) => {
      const functionCallPayload: FunctionCall = { function: { name: funcName, arguments: JSON.stringify(args) } };
      const { result, error } = await executeFunctionCall(functionCallPayload, sessionId.toString(), session.companyId.toString(), assistant.allowedActions);
      if (error) {
        console.error(`Error in tool ${funcName} execution:`, error);
        throw new Error(typeof error === 'string' ? error : (error as any)?.message || 'Tool execution failed');
      }
      return result;
    };
    if (funcName === 'jira_fetchTickets') { // Special handling
      executeFunc = async (args: any) => {
        const { result: rawResult, error } = await executeFunctionCall({ function: { name: funcName, arguments: JSON.stringify(args) } }, sessionId.toString(), session.companyId.toString(), assistant.allowedActions);
        if (error) throw new Error(typeof error === 'string' ? error : (error as any)?.message || 'Tool execution failed');
        if (Array.isArray(rawResult)) return rawResult.map((ticket: any) => ({ key: ticket.key, summary: ticket.fields?.summary, status: ticket.fields?.status?.name }));
        return rawResult; 
      };
    }
    toolsForSdk[funcName] = tool({ description: funcDef.description, parameters: zodSchema, execute: executeFunc });
  }
  
  const providerKey = assistant.llmProvider;
  const modelIdentifier = assistant.llmModel || 'gpt-4o-mini';
  const llmApiKey = await getApiKey(session.companyId.toString(), `${providerKey}_api_key`);
  if (!llmApiKey) throw new Error(`${providerKey} API key not found for company.`);
    
  console.log(`Using LLM provider: ${providerKey}, model: ${modelIdentifier} for session ${sessionId}`);
  const shouldStream = metadata?.['X-Experimental-Stream'] === 'true';
  console.log(`Should stream: ${shouldStream}`);

  const systemPrompt = await processTemplate(assistant.llmPrompt, sessionId.toString());
  const messagesForLlm: CoreMessage[] = [...history, { role: 'user', content: userInput }];
  
  let maxPromptTokens: number;
  const defaultMaxTokens = 7000; 
  const gemini15MaxTokens = 20000; 
  const gpt4oMaxTokens = 8000;   

  switch (providerKey) {
    case 'google': maxPromptTokens = modelIdentifier?.includes('gemini-1.5') ? gemini15MaxTokens : defaultMaxTokens; break;
    case 'openai': 
      if (modelIdentifier?.includes('gpt-4o')) maxPromptTokens = gpt4oMaxTokens;
      else if (modelIdentifier?.includes('gpt-4')) maxPromptTokens = gpt4oMaxTokens;
      else maxPromptTokens = defaultMaxTokens;
      break;
    default: maxPromptTokens = defaultMaxTokens; break;
  }
  
  // Re-instating manual trimToWindow as SDK middleware is problematic
  const { trimmedMessages, tokensInPrompt: actualTokensInPrompt } = trimToWindow(messagesForLlm, maxPromptTokens);
  console.log(`Manual trim: Target tokens: ${maxPromptTokens}, Actual: ${actualTokensInPrompt}, Original msgs: ${messagesForLlm.length}, Trimmed msgs: ${trimmedMessages.length}`);

  let aggregatedResponse = '';
  let finalLlmResult: any; // This will hold StreamTextResult if not streaming

  try {
    const llm = getProvider(providerKey, modelIdentifier, llmApiKey as string);

    const slimToolsForIntent = (input: string, allTools: Record<string, Tool<any, any>>): Record<string, Tool<any, any>> => { // Changed type
      console.log(`Slimming tools for input: "${input}". Currently returning all ${Object.keys(allTools).length} tools.`);
      return allTools;
    };
    const relevantTools = slimToolsForIntent(userInput, toolsForSdk);

    const streamResult = await streamText({
      model: llm,
      system: systemPrompt,
      messages: trimmedMessages, 
      tools: relevantTools,
      maxSteps: 3, 
    });

    if (shouldStream) {
      console.log(`Returning stream object for session ${sessionId}`);
      return streamResult; // Return the whole StreamTextResult object
    } else {
      // Existing behavior: aggregate the response
      for await (const chunk of streamResult.textStream) {
        aggregatedResponse += chunk;
      }
      finalLlmResult = streamResult; // Store the full result for tool calls etc.
      if (finalLlmResult.toolCalls && (await finalLlmResult.toolCalls).length > 0) { // Await promises
        console.log('Tool Calls from streamText:', JSON.stringify(await finalLlmResult.toolCalls, null, 2));
      }
      if (finalLlmResult.toolResults && (await finalLlmResult.toolResults).length > 0) { // Await promises
        console.log('Tool Results from streamText:', JSON.stringify(await finalLlmResult.toolResults, null, 2));
      }
    }
  } catch (error) {
    console.error('Error during LLM stream processing or tool execution:', error);
    throw error;
  }

  if (!shouldStream) {
    if (!finalLlmResult) { // Check if finalLlmResult was populated
        throw new Error('LLM stream result was not obtained for non-streaming case.');
    }
    const processedResponse = await processTemplate(aggregatedResponse, sessionId.toString());
    const assistantMessage = new Message({
      sessionId: session._id,
      sender: 'assistant',
      content: processedResponse,
      assistantId: assistant._id,
      userId: session.userId,
      timestamp: new Date(),
      messageType: 'text',
    });
    await assistantMessage.save();
    return processedResponse;
  }
  
  // This path should not be reached if shouldStream is true, as streamResult would have been returned.
  // Adding a fallback throw to satisfy TypeScript if it thinks this path is possible for shouldStream=true.
  if (shouldStream) {
    console.error("Reached end of function in streaming mode without returning stream. This shouldn't happen.");
    throw new Error("Internal error: Failed to return stream in streaming mode.");
  }
  
  // Fallback for type checker, should ideally not be reached
  throw new Error("Unhandled case in handleSessionMessage");
};
