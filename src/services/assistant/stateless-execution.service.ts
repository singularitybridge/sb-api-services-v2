import { IAssistant } from '../../models/Assistant';
import { processTemplate } from '../template.service';
import { SupportedLanguage } from '../discovery.service';
import { createFunctionFactory } from '../../integrations/actions/loaders';
import { executeFunctionCall } from '../../integrations/actions/executors';
import { FunctionCall } from '../../integrations/actions/types';
import { getApiKey } from '../api.key.service';
import { fetchGcpFileContent } from '../../integrations/gcp_file_fetcher/gcp_file_fetcher.service';
import axios from 'axios';
import { generateText, tool, streamText, CoreMessage, StreamTextResult, Tool, ImagePart, TextPart } from 'ai';
import { z, ZodTypeAny } from 'zod';
import { trimToWindow } from '../../utils/tokenWindow';
import { getProvider } from './provider.service';
// import { getSessionOrStatelessContext } from '../session.service'; // This utility was merged into getSessionById

// Helper function to clean action annotations from text
const cleanActionAnnotations = (text: string): string => {
  return text
    .replace(/\[Action:\s*[^\]]+\]/gi, '')
    .replace(/\[.*?action.*?\]/gi, '')
    .replace(/[ \t]+/g, ' ')
    .trim();
};

