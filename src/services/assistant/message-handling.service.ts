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
// import util from 'node:util'; // No longer needed after debug log removal

// Simple in-memory cache for toolsForSdk
const toolsCache = new Map<string, Record<string, Tool<any, any>>>();

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
    sessionId: new mongoose.Types.ObjectId(session._id),
    sender: 'user',
    content: userInput,
    assistantId: new mongoose.Types.ObjectId(assistant._id),
    userId: new mongoose.Types.ObjectId(session.userId),
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
  
  const cacheKey = `${assistant._id.toString()}-${JSON.stringify(assistant.allowedActions.slice().sort())}`;
  let toolsForSdk: Record<string, Tool<any, any>>;

  if (toolsCache.has(cacheKey)) {
    toolsForSdk = toolsCache.get(cacheKey)!;
    console.log(`Using cached toolsForSdk for assistant ${assistant._id}`);
  } else {
    toolsForSdk = {};
    const functionFactory = await createFunctionFactory(actionContext, assistant.allowedActions);
    for (const funcName in functionFactory) {
      const funcDef = functionFactory[funcName];
      const zodShape: Record<string, ZodTypeAny> = {};
    let saneRequiredParams: string[] = [];

    // Sanitize the original 'required' array to only include parameters that are actually defined in 'properties'
    // and are valid non-empty strings.
    if (funcDef.parameters?.required && Array.isArray(funcDef.parameters.required) && funcDef.parameters.properties) {
        saneRequiredParams = funcDef.parameters.required.filter(reqParam => 
            typeof reqParam === 'string' && reqParam.trim() !== '' && funcDef.parameters.properties!.hasOwnProperty(reqParam)
        );
    }
    // If funcDef.parameters.required is not a valid array or properties are missing, 
    // saneRequiredParams will remain empty. This means all Zod properties will become optional by default later.

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
          case 'object': zodType = z.record(z.string(), z.any()); break; // Changed to z.record(z.string(), z.any())
          default: zodType = z.any();
        }
        if (paramDef.description) zodType = zodType.describe(paramDef.description);
        
        // A Zod property is made optional if its name is NOT in our sanitized 'saneRequiredParams' list.
        // If 'saneRequiredParams' is empty, all properties become optional.
        if (!saneRequiredParams.includes(paramName)) {
            zodType = zodType.optional();
        }
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
    toolsCache.set(cacheKey, toolsForSdk);
    console.log(`Cached toolsForSdk for assistant ${assistant._id}`);
  }
  
  const providerKey = assistant.llmProvider;
  let modelIdentifier = assistant.llmModel || 'gpt-4o-mini'; // Changed to let
  const llmApiKey = await getApiKey(session.companyId.toString(), `${providerKey}_api_key`);
  if (!llmApiKey) throw new Error(`${providerKey} API key not found for company.`);

  if (providerKey === 'google' && modelIdentifier && !modelIdentifier.startsWith('models/')) {
    modelIdentifier = `models/${modelIdentifier}`;
    console.log(`Prefixed Google model ID: ${modelIdentifier}`);
  }
    
  console.log(`Using LLM provider: ${providerKey}, model: ${modelIdentifier} for session ${sessionId}`);
  const shouldStream = metadata?.['X-Experimental-Stream'] === 'true';
  console.log(`Should stream: ${shouldStream}`);

  const systemPrompt = await processTemplate(assistant.llmPrompt, sessionId.toString());
  const messagesForLlm: CoreMessage[] = [...history, { role: 'user', content: userInput }];
  
  const TOKEN_LIMITS = {
    google: { 'gemini-1.5': 20000, default: 7000 }, // Example, confirm actual limits
    openai: { 'gpt-4o': 8000, 'gpt-4': 8000, 'gpt-4-turbo': 8000, default: 7000 }, // Added gpt-4-turbo
    anthropic: { 
      'claude-3-opus-20240229': 190000, 
      'claude-3-sonnet-20240229': 190000,
      'claude-3-haiku-20240307': 190000,
      default: 100000 // Increased default for other Anthropic models
    },
    default: { default: 7000 } 
  } as const;
  
  let maxPromptTokens: number;
  const providerConfig = TOKEN_LIMITS[providerKey as keyof typeof TOKEN_LIMITS] || TOKEN_LIMITS.default;
  
  if (providerKey === 'google') {
    maxPromptTokens = modelIdentifier?.includes('gemini-1.5') 
      ? providerConfig['gemini-1.5' as keyof typeof providerConfig] 
      : providerConfig.default;
  } else if (providerKey === 'openai') {
    if (modelIdentifier?.includes('gpt-4o')) maxPromptTokens = providerConfig['gpt-4o' as keyof typeof providerConfig];
    else if (modelIdentifier?.includes('gpt-4-turbo')) maxPromptTokens = providerConfig['gpt-4-turbo' as keyof typeof providerConfig]; // Added gpt-4-turbo
    else if (modelIdentifier?.includes('gpt-4')) maxPromptTokens = providerConfig['gpt-4' as keyof typeof providerConfig];
    else maxPromptTokens = providerConfig.default;
  } else if (providerKey === 'anthropic') {
    if (modelIdentifier && providerConfig.hasOwnProperty(modelIdentifier)) {
      maxPromptTokens = providerConfig[modelIdentifier as keyof typeof providerConfig];
    } else {
      maxPromptTokens = providerConfig.default;
    }
  } else {
    maxPromptTokens = providerConfig.default;
  }
  
  // Re-instating manual trimToWindow as SDK middleware is problematic
  let { trimmedMessages, tokensInPrompt: actualTokensInPrompt } = trimToWindow(messagesForLlm, maxPromptTokens); // Made trimmedMessages mutable
  console.log(`Manual trim: Target tokens: ${maxPromptTokens}, Actual: ${actualTokensInPrompt}, Original msgs: ${messagesForLlm.length}, Trimmed msgs: ${trimmedMessages.length}`);

  if (providerKey === 'anthropic') {
    console.log('Anthropic provider: Prepending system prompt to messages array as well.');
    // Ensure it's the very first message if other system messages could exist from history (though current logic filters them)
    trimmedMessages = [{ role: 'system', content: systemPrompt }, ...trimmedMessages.filter(m => m.role !== 'system')];
  }

  let aggregatedResponse = '';
  let finalLlmResult: Awaited<ReturnType<typeof generateText>> | undefined;

  try {
    const llm = getProvider(providerKey, modelIdentifier, llmApiKey as string);

    const slimToolsForIntent = (input: string, allTools: Record<string, Tool<any, any>>): Record<string, Tool<any, any>> => {
      // Reverted to original behavior: always return all tools.
      console.log(`Tool slimming disabled for input: "${input}". Returning all ${Object.keys(allTools).length} tools.`);
      return allTools;
    };
    const relevantTools = slimToolsForIntent(userInput, toolsForSdk);

    if (shouldStream) {
      const streamCallOptions: Parameters<typeof streamText>[0] = {
        model: llm,
        messages: trimmedMessages,
        tools: relevantTools,
        maxSteps: 3,
      };
      if (systemPrompt !== undefined) { // Using systemPrompt directly
        streamCallOptions.system = systemPrompt;
      }
      const streamResult = await streamText(streamCallOptions);
      
      // Asynchronously save the full response once the stream is complete.
      // This does not block returning the streamResult to the client.
      // The .text property on streamResult is a Promise<string> that resolves with the full text.
      // Asynchronously save the full response once the stream is complete.
      // This includes text, toolCalls, and toolResults.
      (async () => {
        try {
          // Await all necessary parts of the stream result
          const finalText = await streamResult.text;
          // Correctly await the promises for toolCalls and toolResults
          const toolCalls = await streamResult.toolCalls; 
          const toolResults = await streamResult.toolResults;

          console.log('Stream finished, saving full assistant message to DB.');
          if (finalText) console.log('Final text length:', finalText.length);
          if (toolCalls) console.log('Tool Calls:', JSON.stringify(toolCalls, null, 2));
          if (toolResults) console.log('Tool Results:', JSON.stringify(toolResults, null, 2));
          
          const processedResponse = await processTemplate(finalText, sessionId.toString());
          
          const assistantMessageData: Partial<IMessage> = {
            sessionId: new mongoose.Types.ObjectId(session._id),
            sender: 'assistant',
            content: processedResponse,
            assistantId: new mongoose.Types.ObjectId(assistant._id),
            userId: new mongoose.Types.ObjectId(session.userId),
            timestamp: new Date(),
            messageType: 'text', // Default to text
            data: {},
          };

          if (toolCalls && toolCalls.length > 0) {
            assistantMessageData.messageType = 'tool_calls'; // Or a more appropriate type
            assistantMessageData.data = { ...assistantMessageData.data, toolCalls: toolCalls };
          }
          if (toolResults && toolResults.length > 0) {
            // Ensure messageType reflects tool usage if not already set
            if (assistantMessageData.messageType !== 'tool_calls') {
                 assistantMessageData.messageType = 'tool_results'; // Or a more appropriate type
            }
            assistantMessageData.data = { ...assistantMessageData.data, toolResults: toolResults };
          }
          
          const assistantMessage = new Message(assistantMessageData);
          await assistantMessage.save();
          console.log('Assistant message from streamed response (with potential tool data) saved to DB.');

        } catch (dbError) {
          console.error('Error saving streamed assistant message to DB:', dbError);
        }
      })().catch(streamProcessingError => {
        // This catches errors if the streamResult.text promise itself rejects
        // (e.g., due to an error during the LLM generation after streaming has started)
        console.error('Error processing full streamed text for DB save:', streamProcessingError);
      });

      console.log(`Returning stream object for session ${sessionId} for client consumption.`);
      return streamResult;
    } else {
      // Use generateText for non-streaming case as per Point 4
      const generateCallOptions: Parameters<typeof generateText>[0] = {
        model: llm,
        messages: trimmedMessages,
        tools: relevantTools,
        maxSteps: 3,
      };
      if (systemPrompt !== undefined) { // Using systemPrompt directly
        generateCallOptions.system = systemPrompt;
      }
      const result = await generateText(generateCallOptions);
      aggregatedResponse = result.text; 
      finalLlmResult = result; 

      if (finalLlmResult.toolCalls && finalLlmResult.toolCalls.length > 0) {
        console.log('Tool Calls from generateText:', JSON.stringify(finalLlmResult.toolCalls, null, 2));
      }
      if (finalLlmResult.toolResults && finalLlmResult.toolResults.length > 0) {
        console.log('Tool Results from generateText:', JSON.stringify(finalLlmResult.toolResults, null, 2));
      }
    }
  } catch (error: any) { 
    let specificGeminiError = false;
    if (error && error.message) {
        const errorMessage = String(error.message).toLowerCase();
        if (errorMessage.includes('model not found') || 
            errorMessage.includes('permission denied') || 
            errorMessage.includes('api key not valid') ||
            errorMessage.includes('invalid api key')) {
            console.error('Gemini API Error (detected by message):', error);
            specificGeminiError = true;
        }
    }
    if (!specificGeminiError) {
        console.error('Error during LLM processing or tool execution:', error);
    }
    throw error;
  }

  if (!shouldStream) {
    if (!finalLlmResult) { 
        throw new Error('LLM result was not obtained for non-streaming case.');
    }
    const processedResponse = await processTemplate(aggregatedResponse, sessionId.toString());
    
    const assistantMessageData: Partial<IMessage> = {
      sessionId: new mongoose.Types.ObjectId(session._id),
      sender: 'assistant',
      content: processedResponse,
      assistantId: new mongoose.Types.ObjectId(assistant._id),
      userId: new mongoose.Types.ObjectId(session.userId),
      timestamp: new Date(),
      messageType: 'text', // Default to text
      data: {},
    };

    if (finalLlmResult.toolCalls && finalLlmResult.toolCalls.length > 0) {
      assistantMessageData.messageType = 'tool_calls'; // Or a more appropriate type
      assistantMessageData.data = { ...assistantMessageData.data, toolCalls: finalLlmResult.toolCalls };
    }
    if (finalLlmResult.toolResults && finalLlmResult.toolResults.length > 0) {
      // Ensure messageType reflects tool usage if not already set
      if (assistantMessageData.messageType !== 'tool_calls') {
           assistantMessageData.messageType = 'tool_results'; // Or a more appropriate type
      }
      assistantMessageData.data = { ...assistantMessageData.data, toolResults: finalLlmResult.toolResults };
    }

    const assistantMessage = new Message(assistantMessageData);
    await assistantMessage.save();
    
    // For non-streaming, the UI expects the text response directly, 
    // but the full message including tool data is saved.
    // If the UI needs tool data for non-streaming, the response structure here would need to change.
    // For now, returning processedResponse to maintain existing non-streaming behavior.
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
