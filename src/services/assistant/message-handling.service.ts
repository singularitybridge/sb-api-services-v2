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
import { openai as openaiProvider } from '@ai-sdk/openai'; // Removed OpenAIChatModelId import
import { generateText, tool } from 'ai'; 
import { CoreMessage } from 'ai'; 
import { z, ZodTypeAny } from 'zod'; 


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
  
  // Initialize Vercel AI SDK client (e.g., OpenAI)
  const llmApiKey = await getApiKey(session.companyId.toString(), 'openai_api_key');
  if (!llmApiKey) {
    throw new Error('OpenAI API key not found for company.');
  }
  
  const modelName: string = assistant.llmModel || 'gpt-3.5-turbo'; // Corrected to assistant.llmModel
  console.log(`Using LLM model for session ${sessionId}: ${modelName}`); // Log the model name

  // System prompt
  const systemPrompt = await processTemplate(assistant.llmPrompt, sessionId.toString());

  // Construct messages for Vercel AI SDK, ensuring current user input is last
  const messagesForLlm: CoreMessage[] = [
    ...history, // history is already filtered and mapped
    { role: 'user', content: userInput }
  ];
  
  // LLM call using Vercel AI SDK's generateText which handles tool execution flow
  // Temporarily set environment variable for API key
  const originalOpenAIApiKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = llmApiKey as string;

  let llmResult;
  try {
    llmResult = await generateText({
      model: openaiProvider.chat(modelName as any, { // Reverted to 'as any' as OpenAIChatModelId is not exportable
        // apiKey is removed from here as it's expected to be picked from env
        // Other settings like temperature, maxTokens, etc., can be added here
      }),
      system: systemPrompt,
      messages: messagesForLlm,
      tools: toolsForSdk,
      maxSteps: 3, // Allow for a tool call, its result, and a final response. Min 2 for one tool roundtrip. Using 3 for a bit more buffer.
      onStepFinish: async ({ text, toolCalls, toolResults }) => { // Added for debugging
        console.log('onStepFinish Details:');
        if (text) console.log('  Text:', text);
        if (toolCalls && toolCalls.length > 0) console.log('  Tool Calls:', JSON.stringify(toolCalls, null, 2));
        if (toolResults && toolResults.length > 0) console.log('  Tool Results:', JSON.stringify(toolResults, null, 2));
      },
    });
  } finally {
    // Restore original environment variable
    if (originalOpenAIApiKey) {
      process.env.OPENAI_API_KEY = originalOpenAIApiKey;
    } else {
      delete process.env.OPENAI_API_KEY;
    }
  }

  // The generateText function with tools should handle the two-step call internally if tools are invoked.
  // The final `llmResult.text` should be the assistant's textual response after any tool use.
  // If `llmResult.toolCalls` is present, it means the model wants to call tools, and `generateText`
  // when provided with `execute` in tool definitions, handles calling them and re-prompting.

  if (!llmResult) {
    // This should ideally not happen if generateText resolves, but as a safeguard
    throw new Error('LLM result was not obtained.');
  }
  const responseText = llmResult.text;
  console.log(`Raw LLM response text: "${responseText}"`); // Log raw LLM response
  const processedResponse = await processTemplate(responseText, sessionId.toString());

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
