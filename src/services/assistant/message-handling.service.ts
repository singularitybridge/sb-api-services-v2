import { Session } from '../../models/Session';
import { Assistant } from '../../models/Assistant';
import { Message, IMessage } from '../../models/Message'; // Added IMessage
import { processTemplate } from '../template.service';
import { SupportedLanguage } from '../discovery.service'; // Added import
import mongoose from 'mongoose';
import { getMessagesBySessionId } from '../../services/message.service';
import { createFunctionFactory } from '../../integrations/actions/loaders';
import { executeFunctionCall } from '../../integrations/actions/executors';
import { FunctionCall } from '../../integrations/actions/types';
import { getApiKey } from '../api.key.service';
import { downloadFile } from '../file-downloader.service';
import axios from 'axios'; // Added axios for fetching image data
import {
  calculateCost,
  logCostTracking,
  CostTrackingInfo,
} from '../../utils/cost-tracking';

// Vercel AI SDK imports
import {
  generateText,
  tool,
  streamText,
  ModelMessage,
  StreamTextResult,
  Tool,
  ImagePart,
  TextPart,
  stepCountIs,
} from 'ai';
import { z, ZodTypeAny } from 'zod';
import { trimToWindow } from '../../utils/tokenWindow';
import { getProvider, MODEL_CONFIGS } from './provider.service';
// import util from 'node:util'; // No longer needed after debug log removal

// Simple in-memory cache for toolsForSdk
const toolsCache = new Map<string, Record<string, Tool<any, any>>>();

// Helper function to clean action annotations from text
const cleanActionAnnotations = (text: string): string => {
  // Remove [Action: ...] annotations and similar patterns
  return text
    .replace(/\[Action:\s*[^\]]+\]/gi, '')
    .replace(/\[.*?action.*?\]/gi, '')
    .replace(/[ \t]+/g, ' ') // Only clean spaces/tabs, preserve newlines for markdown
    .trim();
};

// Helper function for Zod parsing diagnostics
function logParse(
  result: z.SafeParseReturnType<any, any>,
  fnName: string,
  raw: any,
) {
  if (!result.success) {
    console.error(`[ToolArgError] ${fnName} args failed Zod parse`, {
      raw,
      issues: result.error.issues,
    });
  }
}

const saveSystemMessage = async (
  sessionId: mongoose.Types.ObjectId,
  assistantId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId,
  content: string,
  messageType: string,
  data?: any,
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
  data?: any,
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
  result?: any,
) => {
  const content = `Integration action '${actionName}' ${status}`;
  await handleCustomMessage(sessionId, 'integration_action_update', content, {
    actionName,
    status,
    result,
  });
};

export const handleProductOffer = async (
  sessionId: string,
  productName: string,
  price: number,
  description: string,
) => {
  const content = `New product offer: ${productName}`;
  await handleCustomMessage(sessionId, 'product_offer', content, {
    productName,
    price,
    description,
  });
};

interface Attachment {
  fileId?: string;
  url?: string;
  data?: string; // Base64 encoded data
  mimeType: string;
  fileName: string;
}

type OpenAIImageUrlPart = {
  type: 'image_url';
  image_url: { url: string; detail?: 'low' | 'high' | 'auto' };
};

export const handleSessionMessage = async (
  userInput: string,
  sessionId: string,
  metadata?: Record<string, string>,
  attachments?: Attachment[],
): Promise<
  string | StreamTextResult<Record<string, Tool<any, any>>, unknown>
