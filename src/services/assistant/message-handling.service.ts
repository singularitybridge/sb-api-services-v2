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
import { getApiKey } from '../api.key.service'; // For OpenAI API key if needed by Vercel SDK

// Vercel AI SDK imports (assuming OpenAI provider for now)
// Note: Ensure 'ai' and '@ai-sdk/openai' are installed
import { openai as openaiProvider } from '@ai-sdk/openai'; // Reverted to original import
import { generateText, tool, streamText } from 'ai'; // Added streamText import
import { CoreMessage } from 'ai';
import { z, ZodTypeAny } from 'zod';
import { trimToWindow } from '../../utils/tokenWindow';
import { getProvider } from './providers'; // Added import for getProvider


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
  // Log the fetched assistant's provider and model fields for debugging
  console.log(`Fetched assistant details: Provider='${assistant.llmProvider}', Model='${assistant.llmModel}'`);

  // Save user message to our DB
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

  // 1. Retrieve message history from MongoDB
  const dbMessages = await getMessagesBySessionId(sessionId.toString());
  const history: CoreMessage[] = dbMessages
    .filter(msg => (msg.sender === 'user' || msg.sender === 'assistant') && typeof msg.content === 'string') // Ensure content is string
    .map((msg: IMessage) => ({
      role: msg.sender as 'user' | 'assistant',
      content: msg.content as string, 
      // TODO: Properly map stored tool calls and results to Vercel AI SDK's CoreMessage structure.
      // Example for assistant message with tool calls:
      // { role: 'assistant', content: 'Optional text', toolCalls: [{ toolCallId: string, toolName: string, args: object }] }
      // Example for tool result message:
      // { role: 'tool', content: [{ type: 'tool-result', toolCallId: string, toolName: string, result: any }] }
    }));

  // 2. Prepare tool definitions using Zod and the `tool` helper
  const actionContext = { sessionId: sessionId.toString(), companyId: session.companyId.toString(), language: session.language as SupportedLanguage };
  const functionFactory = await createFunctionFactory(actionContext, assistant.allowedActions);
  
  const toolsForSdk: Record<string, any> = {}; // Changed type to Record<string, any> to simplify type checking for now
  for (const funcName in functionFactory) {
    const funcDef = functionFactory[funcName];
    
    const zodShape: Record<string, ZodTypeAny> = {};
    if (funcDef.parameters && funcDef.parameters.properties) {
      for (const paramName in funcDef.parameters.properties) {
        const paramDef = funcDef.parameters.properties[paramName] as any; // Cast for simplicity, ideally type this better
        let zodType: ZodTypeAny;

        switch (paramDef.type) {
          case 'string':
            zodType = z.string();
            break;
          case 'number':
            zodType = z.number();
            break;
          case 'integer':
            zodType = z.number().int();
            break;
          case 'boolean':
            zodType = z.boolean();
            break;
          // Basic support for arrays of strings/numbers/booleans, extend as needed
          case 'array':
            if (paramDef.items && paramDef.items.type === 'string') zodType = z.array(z.string());
            else if (paramDef.items && paramDef.items.type === 'number') zodType = z.array(z.number());
            else if (paramDef.items && paramDef.items.type === 'boolean') zodType = z.array(z.boolean());
            else zodType = z.array(z.any()); // Fallback for complex or unspecified array items
            break;
          // Basic support for objects, extend as needed for nested schemas
          case 'object':
             // For simplicity, treating as z.record(z.any()) or z.object({}) if no properties defined for Zod.
             // A full recursive conversion would be needed for nested object schemas.
             // This example assumes flat or simple objects for parameters.
            zodType = z.record(z.any()); // Or z.object({}) if properties are not deeply defined for Zod here
            break;
          default:
            zodType = z.any();
        }

        if (paramDef.description) {
          zodType = zodType.describe(paramDef.description);
        }

        const isRequired = funcDef.parameters.required?.includes(paramName);
        if (!isRequired) {
          zodType = zodType.optional();
        }
        zodShape[paramName] = zodType;
      }
    }
    
    const zodSchema = Object.keys(zodShape).length > 0 ? z.object(zodShape) : z.object({});

    let executeFunc = async (args: any) => {
      const functionCallPayload: FunctionCall = {
        function: { name: funcName, arguments: JSON.stringify(args) },
      };
      const { result, error } = await executeFunctionCall(
        functionCallPayload,
        sessionId.toString(),
        session.companyId.toString(),
        assistant.allowedActions
      );
      if (error) {
        console.error(`Error in tool ${funcName} execution:`, error);
        throw new Error(typeof error === 'string' ? error : (error as any)?.message || 'Tool execution failed');
      }
      console.log(`Raw result from tool ${funcName}:`, JSON.stringify(result, null, 2));
      return result;
    };

    // Special handling for jira_fetchTickets to simplify its output for the LLM
    if (funcName === 'jira_fetchTickets') {
      executeFunc = async (args: any) => {
        const functionCallPayload: FunctionCall = {
          function: { name: funcName, arguments: JSON.stringify(args) },
        };
        const { result: rawResult, error } = await executeFunctionCall(
          functionCallPayload,
          sessionId.toString(),
          session.companyId.toString(),
          assistant.allowedActions
        );
        if (error) {
          console.error(`Error in tool ${funcName} execution:`, error);
          throw new Error(typeof error === 'string' ? error : (error as any)?.message || 'Tool execution failed');
        }
        
        console.log(`Raw result from tool ${funcName}:`, JSON.stringify(rawResult, null, 2));
        
        if (Array.isArray(rawResult)) {
          const simplifiedTickets = rawResult.map((ticket: any) => ({
            key: ticket.key,
            summary: ticket.fields?.summary,
            status: ticket.fields?.status?.name,
          }));
          console.log(`Simplified result for tool ${funcName}:`, JSON.stringify(simplifiedTickets, null, 2));
          return simplifiedTickets;
        }
        // If not an array (e.g. error object from executeFunctionCall or unexpected structure), return as is.
        return rawResult; 
      };
    }

    toolsForSdk[funcName] = tool({
      description: funcDef.description,
      parameters: zodSchema,
      execute: executeFunc
    });
  }
  
  // Initialize Vercel AI SDK client
  const providerKey = assistant.llmProvider; // Use the new llmProvider field
  const modelIdentifier = assistant.llmModel || 'gpt-4o-mini'; // Use existing llmModel, fallback to a default
                                                             // This fallback ensures a model is always chosen.
                                                             // Ideally, llmModel should be required or have a schema default
                                                             // if it's the primary model identifier.
                                                             // For now, 'gpt-4o-mini' is a general fallback.

  const llmApiKey = await getApiKey(session.companyId.toString(), `${providerKey}_api_key`); // Fetch API key based on llmProvider
  if (!llmApiKey) {
    throw new Error(`${providerKey} API key not found for company.`);
  }
    
  console.log(`Using LLM provider: ${providerKey}, model: ${modelIdentifier} for session ${sessionId}`);

  // System prompt
  const systemPrompt = await processTemplate(assistant.llmPrompt, sessionId.toString());

  // Construct messages for Vercel AI SDK, ensuring current user input is last
  const messagesForLlm: CoreMessage[] = [
    ...history, // history is already filtered and mapped
    { role: 'user', content: userInput }
  ];
  
  // Manually trim messages and log token count
  // Determine maxTokens based on provider and model for sliding window
  let maxPromptTokens: number;
  // Default to a conservative value if specific model isn't matched
  const defaultMaxTokens = 7000; // General default, leaving headroom from 8k
  const gemini15MaxTokens = 20000; // As per new requirement
  const gpt4oMaxTokens = 8000;    // As per new requirement

  switch (providerKey) { // providerKey is now assistant.llmProvider
    case 'google':
      if (modelIdentifier && modelIdentifier.includes('gemini-1.5')) { // modelIdentifier is assistant.llmModel
        maxPromptTokens = gemini15MaxTokens;
      } else {
        maxPromptTokens = defaultMaxTokens; // Or another Google-specific default
      }
      break;
    case 'openai':
      if (modelIdentifier && modelIdentifier.includes('gpt-4o')) { // Covers gpt-4o and gpt-4o-mini
        maxPromptTokens = gpt4oMaxTokens;
      } else if (modelIdentifier && modelIdentifier.includes('gpt-4')) {
        maxPromptTokens = gpt4oMaxTokens; // GPT-4 also often has 8k context windows in practice for prompts
      } else {
        maxPromptTokens = defaultMaxTokens; // e.g., for gpt-3.5-turbo
      }
      break;
    // case 'anthropic':
    // Add specific limits for Anthropic models if known, e.g., Claude 3 Sonnet might be ~28k prompt
    // For now, falls through to default
    default:
      maxPromptTokens = defaultMaxTokens;
      break;
  }
  
  const { trimmedMessages, tokensInPrompt: actualTokensInPrompt } = trimToWindow(messagesForLlm, maxPromptTokens);
  console.log(`Tokens in prompt (target: ${maxPromptTokens}, actual: ${actualTokensInPrompt}), Original message count: ${messagesForLlm.length}, Trimmed message count: ${trimmedMessages.length}`);

  // LLM call using Vercel AI SDK
  // Temporarily set environment variable for API key (as per original code structure,
  // because direct apiKey passing is not supported by the current @ai-sdk/openai version)
  const originalOpenAIApiKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = llmApiKey as string;

  let aggregatedResponse = '';
  let finalLlmResult: any; // To store the full result object from streamText

  try {
    // Get the language model instance using the provider factory
    const llm = getProvider(providerKey, modelIdentifier, llmApiKey as string);

    // Note: The manual trimToWindow is kept here.
    // SDK middleware would be ideal if versions were V4 compatible.

    // Placeholder for slimming tools based on intent (Optimization 5)
    // A real implementation would analyze userInput and filter toolsForSdk.
    const slimToolsForIntent = (input: string, allTools: Record<string, any>): Record<string, any> => {
      // TODO: Implement intent detection and tool filtering logic.
      // For now, returns all tools.
      console.log(`Slimming tools for input: "${input}". Currently returning all ${Object.keys(allTools).length} tools.`);
      return allTools;
    };
    const relevantTools = slimToolsForIntent(userInput, toolsForSdk);

    const streamResult = await streamText({ // Changed to streamText
      model: llm,
      system: systemPrompt,
      messages: trimmedMessages,
      tools: relevantTools, // Use potentially filtered tools
      maxSteps: 3,
      // onStepFinish is not a direct parameter for streamText like in generateText.
      // Tool calls and results are part of the yielded stream or final result object.
    });

    // Handle the stream
    // For now, aggregate the text stream to maintain current function signature.
    // True streaming to client would require further refactoring.
    for await (const chunk of streamResult.textStream) {
      aggregatedResponse += chunk;
      // In a true streaming setup, you would send `chunk` to the client here.
      // e.g., via WebSocket: session.socket.send(chunk);
      // or for Telegram: await sendTelegramChunk(session.userId.toString(), chunk, session.companyId.toString());
    }
    
    // The streamText result also contains toolCalls, toolResults, finishReason, usage
    finalLlmResult = streamResult; 
    // TODO: If tools were called, streamResult.toolCalls and streamResult.toolResults would be populated.
    // The Vercel SDK's streamText is expected to handle the tool execution loop internally
    // if `tools` with `execute` methods are provided. The `textStream` should be the final assistant response.
    // Logging these for now:
    if (finalLlmResult.toolCalls && finalLlmResult.toolCalls.length > 0) {
      console.log('Tool Calls from streamText:', JSON.stringify(finalLlmResult.toolCalls, null, 2));
    }
    if (finalLlmResult.toolResults && finalLlmResult.toolResults.length > 0) {
      console.log('Tool Results from streamText:', JSON.stringify(finalLlmResult.toolResults, null, 2));
    }

  } finally {
    // Restore original environment variable
    if (originalOpenAIApiKey) {
      process.env.OPENAI_API_KEY = originalOpenAIApiKey;
    } else {
      delete process.env.OPENAI_API_KEY;
    }
  }

  if (!finalLlmResult) {
    throw new Error('LLM stream result was not obtained.');
  }

  // Use the aggregated text
  console.log(`Aggregated LLM response text: "${aggregatedResponse}"`);
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
};