// Helper function to generate unique message IDs
const generateMessageId = (): string => {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

interface Attachment {
  fileId: string;
  url: string;
  mimeType: string;
  fileName: string;
}

interface ActionResult {
  success: boolean;
  data?: any;
  error?: string | Record<string, any>; // Allow error to be an object too
}

// Simple in-memory cache for toolsForSdk
const toolsCache = new Map<string, Record<string, Tool<any, any>>>();

export const executeAssistantStateless = async (
  assistant: IAssistant,
  userInput: string,
  companyId: string,
  userId: string, // Added userId for context if needed by tools
  attachments?: Attachment[],
  metadata?: Record<string, string>
): Promise<string | StreamTextResult<Record<string, Tool<any, any>>, unknown> | Record<string, any>> => {
  console.log(`Executing stateless assistant ${assistant.name} (ID: ${assistant._id}) for company ${companyId}`);

  const providerKey = assistant.llmProvider;
  const userMessageContentParts: (TextPart | ImagePart | any)[] = [{ type: 'text', text: userInput }];

  if (attachments && attachments.length > 0) {
    console.log(`Processing ${attachments.length} attachments for stateless execution with provider ${providerKey}`);
    for (const attachment of attachments) {
      if (attachment.mimeType.startsWith('image/')) {
        try {
          const response = await axios.get(attachment.url, { responseType: 'arraybuffer' });
          const imageBuffer = Buffer.from(response.data);
          userMessageContentParts.push({
            type: 'image',
            image: new Uint8Array(imageBuffer),
            mimeType: attachment.mimeType,
          });
        } catch (error) {
          console.error(`Error fetching image ${attachment.fileName}:`, error);
          (userMessageContentParts[0] as TextPart).text += `\n\n[Could not load image: ${attachment.fileName}]`;
        }
      } else if (attachment.fileId && attachment.mimeType === 'application/pdf') {
        try {
          const pdfBufferResult = await fetchGcpFileContent("stateless_execution", companyId, { fileId: attachment.fileId, returnAs: 'buffer' });
          if (pdfBufferResult.success && pdfBufferResult.data instanceof Buffer) {
            const fileContentResult = await fetchGcpFileContent("stateless_execution", companyId, { fileId: attachment.fileId, returnAs: 'string' });
            if (fileContentResult.success && typeof fileContentResult.data === 'string') {
              let pdfTextToAppend = fileContentResult.data;
              const MAX_PDF_TEXT_CHARS = 7000;
              if (pdfTextToAppend.length > MAX_PDF_TEXT_CHARS) {
                pdfTextToAppend = pdfTextToAppend.substring(0, MAX_PDF_TEXT_CHARS) + "\n\n[...PDF text truncated...]\n";
              }
              (userMessageContentParts[0] as TextPart).text += `\n\n--- Attached PDF: ${attachment.fileName} ---\n${pdfTextToAppend}\n--- End of File ---`;
            } else {
               (userMessageContentParts[0] as TextPart).text += `\n\n[Could not extract text from PDF: ${attachment.fileName}]`;
            }
          } else {
             (userMessageContentParts[0] as TextPart).text += `\n\n[Could not load PDF: ${attachment.fileName}]`;
          }
        } catch (error) {
          console.error(`Error processing PDF ${attachment.fileName}:`, error);
          (userMessageContentParts[0] as TextPart).text += `\n\n[Error loading PDF: ${attachment.fileName}]`;
        }
      } else if (attachment.fileId) {
        try {
          const fileContentResult = await fetchGcpFileContent("stateless_execution", companyId, { fileId: attachment.fileId, returnAs: 'string' });
          if (fileContentResult.success && typeof fileContentResult.data === 'string') {
            (userMessageContentParts[0] as TextPart).text += `\n\n--- Attached File: ${attachment.fileName} ---\n${fileContentResult.data}\n--- End of File ---`;
          } else {
            (userMessageContentParts[0] as TextPart).text += `\n\n[Could not load file: ${attachment.fileName}]`;
          }
        } catch (error) {
          console.error(`Error processing file ${attachment.fileName}:`, error);
          (userMessageContentParts[0] as TextPart).text += `\n\n[Error loading file: ${attachment.fileName}]`;
        }
      }
    }
  }

  const actionContext = {
    sessionId: "stateless_execution",
    companyId,
    language: assistant.language as SupportedLanguage,
    userId, // Pass userId
    assistantId: assistant._id.toString(),
    isStateless: true
    // getSession method removed from ActionContext
  };
  const cacheKey = `${assistant._id.toString()}-${JSON.stringify(assistant.allowedActions.slice().sort())}`;
  let toolsForSdk: Record<string, Tool<any, any>>;

  if (toolsCache.has(cacheKey)) {
    toolsForSdk = toolsCache.get(cacheKey)!;
  } else {
    toolsForSdk = {};
    const functionFactory = await createFunctionFactory(actionContext, assistant.allowedActions);
    for (const funcName in functionFactory) {
      const funcDef = functionFactory[funcName];
      const zodShape: Record<string, ZodTypeAny> = {};
      let saneRequiredParams: string[] = [];

      if (funcDef.parameters?.required && Array.isArray(funcDef.parameters.required) && funcDef.parameters.properties) {
        saneRequiredParams = funcDef.parameters.required.filter(reqParam =>
          typeof reqParam === 'string' && reqParam.trim() !== '' && funcDef.parameters.properties!.hasOwnProperty(reqParam)
        );
      }

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
            case 'object': zodType = z.record(z.string(), z.any()); break;
            default: zodType = z.any();
          }
          if (paramDef.description) zodType = zodType.describe(paramDef.description);
          if (!saneRequiredParams.includes(paramName)) {
            zodType = zodType.optional();
          }
          zodShape[paramName] = zodType;
        }
      }
      const zodSchema = Object.keys(zodShape).length > 0 ? z.object(zodShape) : z.object({});
      const currentFuncName = funcName;
      
      toolsForSdk[currentFuncName] = tool({
        description: funcDef.description,
        parameters: zodSchema,
        execute: async (args: any) => {
          console.log(`[Stateless Tool Execution] Attempting to execute function: ${currentFuncName} with args:`, args);
          // Directly use the functionFactory created with the stateless actionContext
          const factoryForStateless = await createFunctionFactory(actionContext, assistant.allowedActions);
          if (factoryForStateless[currentFuncName]) {
            try {
              // The functions in functionFactory expect ActionContext as their first argument if they need it,
              // but the Vercel AI SDK's tool.execute doesn't pass it directly.
              // The functions created by createFunctionFactory are already bound with their context or designed to use it.
              // The 'executeFunctionCall' service handles context internally. Here, we are bypassing it.
              // We need to ensure functions from createFunctionFactory can run with just 'args'.
              // Most action functions from createFunctionFactory are of type (args: any) => Promise<ActionResult>
              // Let's assume they are structured to receive args directly.
              const toolResult = await factoryForStateless[currentFuncName].function(args) as ActionResult;

              if (toolResult && typeof toolResult === 'object' && 'success' in toolResult) {
                if (!toolResult.success) {
                  const errorMessage = typeof toolResult.error === 'string' ? toolResult.error : JSON.stringify(toolResult.error);
                  console.error(`Error in stateless tool ${currentFuncName} execution:`, errorMessage);
                  // Return a string representation of the error for the LLM
                  return `Error: ${errorMessage || 'Action failed'}`;
                }
                return toolResult.data; // Return data on success
              }
              // If the result is not in the expected { success, data/error } format, return it as is.
              return toolResult; // This might happen if a tool returns a primitive or unexpected structure
            } catch (e: any) {
              console.error(`Exception during stateless tool ${currentFuncName} execution:`, e);
              return `Exception: ${e.message || 'Tool execution failed with an exception'}`;
            }
          } else {
            console.error(`Function ${currentFuncName} not found in stateless factory.`);
            return `Error: Function ${currentFuncName} not implemented.`;
          }
        }
      });
    }
    toolsCache.set(cacheKey, toolsForSdk);
  }

  let modelIdentifier = assistant.llmModel || 'gpt-4o-mini';
  const llmApiKey = await getApiKey(companyId, `${providerKey}_api_key`);
  if (!llmApiKey) throw new Error(`${providerKey} API key not found for company.`);

  if (providerKey === 'google' && modelIdentifier && !modelIdentifier.startsWith('models/')) {
    modelIdentifier = `models/${modelIdentifier}`;
  }

  const shouldStream = metadata?.['X-Experimental-Stream'] === 'true';
  
  // For stateless execution, we'll use the prompt directly without template processing
  // or provide basic context if needed
  const systemPrompt = assistant.llmPrompt || "You are a helpful assistant.";

  const userMessageForLlm: CoreMessage = {
    role: 'user',
    content: userMessageContentParts,
  };

  // For stateless, history is just the current user message.
  // If you need to allow passing a short history, this would be the place to inject it.
  const messagesForLlm: CoreMessage[] = [userMessageForLlm]; 

  const TOKEN_LIMITS = {
    google: { 'gemini-1.5': 20000, default: 7000 },
    openai: { 'gpt-4o': 8000, 'gpt-4': 8000, 'gpt-4-turbo': 8000, default: 7000 },
    anthropic: {
      'claude-3-opus-20240229': 190000,
      'claude-3-sonnet-20240229': 190000,
      'claude-3-haiku-20240307': 190000,
      default: 100000
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
    else if (modelIdentifier?.includes('gpt-4-turbo')) maxPromptTokens = providerConfig['gpt-4-turbo' as keyof typeof providerConfig];
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

  let { trimmedMessages } = trimToWindow(messagesForLlm, maxPromptTokens);

  if (providerKey === 'anthropic') {
    trimmedMessages = [{ role: 'system', content: systemPrompt }, ...trimmedMessages.filter(m => m.role !== 'system')];
  }

  try {
    const llm = getProvider(providerKey, modelIdentifier, llmApiKey as string);
    const relevantTools = toolsForSdk; // For stateless, all tools of the assistant are relevant

    if (shouldStream) {
      const streamCallOptions: Parameters<typeof streamText>[0] = {
        model: llm,
        messages: trimmedMessages,
        tools: relevantTools,
        maxSteps: 3, // Consider making this configurable per assistant or request
      };
      if (systemPrompt !== undefined && providerKey !== 'anthropic') { // Anthropic handles system prompt in messages
        streamCallOptions.system = systemPrompt;
      }
      const streamResult = await streamText(streamCallOptions);
      // The route handler will process the stream. We just return it.
      // We also need to return tool calls and results if any, for the route to save.
      // This requires a slight modification to how streamResult is consumed or what this function returns.
      // For now, let's assume the route handles the full stream object.
      return streamResult; 
    } else {
      const generateCallOptions: Parameters<typeof generateText>[0] = {
        model: llm,
        messages: trimmedMessages,
        tools: relevantTools,
        maxSteps: 3,
      };
      if (systemPrompt !== undefined && providerKey !== 'anthropic') {
        generateCallOptions.system = systemPrompt;
      }
      const result = await generateText(generateCallOptions);
      const cleanedResponse = cleanActionAnnotations(result.text);
      // Skip template processing for stateless execution
      const processedResponse = cleanedResponse;

      const responsePayload: Record<string, any> = {
        id: generateMessageId(),
        role: "assistant",
        content: [{ type: "text", text: { value: processedResponse } }],
        created_at: Math.floor(Date.now() / 1000),
        assistant_id: assistant._id.toString(),
        message_type: "text",
        data: {}
      };

      if (result.toolCalls && result.toolCalls.length > 0) {
        responsePayload.message_type = 'tool_calls';
        responsePayload.data.toolCalls = result.toolCalls;
      }
      if (result.toolResults && result.toolResults.length > 0) {
        if (responsePayload.message_type !== 'tool_calls') {
            responsePayload.message_type = 'tool_results';
        }
        responsePayload.data.toolResults = result.toolResults;
      }
      return responsePayload;
    }
  } catch (error: any) {
    console.error('Error during stateless LLM processing or tool execution:', error);
    throw error;
  }
};