> => {
  const requestStartTime = Date.now();
  console.log(
    `[AI_REQUEST_START] Session: ${sessionId} | Input length: ${
      userInput.length
    } chars | Attachments: ${attachments ? attachments.length : 0}`,
  );

  if (attachments && attachments.length > 0) {
    const attachmentDetails = attachments.map((a) => ({
      name: a.fileName,
      type: a.mimeType,
      size: a.data ? Buffer.from(a.data, 'base64').length : 'url-based',
    }));
    console.log(
      `[ATTACHMENTS_INFO] Processing files:`,
      JSON.stringify(attachmentDetails, null, 2),
    );
  }
  // console.log(`Handling session message for session ${sessionId}`);
  console.log(`[handleSessionMessage] About to fetch session ${sessionId}`);
  const session = await Session.findById(sessionId);
  if (!session || !session.active) {
    console.error(
      `[handleSessionMessage] Session validation failed for ${sessionId}. Session: ${JSON.stringify(
        session,
      )}`,
    );
    throw new Error('Invalid or inactive session');
  }
  console.log(
    `[handleSessionMessage] Session ${sessionId} fetched successfully.`,
  );

  console.log(
    `[handleSessionMessage] About to fetch assistant ${session.assistantId}`,
  );
  const assistant = await Assistant.findOneAndUpdate(
    {
      _id: new mongoose.Types.ObjectId(session.assistantId),
    },
    {
      $set: { lastAccessedAt: new Date() },
    },
    {
      new: true,
    },
  );

  if (!assistant) {
    console.error(
      `[handleSessionMessage] Assistant not found for ID: ${session.assistantId}`,
    );
    throw new Error('Assistant not found');
  }
  console.log(
    `[handleSessionMessage] Assistant ${assistant._id} fetched successfully. Provider='${assistant.llmProvider}', Model='${assistant.llmModel}'`,
  );
  // console.log(`Fetched assistant details: Provider='${assistant.llmProvider}', Model='${assistant.llmModel}'`);
  const providerKey = assistant.llmProvider;
  let processedUserInput = userInput;
  // This will hold the parts for the user's message, including text, image, and file parts
  // Using a flexible type for modern PDF handling
  const userMessageContentParts: (TextPart | ImagePart | any)[] = [
    { type: 'text', text: processedUserInput },
  ];

  if (attachments && attachments.length > 0) {
    console.log(
      `[ATTACHMENT_PROCESSING_START] Processing ${attachments.length} files for provider: ${providerKey}`,
    );
    let attachmentIndex = 0;
    for (const attachment of attachments) {
      attachmentIndex++;
      console.log(
        `[PROCESSING_FILE] ${attachmentIndex}/${attachments.length}: ${attachment.fileName} (${attachment.mimeType})`,
      );

      if (attachment.mimeType.startsWith('image/')) {
        try {
          let imageBuffer: Buffer;

          if (attachment.data) {
            // Handle base64 encoded image data
            imageBuffer = Buffer.from(attachment.data, 'base64');
          } else if (attachment.url) {
            // Handle URL-based image (existing behavior)
            const response = await axios.get(attachment.url, {
              responseType: 'arraybuffer',
            });
            imageBuffer = Buffer.from(response.data);
          } else {
            throw new Error('Image attachment must have either data or url');
          }

          // Use Uint8Array for all providers (recommended approach)
          userMessageContentParts.push({
            type: 'image',
            image: new Uint8Array(imageBuffer),
            mimeType: attachment.mimeType,
          });
          // console.log(`Image attachment processed as Uint8Array for ${providerKey}: ${attachment.fileName}`);
        } catch (error) {
          // console.error(`Error processing image ${attachment.fileName}:`, error);
          // Append error info to the text part of the user message
          (userMessageContentParts[0] as TextPart).text +=
            `\n\n[Could not load image: ${attachment.fileName}]`;
        }
      } else if (attachment.url || attachment.data) {
        // Other non-image files (TXT, CSV, PDF, etc.)
        const isCSV =
          attachment.mimeType.includes('csv') ||
          attachment.fileName.toLowerCase().endsWith('.csv');
        console.log(
          `[FILE_TYPE] Processing ${isCSV ? 'CSV' : 'text'} file: ${
            attachment.fileName
          }`,
        );

        try {
          let fileContent: string;
          const downloadStart = Date.now();

          if (attachment.data) {
            // Handle base64 encoded file data
            const fileBuffer = Buffer.from(attachment.data, 'base64');
            fileContent = fileBuffer.toString('utf-8');
            console.log(
              `[FILE_DECODED] Decoded base64 data: ${fileBuffer.length} bytes`,
            );
          } else if (attachment.url) {
            // Handle URL-based file (existing behavior)
            console.log(`[FILE_DOWNLOAD_START] Downloading from URL...`);
            const fileBuffer = await downloadFile(attachment.url);
            fileContent = fileBuffer.toString('utf-8');
            console.log(
              `[FILE_DOWNLOADED] Downloaded ${fileBuffer.length} bytes in ${
                Date.now() - downloadStart
              }ms`,
            );
          } else {
            throw new Error('File attachment must have either data or url');
          }

          if (fileContent) {
            const contentLength = fileContent.length;
            const lineCount = fileContent.split('\n').length;
            console.log(
              `[FILE_CONTENT] Size: ${contentLength} chars, Lines: ${lineCount}`,
            );

            if (isCSV) {
              const rowCount = lineCount - 1; // Subtract header row
              console.log(`[CSV_INFO] Estimated rows: ${rowCount}`);
            }

            (userMessageContentParts[0] as TextPart).text +=
              `\n\n--- Attached File: ${attachment.fileName} ---\n${fileContent}\n--- End of File: ${attachment.fileName} ---`;
            console.log(`[FILE_APPENDED] Added to message content`);
          } else {
            // console.warn(`Could not fetch content for file: ${attachment.fileName} (ID: ${attachment.fileId}).`);
            (userMessageContentParts[0] as TextPart).text +=
              `\n\n[Could not load content for attached file: ${attachment.fileName}]`;
          }
        } catch (error) {
          // console.error(`Error processing file ${attachment.fileName}:`, error);
          (userMessageContentParts[0] as TextPart).text +=
            `\n\n[Error loading content for attached file: ${attachment.fileName}]`;
        }
      }
    }
    // IMPORTANT: processedUserInput for DB storage should ideally be the original text part,
    // without appended file contents if the file is sent as a separate blob.
    // The userMessageContentParts[0] is the TextPart.
    // If files were attached as blobs, their text content is NOT in userMessageContentParts[0].text.
    // If files were attached by appending text, their content IS in userMessageContentParts[0].text.
    // For simplicity in this change, we'll keep processedUserInput reflecting the primary text part.
    // The original user input is already stored in metadata.
    processedUserInput =
      (userMessageContentParts.find((part) => part.type === 'text') as TextPart)
        ?.text || userInput;
  }

  // Note: session and assistant are guaranteed to exist here due to earlier validation
  // The type assertions are safe because MongoDB documents always have _id
  const userMessage = new Message({
    sessionId: new mongoose.Types.ObjectId(session._id as string),
    sender: 'user',
    // Store the user's original typed text, or the text part if it was modified by errors/fallbacks.
    // Avoid storing large extracted PDF text here if the PDF is sent as a blob.
    content:
      (userMessageContentParts.find((part) => part.type === 'text') as TextPart)
        ?.text || userInput,
    assistantId: new mongoose.Types.ObjectId(assistant._id as string),
    userId: new mongoose.Types.ObjectId(session.userId as string),
    timestamp: new Date(),
    messageType:
      attachments && attachments.length > 0 ? 'file_upload_text' : 'text',
    data: {
      ...(metadata || {}),
      originalUserInput: userInput,
      attachments: attachments?.map((att) => ({
        fileName: att.fileName,
        mimeType: att.mimeType,
        fileId: att.fileId,
        url: att.url,
      })),
    },
  });
  console.log(
    `[handleSessionMessage] About to save user message for session ${sessionId}`,
  );
  await userMessage.save();
  console.log(
    `[handleSessionMessage] User message saved for session ${sessionId}`,
  );

  console.log(
    `[handleSessionMessage] About to fetch DB messages for session ${sessionId}`,
  );
  const dbMessages = await getMessagesBySessionId(sessionId.toString());
  console.log(
    `[handleSessionMessage] Fetched ${dbMessages.length} DB messages for session ${sessionId}`,
  );
  const history: ModelMessage[] = dbMessages
    .filter(
      (msg) =>
        (msg.sender === 'user' || msg.sender === 'assistant') &&
        typeof msg.content === 'string',
    )
    .map((msg: IMessage) => ({
      role: msg.sender as 'user' | 'assistant',
      content: msg.content as string,
    }));

  const actionContext = {
    sessionId: sessionId.toString(),
    companyId: session.companyId.toString(),
    language: session.language as SupportedLanguage,
    userId: session.userId.toString(),
    assistantId: assistant._id.toString(),
  };

  // Cache key includes userId to ensure each user gets tools with their own context
  const cacheKey = `${assistant._id.toString()}-${session.userId.toString()}-${JSON.stringify(
    assistant.allowedActions.slice().sort(),
  )}`;
  let toolsForSdk: Record<string, Tool<any, any>>;

  if (toolsCache.has(cacheKey)) {
    toolsForSdk = toolsCache.get(cacheKey)!;
    // console.log(`Using cached toolsForSdk for assistant ${assistant._id}`);
  } else {
    toolsForSdk = {};
    const functionFactory = await createFunctionFactory(
      actionContext,
      assistant.allowedActions,
    );
    console.log(
      `[handleSessionMessage] Function factory created for assistant ${
        assistant._id
      }. Found ${Object.keys(functionFactory).length} functions.`,
    );
    for (const funcName in functionFactory) {
      const funcDef = functionFactory[funcName];
      const zodShape: Record<string, ZodTypeAny> = {};
      let saneRequiredParams: string[] = [];

      if (
        funcDef.parameters?.required &&
        Array.isArray(funcDef.parameters.required) &&
        funcDef.parameters.properties
      ) {
        saneRequiredParams = funcDef.parameters.required.filter(
          (reqParam) =>
            typeof reqParam === 'string' &&
            reqParam.trim() !== '' &&
            funcDef.parameters.properties!.hasOwnProperty(reqParam),
        );
      }

      if (funcDef.parameters && funcDef.parameters.properties) {
        for (const paramName in funcDef.parameters.properties) {
          const paramDef = funcDef.parameters.properties[paramName] as any;
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
            case 'array':
              if (paramDef.items && typeof paramDef.items === 'object') {
                if (
                  paramDef.items.type === 'object' &&
                  paramDef.items.properties
                ) {
                  // Handle array of objects, like the 'attributes' array
                  const itemZodShape: Record<string, ZodTypeAny> = {};
                  for (const itemPropName in paramDef.items.properties) {
                    const itemPropDef = paramDef.items.properties[
                      itemPropName
                    ] as any;
                    let itemZodType: ZodTypeAny;
                    switch (itemPropDef.type) {
                      case 'string':
                        itemZodType = z.string();
                        break;
                      case 'number':
                        itemZodType = z.number();
                        break;
                      case 'boolean':
                        itemZodType = z.boolean();
                        break;
                      case 'array':
                        itemZodType = z.array(z.any());
                        break; // Nested arrays
                      case 'object':
                        itemZodType = z.record(z.string(), z.any());
                        break; // Nested objects
                      default:
                        itemZodType = z.any();
                    }
                    if (itemPropDef.description)
                      itemZodType = itemZodType.describe(
                        itemPropDef.description,
                      );
                    if (
                      paramDef.items.required &&
                      !paramDef.items.required.includes(itemPropName)
                    ) {
                      itemZodType = itemZodType.optional();
                    }
                    itemZodShape[itemPropName] = itemZodType;
                  }
                  zodType = z.array(z.object(itemZodShape));
                } else if (paramDef.items.type === 'string') {
                  zodType = z.array(z.string());
                } else if (paramDef.items.type === 'number') {
                  zodType = z.array(z.number());
                } else if (paramDef.items.type === 'boolean') {
                  zodType = z.array(z.boolean());
                } else {
                  zodType = z.array(z.any()); // Fallback for other primitive types or if type is not specified
                }
              } else {
                zodType = z.array(z.any()); // Default if items is not defined or not an object
              }

              // Add default for arrays
              if (paramDef.default !== undefined) {
                zodType = zodType.default(paramDef.default);
              }
              break;
            case 'object':
              if (paramDef.additionalProperties === true) {
                // open spec: any JSON value
                zodType = z.record(z.string(), z.any());
              } else if (typeof paramDef.additionalProperties === 'object') {
                const t = paramDef.additionalProperties.type;
                zodType =
                  t === 'string'
                    ? z.record(z.string(), z.string())
                    : t === 'number'
                      ? z.record(z.string(), z.number())
                      : t === 'boolean'
                        ? z.record(z.string(), z.boolean())
                        : z.record(z.string(), z.any());
              } else {
                zodType = z.record(z.string(), z.any());
              }
              break;
            default:
              zodType = z.any();
          }
          if (paramDef.description)
            zodType = zodType.describe(paramDef.description);

          if (!saneRequiredParams.includes(paramName)) {
            zodType = zodType.optional();
          }
          zodShape[paramName] = zodType;
        }
      }
      const zodSchema =
        Object.keys(zodShape).length > 0 ? z.object(zodShape) : z.object({});
      const currentFuncName = funcName;

      const executeFunc = async (args: any) => {
        const toolStartTime = Date.now();
        console.log(
          `[TOOL_EXECUTION_START] Function: ${currentFuncName} | Args:`,
          JSON.stringify(args, null, 2),
        );

        // Continue with validation...
        const parseResult = zodSchema.safeParse(args);
        logParse(parseResult, currentFuncName, args);
        if (!parseResult.success) {
          const errorMessage = `Invalid arguments for tool ${currentFuncName}: ${JSON.stringify(
            parseResult.error.issues,
          )}`;
          console.error(`[Tool Execution] ${errorMessage}`);
          // Return an error object that the LLM can process as a tool result
          return { success: false, error: errorMessage };
        }

        const currentSession = await Session.findById(sessionId);
        if (!currentSession) {
          console.error(
            `[Tool Execution] Session not found during tool execution for sessionId: ${sessionId}`,
          );
          throw new Error('Session not found during tool execution');
        }
        console.log(
          `[Tool Execution] Retrieved current session ID: ${currentSession._id.toString()}, company ID: ${currentSession.companyId.toString()}`,
        );

        const functionCallPayload: FunctionCall = {
          function: { name: currentFuncName, arguments: JSON.stringify(args) },
        };
        const { result, error } = await executeFunctionCall(
          functionCallPayload,
          currentSession._id.toString(),
          currentSession.companyId.toString(),
          assistant.allowedActions,
        );

        const toolDuration = Date.now() - toolStartTime;
        console.log(
          `[TOOL_EXECUTION_COMPLETE] Function: ${currentFuncName} | Duration: ${toolDuration}ms | Success: ${!error}`,
        );
        if (error) {
          // console.error(`Error in tool ${currentFuncName} execution:`, error);
          throw new Error(
            typeof error === 'string'
              ? error
              : (error as any)?.message || 'Tool execution failed',
          );
        }
        // Ensure result is never null or undefined
        return result ?? 'Action completed successfully';
      };

      // Type cast to avoid deep instantiation error
      toolsForSdk[funcName] = tool({
        description: funcDef.description,
        inputSchema: zodSchema as z.ZodType<any>,
        execute: executeFunc,
      } as any);
    }
    toolsCache.set(cacheKey, toolsForSdk);
    // console.log(`Cached toolsForSdk for assistant ${assistant._id}`);
  }

  let modelIdentifier = assistant.llmModel || 'gpt-4.1-mini';
  console.log(
    `[handleSessionMessage] About to get API key for provider ${providerKey} and company ${session.companyId.toString()}`,
  );
  const llmApiKey = await getApiKey(
    session.companyId.toString(),
    `${providerKey}_api_key`,
  );
  if (!llmApiKey) {
    console.error(
      `[handleSessionMessage] ${providerKey} API key not found for company ${session.companyId.toString()}.`,
    );
    throw new Error(`${providerKey} API key not found for company.`);
  }
  console.log(`[handleSessionMessage] API key for ${providerKey} obtained.`);

  if (
    providerKey === 'google' &&
    modelIdentifier &&
    !modelIdentifier.startsWith('models/')
  ) {
    modelIdentifier = `models/${modelIdentifier}`;
    // console.log(`Prefixed Google model ID: ${modelIdentifier}`);
  }

  // console.log(`Using LLM provider: ${providerKey}, model: ${modelIdentifier} for session ${sessionId}`);
  const shouldStream = metadata?.['X-Experimental-Stream'] === 'true';
  // console.log(`Original shouldStream: ${shouldStream}`);
  // shouldStream = false; // DIAGNOSTIC: Force non-streaming // REVERTED
  // console.log(`Forced shouldStream: ${shouldStream}`);

  console.log(
    `[handleSessionMessage] About to process system prompt template for session ${sessionId}`,
  );
  const systemPrompt = await processTemplate(
    assistant.llmPrompt,
    sessionId.toString(),
  );
  console.log(
    `[handleSessionMessage] System prompt processed for session ${sessionId}`,
  );

  // Construct user message content for LLM
  // The userMessageForLlm will now use the userMessageContentParts array
  const userMessageForLlm: ModelMessage = {
    role: 'user',
    content: userMessageContentParts, // This array contains text and formatted image parts
  };

  const messagesForLlm: ModelMessage[] = [...history];
  const lastHistoryMessage =
    history.length > 0 ? history[history.length - 1] : null;

  // Avoid direct duplication if the last history message is identical to the current user input text
  if (
    lastHistoryMessage &&
    lastHistoryMessage.role === 'user' &&
    typeof lastHistoryMessage.content === 'string' &&
    lastHistoryMessage.content === userInput &&
    userMessageContentParts.length === 1 &&
    userMessageContentParts[0].type === 'text' &&
    userMessageContentParts[0].text === userInput
  ) {
    console.log(
      '[handleSessionMessage] Last history message is identical to current user input text. Using only current input.',
    );
    messagesForLlm[messagesForLlm.length - 1] = userMessageForLlm; // Replace last history with current structured one
  } else {
    messagesForLlm.push(userMessageForLlm);
  }

  // console.log('Messages prepared for LLM (content parts might be complex):',
  //   messagesForLlm.map(m => ({
  //     role: m.role,
  //     contentPreview: Array.isArray(m.content)
  //       ? m.content.map(p => p.type === 'text' ? `${p.type}: ${p.text.substring(0,50)}...` : `${p.type}: [${(p as ImagePart).mimeType || 'image data'}]`).join(', ')
  //       : typeof m.content === 'string' ? m.content.substring(0,100) + '...' : 'Unknown content structure'
  //   }))
  // );

  // Use the assistant's configured maxTokens for input window
  const maxPromptTokens: number = assistant.maxTokens || 25000;

  console.log(
    `[TOKEN_WINDOW] Starting token window trimming. Max tokens: ${maxPromptTokens}, Messages: ${messagesForLlm.length}`,
  );
  const trimStart = Date.now();

  const {
    trimmedMessages: baseTrimmedMessages,
    tokensInPrompt: actualTokensInPrompt,
  } = trimToWindow(messagesForLlm, maxPromptTokens);
  let trimmedMessages = baseTrimmedMessages;

  console.log(
    `[TOKEN_WINDOW_COMPLETE] Trimming took ${
      Date.now() - trimStart
    }ms. Original: ${messagesForLlm.length} msgs, Trimmed: ${
      trimmedMessages.length
    } msgs, Tokens: ${actualTokensInPrompt}`,
  );

  if (messagesForLlm.length > trimmedMessages.length) {
    console.log(
      `[TOKEN_WINDOW_TRIMMED] Removed ${
        messagesForLlm.length - trimmedMessages.length
      } messages to fit token window`,
    );
  }

  // Handle the case where trimmedMessages is empty, especially after the trimToWindow call
  if (trimmedMessages.length === 0 && messagesForLlm.length > 0) {
    console.error(
      `[handleSessionMessage] All messages were trimmed for session ${sessionId}. This usually means the first message (e.g., with a large CSV) exceeded the token limit of ${maxPromptTokens}.`,
    );
    // Construct a user-facing error message to be sent back.
    // This part depends on how errors are propagated to the user.
    // For now, we'll throw an error that should be caught by the global error handler.
    // Ideally, this would be a more specific error type.
    throw new Error(
      `The content provided (e.g., an attached file) is too large to process. Please reduce the size and try again. Max token limit: ${maxPromptTokens}`,
    );
  }

  // console.log(`Manual trim: Target tokens: ${maxPromptTokens}, Actual: ${actualTokensInPrompt}, Original msgs: ${messagesForLlm.length}, Trimmed msgs: ${trimmedMessages.length}`);

  if (providerKey === 'anthropic') {
    // console.log('Anthropic provider: Prepending system prompt to messages array as well.');
    trimmedMessages = [
      { role: 'system', content: systemPrompt },
      ...trimmedMessages.filter((m) => m.role !== 'system'),
    ];
  }

  let aggregatedResponse = '';
  let finalLlmResult: Awaited<ReturnType<typeof generateText>> | undefined;

  try {
    // shouldStream = false; // DIAGNOSTIC: Force non-streaming // REVERTED
    console.log(
      `[handleSessionMessage] Streaming is ${
        shouldStream
          ? 'ENABLED'
          : 'DISABLED (check metadata or diagnostic override)'
      }`,
    );
    const llm = getProvider(providerKey, modelIdentifier, llmApiKey as string);

    const slimToolsForIntent = (
      input: string,
      allTools: Record<string, Tool<any, any>>,
    ): Record<string, Tool<any, any>> => {
      // console.log(`Tool slimming disabled for input: "${input}". Returning all ${Object.keys(allTools).length} tools.`);
      return allTools;
    };
    const relevantTools = slimToolsForIntent(userInput, toolsForSdk);

    if (shouldStream) {
      const streamCallOptions: Parameters<typeof streamText>[0] = {
        model: llm,
        messages: trimmedMessages, // This now contains correctly formatted multimodal messages
        tools: relevantTools,
        maxRetries: 2,
        stopWhen: stepCountIs(10), // Stop after 10 tool steps
      };
      if (systemPrompt !== undefined) {
        streamCallOptions.system = systemPrompt;
      }

      // Add provider-specific options from model config
      const modelConfig = MODEL_CONFIGS[modelIdentifier];
      if (modelConfig?.providerOptions) {
        Object.assign(streamCallOptions, modelConfig.providerOptions);
      }

      let streamResult: any;
      let streamErrorOccurred = false;
      let streamErrorMessage = '';

      try {
        console.log(
          `[AI_STREAM_START] Model: ${modelIdentifier} | Provider: ${providerKey} | Tools: ${
            Object.keys(relevantTools).length
          } | Messages: ${
            trimmedMessages.length
          } | Tokens: ${actualTokensInPrompt}`,
        );

        const streamStartTime = Date.now();
        streamResult = await streamText(streamCallOptions);

        console.log(
          `[AI_STREAM_INITIATED] Stream created in ${
            Date.now() - streamStartTime
          }ms. Waiting for response...`,
        );

        // Monitor stream progress for O3 and other slow models
        if (modelIdentifier.includes('o3') || modelIdentifier.includes('O3')) {
          console.log(
            `[O3_MODEL_WARNING] Using O3 model (${modelIdentifier}) - this model may take 30-200+ seconds to respond`,
          );
        }

        // Set up periodic progress logging for long-running streams
        let progressLogInterval: NodeJS.Timeout | null = null;
        const lastProgressTime = Date.now();
        let chunksReceived = 0;

        progressLogInterval = setInterval(() => {
          const elapsed = Math.floor((Date.now() - streamStartTime) / 1000);
          console.log(
            `[STREAM_PROGRESS] Still waiting for ${modelIdentifier} response... ${elapsed}s elapsed | Session: ${sessionId}`,
          );
        }, 10000); // Log every 10 seconds

        // Monitor the text stream for first chunk
        (async () => {
          try {
            let firstChunkTime: number | null = null;
            // textStream is a ReadableStream, not a promise
            for await (const chunk of streamResult.textStream) {
              chunksReceived++;
              if (!firstChunkTime) {
                firstChunkTime = Date.now() - streamStartTime;
                console.log(
                  `[FIRST_CHUNK_RECEIVED] Got first chunk after ${firstChunkTime}ms | Model: ${modelIdentifier}`,
                );
                if (progressLogInterval) {
                  clearInterval(progressLogInterval);
                  progressLogInterval = null;
                }
              }

              // Log progress every 50 chunks
              if (chunksReceived % 50 === 0) {
                console.log(
                  `[STREAM_CHUNKS] Received ${chunksReceived} chunks | Elapsed: ${
                    Date.now() - streamStartTime
                  }ms`,
                );
              }
            }
          } catch (e: any) {
            // Don't log error if stream is already consumed (normal behavior)
            if (!e.message?.includes('already consumed')) {
              console.error(
                `[STREAM_MONITOR_ERROR] Error monitoring stream:`,
                e.message,
              );
            }
          }
        })();

        // Clean up interval when stream completes
        streamResult.text
          .then(() => {
            if (progressLogInterval) {
              clearInterval(progressLogInterval);
            }
          })
          .catch(() => {
            if (progressLogInterval) {
              clearInterval(progressLogInterval);
            }
          });
        console.log(
          `[handleSessionMessage] streamText call appears to have completed for session ${sessionId}.`,
        );
        // Log that streamResult was created successfully
        if (streamResult) {
          console.log(
            `[handleSessionMessage] StreamTextResult created successfully for session ${sessionId}. Stream properties available: text, usage, toolCalls, toolResults`,
          );
        }
      } catch (streamError: any) {
        console.error(
          `[handleSessionMessage] CRITICAL ERROR during streamText call for session ${sessionId}:`,
          streamError,
        );
        console.error(
          `[handleSessionMessage] StreamError Name: ${streamError.name}, Message: ${streamError.message}, Stack: ${streamError.stack}`,
        );
        console.error(
          `[handleSessionMessage] Model: ${modelIdentifier}, Provider: ${providerKey}, Tools: ${
            Object.keys(relevantTools).length
          }`,
        );
        if (streamError.response) {
          console.error(
            `[handleSessionMessage] StreamError Response Status: ${streamError.response?.status}`,
            `Body: ${JSON.stringify(streamError.response?.body)}`,
          );
        }
        if (streamError.cause) {
          console.error(
            `[handleSessionMessage] StreamError Cause:`,
            streamError.cause,
          );
        }

        // Check if this is an API key error
        const errorMessage = streamError.message?.toLowerCase() || '';
        if (
          errorMessage.includes('invalid api key') ||
          errorMessage.includes('api key not valid') ||
          errorMessage.includes('incorrect api key') ||
          errorMessage.includes('unauthorized') ||
          errorMessage.includes('401')
        ) {
          streamErrorOccurred = true;
          streamErrorMessage = `Invalid ${providerKey} API key. Please check your API key configuration.`;

          // Save a user-friendly error message
          await saveSystemMessage(
            new mongoose.Types.ObjectId(session._id as string),
            new mongoose.Types.ObjectId(assistant._id as string),
            new mongoose.Types.ObjectId(session.userId as string),
            streamErrorMessage,
            'error',
            {
              error: 'invalid_api_key',
              provider: providerKey,
              originalError: streamError.message,
            },
          );
        }

        throw streamError; // Re-throw to be caught by the outer try-catch
      }

      (async () => {
        try {
          const startTime = Date.now();
          const finalText = await streamResult.text;
          const toolCalls = await streamResult.toolCalls;
          const toolResults = await streamResult.toolResults;

          // Get usage data for cost tracking
          let usage: any;
          try {
            usage = await streamResult.usage;
          } catch (e) {
            console.log(
              `[handleSessionMessage] Could not get usage data: ${e}`,
            );
          }

          const streamDuration = Date.now() - startTime;
          console.log(
            `[AI_STREAM_COMPLETE] Duration: ${streamDuration}ms | Response length: ${
              finalText.length
            } chars | Tool calls: ${toolCalls?.length || 0}`,
          );

          // Log cost tracking information
          if (usage) {
            const duration = Date.now() - startTime;
            const costs = calculateCost(
              modelIdentifier,
              usage.inputTokens || 0,
              usage.outputTokens || 0,
            );

            const costInfo: CostTrackingInfo = {
              companyId: session.companyId?.toString() || 'unknown',
              assistantId: assistant._id.toString(),
              sessionId: sessionId.toString(),
              userId: session.userId?.toString() || 'unknown',
              provider: providerKey,
              model: modelIdentifier,
              inputTokens: usage.inputTokens || 0,
              outputTokens: usage.outputTokens || 0,
              totalTokens:
                usage.totalTokens ||
                (usage.inputTokens || 0) + (usage.outputTokens || 0),
              inputCost: costs.inputCost,
              outputCost: costs.outputCost,
              totalCost: costs.totalCost,
              timestamp: new Date(),
              duration,
              toolCalls: toolCalls?.length || 0,
              cached: false, // Can be enhanced later if SDK provides cached token info
              requestType: 'streaming' as any,
            };

            await logCostTracking(costInfo);
          }

          // Check for empty response - only treat as error if no tools were called
          if (!finalText || finalText.length === 0) {
            const hasToolResults = toolResults && toolResults.length > 0;
            const hasToolCalls = toolCalls && toolCalls.length > 0;

            if (!hasToolResults && !hasToolCalls) {
              // No text and no tool activity - this is an error
              console.error(
                `[handleSessionMessage] Empty response from LLM stream for session ${sessionId}.`,
              );
              console.error(
                `[handleSessionMessage] Model: ${modelIdentifier}, Provider: ${providerKey}`,
              );

              // Log streamResult properties for debugging
              try {
                const usage = await streamResult.usage;
                console.error(`[handleSessionMessage] Stream usage:`, usage);
              } catch (e) {
                console.error(
                  `[handleSessionMessage] Could not get stream usage:`,
                  e,
                );
              }

              // Save an error message to inform the user
              await saveSystemMessage(
                new mongoose.Types.ObjectId(session._id as string),
                new mongoose.Types.ObjectId(assistant._id as string),
                new mongoose.Types.ObjectId(session.userId as string),
                'Failed to generate response. Please check your API key configuration.',
                'error',
                {
                  error: 'empty_response',
                  provider: providerKey,
                  model: modelIdentifier,
                },
              );
              return;
            } else {
              // Tools were executed but no final text - this is normal for tool-heavy responses
              console.log(
                `[handleSessionMessage] No final text but tools were executed. Tool calls: ${toolCalls?.length || 0}, Tool results: ${toolResults?.length || 0}`,
              );
            }
          }

          if (toolCalls && toolCalls.length > 0) {
            console.log(
              `[handleSessionMessage] Detected Tool Calls: ${JSON.stringify(
                toolCalls,
                null,
                2,
              )}`,
            );
          } else {
            console.log(
              '[handleSessionMessage] No tool calls detected in streamResult.',
            );
          }
          if (toolResults && toolResults.length > 0) {
            console.log(
              `[handleSessionMessage] Detected Tool Results: ${JSON.stringify(
                toolResults,
                null,
                2,
              )}`,
            );
          } else {
            console.log(
              '[handleSessionMessage] No tool results detected in streamResult.',
            );
          }

          const cleanedText = cleanActionAnnotations(finalText);
          const processedResponse = await processTemplate(
            cleanedText,
            sessionId.toString(),
          );

          const assistantMessageData: Partial<IMessage> = {
            sessionId: new mongoose.Types.ObjectId(session._id as string),
            sender: 'assistant',
            content: processedResponse,
            assistantId: new mongoose.Types.ObjectId(assistant._id as string),
            userId: new mongoose.Types.ObjectId(session.userId as string),
            timestamp: new Date(),
            messageType: 'text',
            data: {},
          };

          if (toolCalls && toolCalls.length > 0) {
            assistantMessageData.messageType = 'tool_calls';
            assistantMessageData.data = {
              ...assistantMessageData.data,
              toolCalls: toolCalls,
            };
          }
          if (toolResults && toolResults.length > 0) {
            if (assistantMessageData.messageType !== 'tool_calls') {
              assistantMessageData.messageType = 'tool_results';
            }
            assistantMessageData.data = {
              ...assistantMessageData.data,
              toolResults: toolResults,
            };
          }

          const assistantMessage = new Message(assistantMessageData);
          await assistantMessage.save();
          // console.log('Assistant message from streamed response (with potential tool data) saved to DB.');
        } catch (dbError) {
          console.error(
            '[handleSessionMessage] Error saving streamed assistant message to DB:',
            dbError,
          );
        }
      })().catch((streamProcessingError) => {
        console.error(
          '[handleSessionMessage] Error processing full streamed text for DB save:',
          streamProcessingError,
        );
        if (streamProcessingError.stack) {
          console.error(
            '[handleSessionMessage] Stack trace:',
            streamProcessingError.stack,
          );
        }
      });

      // console.log(`Returning stream object for session ${sessionId} for client consumption.`);

      // If there was a stream initialization error, throw it to be caught by outer handler
      if (streamErrorOccurred) {
        throw new Error(streamErrorMessage || 'Stream initialization failed');
      }

      // Monitor the stream to catch empty responses and save error messages
      // Also attach an error indicator to the stream result for the route handler
      streamResult.text
        .then(async (text: string) => {
          if (!text || text.length === 0) {
            // Check if tools were executed - if so, empty text is not an error
            const toolCalls = await streamResult.toolCalls;
            const toolResults = await streamResult.toolResults;
            const hasToolActivity = (toolCalls && toolCalls.length > 0) || (toolResults && toolResults.length > 0);

            if (hasToolActivity) {
              console.log(
                `[handleSessionMessage] Stream completed with empty text but tools were executed for session ${sessionId}`,
              );
              return; // Not an error - tools were executed
            }

            console.error(
              `[handleSessionMessage] Stream completed with empty text for session ${sessionId}`,
            );
            // Attach error indicator to stream result
            (streamResult as any).hasEmptyResponse = true;
            const providerDisplayName =
              providerKey === 'google'
                ? 'Google'
                : providerKey === 'openai'
                  ? 'OpenAI'
                  : providerKey === 'anthropic'
                    ? 'Anthropic'
                    : providerKey;
            (streamResult as any).errorMessage =
              `Failed to generate response. Please check your ${providerDisplayName} API key configuration.`;

            // Save error message asynchronously
            saveSystemMessage(
              new mongoose.Types.ObjectId(session._id as string),
              new mongoose.Types.ObjectId(assistant._id as string),
              new mongoose.Types.ObjectId(session.userId as string),
              `Failed to generate response. Please check your ${providerKey} API key configuration.`,
              'error',
              { error: 'empty_response', provider: providerKey },
            ).catch((err) =>
              console.error('Failed to save error message:', err),
            );
          }
        })
        .catch((err: any) => {
          console.error(
            `[handleSessionMessage] Stream text promise rejected for session ${sessionId}:`,
            err,
          );
          // Attach error indicator to stream result
          (streamResult as any).hasStreamError = true;
          (streamResult as any).errorMessage = `Stream error: ${
            err.message || 'Unknown error'
          }`;

          // Save error message asynchronously
          saveSystemMessage(
            new mongoose.Types.ObjectId(session._id as string),
            new mongoose.Types.ObjectId(assistant._id as string),
            new mongoose.Types.ObjectId(session.userId as string),
            `Stream error: ${err.message || 'Unknown error'}`,
            'error',
            {
              error: 'stream_error',
              provider: providerKey,
              originalError: err.message,
            },
          ).catch((saveErr) =>
            console.error('Failed to save error message:', saveErr),
          );
        });

      // Attach provider information to the stream result
      (streamResult as any).provider = providerKey;

      const totalDuration = Date.now() - requestStartTime;
      console.log(
        `[AI_REQUEST_COMPLETE] Total duration: ${totalDuration}ms | Session: ${sessionId} | Mode: streaming`,
      );

      return streamResult;
    } else {
      const generateCallOptions: Parameters<typeof generateText>[0] = {
        model: llm,
        messages: trimmedMessages, // This now contains correctly formatted multimodal messages
        tools: relevantTools,
        maxRetries: 2,
        stopWhen: stepCountIs(10), // Stop after 10 tool steps
      };
      if (systemPrompt !== undefined) {
        generateCallOptions.system = systemPrompt;
      }

      // Add provider-specific options from model config (non-streaming)
      const modelConfigNonStream = MODEL_CONFIGS[modelIdentifier];
      if (modelConfigNonStream?.providerOptions) {
        Object.assign(
          generateCallOptions,
          modelConfigNonStream.providerOptions,
        );
      }
      // No separate experimental_attachments or attachments field needed here
      console.log(
        `[AI_GENERATE_START] Model: ${modelIdentifier} | Provider: ${providerKey} | Tools: ${
          Object.keys(relevantTools).length
        } | Messages: ${trimmedMessages.length}`,
      );

      const startTime = Date.now();
      const result = await generateText(generateCallOptions);
      const duration = Date.now() - startTime;

      console.log(
        `[AI_GENERATE_COMPLETE] Duration: ${duration}ms | Response length: ${
          result.text.length
        } chars | Tool calls: ${result.toolCalls?.length || 0}`,
      );

      aggregatedResponse = result.text;
      finalLlmResult = result;

      // Log cost tracking for non-streaming generateText
      if (result.usage) {
        const costs = calculateCost(
          modelIdentifier,
          result.usage.inputTokens || 0,
          result.usage.outputTokens || 0,
        );

        const costInfo: CostTrackingInfo = {
          companyId: session.companyId?.toString() || 'unknown',
          assistantId: assistant._id.toString(),
          sessionId: sessionId.toString(),
          userId: session.userId?.toString() || 'unknown',
          provider: providerKey,
          model: modelIdentifier,
          inputTokens: result.usage.inputTokens || 0,
          outputTokens: result.usage.outputTokens || 0,
          totalTokens:
            result.usage.totalTokens ||
            (result.usage.inputTokens || 0) + (result.usage.outputTokens || 0),
          inputCost: costs.inputCost,
          outputCost: costs.outputCost,
          totalCost: costs.totalCost,
          timestamp: new Date(),
          duration,
          toolCalls: finalLlmResult.toolCalls?.length || 0,
          cached: false,
          requestType: 'non-streaming' as any,
        };

        await logCostTracking(costInfo);
      }

      if (finalLlmResult.toolCalls && finalLlmResult.toolCalls.length > 0) {
        // console.log('Tool Calls from generateText:', JSON.stringify(finalLlmResult.toolCalls, null, 2));
      }
      if (finalLlmResult.toolResults && finalLlmResult.toolResults.length > 0) {
        // console.log('Tool Results from generateText:', JSON.stringify(finalLlmResult.toolResults, null, 2));
      }
    }
  } catch (error: any) {
    let specificGeminiError = false;
    if (error && error.message) {
      const errorMessage = String(error.message).toLowerCase();
      if (
        errorMessage.includes('model not found') ||
        errorMessage.includes('permission denied') ||
        errorMessage.includes('api key not valid') ||
        errorMessage.includes('invalid api key') ||
        errorMessage.includes('incorrect api key') ||
        errorMessage.includes('unauthorized') ||
        errorMessage.includes('401')
      ) {
        // console.error('Gemini API Error (detected by message):', error);
        specificGeminiError = true;

        // Save a user-friendly error message for API key errors
        await saveSystemMessage(
          new mongoose.Types.ObjectId(session._id as string),
          new mongoose.Types.ObjectId(assistant._id as string),
          new mongoose.Types.ObjectId(session.userId as string),
          `Invalid ${providerKey} API key. Please check your API key configuration.`,
          'error',
          {
            error: 'invalid_api_key',
            provider: providerKey,
            originalError: error.message,
          },
        );
      }
    }
    if (!specificGeminiError) {
      // console.error('Error during LLM processing or tool execution:', error);
    }
    throw error;
  }

  if (!shouldStream) {
    if (!finalLlmResult) {
      throw new Error('LLM result was not obtained for non-streaming case.');
    }

    // Check for empty response - only treat as error if no tools were called
    if (!aggregatedResponse || aggregatedResponse.length === 0) {
      const hasToolCalls = finalLlmResult.toolCalls && finalLlmResult.toolCalls.length > 0;
      const hasToolResults = finalLlmResult.toolResults && finalLlmResult.toolResults.length > 0;

      if (!hasToolCalls && !hasToolResults) {
        // No text and no tool activity - this is an error
        console.error(
          `[handleSessionMessage] Empty response from LLM for session ${sessionId}. This might indicate an invalid API key.`,
        );

        // Save an error message to inform the user
        await saveSystemMessage(
          new mongoose.Types.ObjectId(session._id as string),
          new mongoose.Types.ObjectId(assistant._id as string),
          new mongoose.Types.ObjectId(session.userId as string),
          'Failed to generate response. Please check your API key configuration.',
          'error',
          { error: 'empty_response', provider: providerKey },
        );

        return 'Failed to generate response. Please check your API key configuration.';
      } else {
        // Tools were executed but no final text - this is normal for tool-heavy responses
        console.log(
          `[handleSessionMessage] No final text but tools were executed. Tool calls: ${finalLlmResult.toolCalls?.length || 0}, Tool results: ${finalLlmResult.toolResults?.length || 0}`,
        );
      }
    }

    const cleanedResponse = cleanActionAnnotations(aggregatedResponse);
    const processedResponse = await processTemplate(
      cleanedResponse,
      sessionId.toString(),
    );

    const assistantMessageData: Partial<IMessage> = {
      sessionId: new mongoose.Types.ObjectId(session._id as string),
      sender: 'assistant',
      content: processedResponse,
      assistantId: new mongoose.Types.ObjectId(assistant._id as string),
      userId: new mongoose.Types.ObjectId(session.userId as string),
      timestamp: new Date(),
      messageType: 'text',
      data: {},
    };

    if (finalLlmResult.toolCalls && finalLlmResult.toolCalls.length > 0) {
      assistantMessageData.messageType = 'tool_calls';
      assistantMessageData.data = {
        ...assistantMessageData.data,
        toolCalls: finalLlmResult.toolCalls,
      };
    }
    if (finalLlmResult.toolResults && finalLlmResult.toolResults.length > 0) {
      if (assistantMessageData.messageType !== 'tool_calls') {
        assistantMessageData.messageType = 'tool_results';
      }
      assistantMessageData.data = {
        ...assistantMessageData.data,
        toolResults: finalLlmResult.toolResults,
      };
    }

    const assistantMessage = new Message(assistantMessageData);
    await assistantMessage.save();

    const totalDuration = Date.now() - requestStartTime;
    console.log(
      `[AI_REQUEST_COMPLETE] Total duration: ${totalDuration}ms | Session: ${sessionId} | Mode: non-streaming | Response length: ${processedResponse.length} chars`,
    );

    return processedResponse;
  }

  if (shouldStream) {
    // console.error("Reached end of function in streaming mode without returning stream. This shouldn't happen.");
    throw new Error(
      'Internal error: Failed to return stream in streaming mode.',
    );
  }

  throw new Error('Unhandled case in handleSessionMessage');
};
