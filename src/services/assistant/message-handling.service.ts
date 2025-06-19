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
import { fetchGcpFileContent } from '../../integrations/gcp_file_fetcher/gcp_file_fetcher.service';
import axios from 'axios'; // Added axios for fetching image data

// Vercel AI SDK imports
import { generateText, tool, streamText, CoreMessage, StreamTextResult, Tool, ImagePart, TextPart } from 'ai'; 
import { z, ZodTypeAny } from 'zod';
import { trimToWindow } from '../../utils/tokenWindow'; 
import { getProvider } from './provider.service'; 
// import util from 'node:util'; // No longer needed after debug log removal

// Helper function to determine if a file format is unsupported
const isUnsupportedFileFormat = (mimeType: string, fileName: string): boolean => {
  // Список неподдерживаемых MIME типов
  const unsupportedMimeTypes = [
    'audio/',      // Все аудио форматы
    'video/',      // Все видео форматы
    'application/octet-stream', // Бинарные файлы, если не определен более конкретный тип
  ];
  
  // Список неподдерживаемых расширений
  const unsupportedExtensions = [
    '.mp3', '.mp4', '.avi', '.mov', '.wav', '.flac', '.mkv',
    '.webm', '.ogg', '.m4a', '.aac', '.wma', '.opus',
    '.exe', '.dll', '.so', '.dylib', '.bin', '.zip', '.gz', '.tar', '.rar' // Добавлены архивы и исполняемые файлы
  ];
  
  // Проверка MIME типа
  const isUnsupportedMime = unsupportedMimeTypes.some(type => 
    mimeType.startsWith(type)
  );
  
  // Проверка расширения файла
  const fileExtension = fileName.toLowerCase().match(/\.[^.]+$/)?.[0] || '';
  const isUnsupportedExt = unsupportedExtensions.includes(fileExtension);
  
  // Если MIME тип известен и поддерживается (например, application/pdf, text/csv), не считаем его неподдерживаемым,
  // даже если расширение попало в общий список (например, если кто-то назовет файл data.bin, но MIME text/csv)
  const knownSupportedMimeTypes = [
    'image/', 'application/pdf', 'text/csv', 'text/plain', 'application/json', 'text/html', 'text/xml', 
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
    'application/vnd.openxmlformats-officedocument.presentationml.presentation' // pptx
  ];

  const isKnownSupportedMime = knownSupportedMimeTypes.some(type => mimeType.startsWith(type));

  if (isKnownSupportedMime) {
    return false; // Если MIME тип явно поддерживается, то формат поддерживается
  }
  
  return isUnsupportedMime || isUnsupportedExt;
};

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

interface Attachment {
  fileId: string;
  url: string;
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
  channel: ChannelType = ChannelType.WEB,
  metadata?: Record<string, string>,
  attachments?: Attachment[]
): Promise<string | StreamTextResult<Record<string, Tool<any, any>>, unknown>> => { 
  console.log(`[handleSessionMessage] Entered. UserInput: "${userInput}", SessionID: ${sessionId}, Channel: ${channel}, Attachments: ${attachments ? attachments.length : 0}`);
  // console.log(`Handling session message for session ${sessionId} on channel ${channel}`);
  console.log(`[handleSessionMessage] About to fetch session ${sessionId}`);
  const session = await Session.findById(sessionId);
  if (!session || !session.active || session.channel !== channel) {
    console.error(`[handleSessionMessage] Session validation failed for ${sessionId}. Session: ${JSON.stringify(session)}, Channel: ${channel}`);
    throw new Error('Invalid or inactive session, or channel mismatch');
  }
  console.log(`[handleSessionMessage] Session ${sessionId} fetched successfully.`);

  console.log(`[handleSessionMessage] About to fetch assistant ${session.assistantId}`);
  const assistant = await Assistant.findOne({
    _id: new mongoose.Types.ObjectId(session.assistantId),
  });

  if (!assistant) {
    console.error(`[handleSessionMessage] Assistant not found for ID: ${session.assistantId}`);
    throw new Error('Assistant not found');
  }
  console.log(`[handleSessionMessage] Assistant ${assistant._id} fetched successfully. Provider='${assistant.llmProvider}', Model='${assistant.llmModel}'`);
  // console.log(`Fetched assistant details: Provider='${assistant.llmProvider}', Model='${assistant.llmModel}'`);
  const providerKey = assistant.llmProvider;
  let processedUserInput = userInput;
  // This will hold the parts for the user's message, including text, image, and file parts
  // Using a flexible type for modern PDF handling
  const userMessageContentParts: (TextPart | ImagePart | any)[] = [{ type: 'text', text: processedUserInput }];
  let hasUnsupportedAttachment = false;
  let firstUnsupportedAttachmentInfo: Attachment | null = null;

  if (attachments && attachments.length > 0) {
    // console.log(`Processing ${attachments.length} attachments for session ${sessionId} with provider ${providerKey}`);
    for (const attachment of attachments) {
      // Check if the file format is unsupported first
      if (isUnsupportedFileFormat(attachment.mimeType, attachment.fileName)) {
        hasUnsupportedAttachment = true;
        if (!firstUnsupportedAttachmentInfo) {
          firstUnsupportedAttachmentInfo = attachment;
        }
        console.log(`[handleSessionMessage] Unsupported file detected: ${attachment.fileName} (MIME: ${attachment.mimeType}). Will be acknowledged directly.`);
        // Do not append to userMessageContentParts[0].text for the direct response strategy.
        // The attachment info will be in userMessage.data.attachments.
        continue; // Skip specific content processing for this unsupported attachment, move to next attachment.
      }

      // Existing logic for supported attachments
      if (attachment.mimeType.startsWith('image/')) {
        try {
          // console.log(`Fetching image: ${attachment.fileName} from ${attachment.url}`);
          const response = await axios.get(attachment.url, { responseType: 'arraybuffer' });
          const imageBuffer = Buffer.from(response.data);
          
          // Use Uint8Array for all providers (recommended approach)
          userMessageContentParts.push({
            type: 'image',
            image: new Uint8Array(imageBuffer),
            mimeType: attachment.mimeType,
          });
          // console.log(`Image attachment processed as Uint8Array for ${providerKey}: ${attachment.fileName}`);
        } catch (error) {
          // console.error(`Error fetching or processing image data from URL ${attachment.url} for ${attachment.fileName}:`, error);
          // Append error info to the text part of the user message
          (userMessageContentParts[0] as TextPart).text += `\n\n[Could not load image: ${attachment.fileName}]`;
        }
      } else if (attachment.fileId && attachment.mimeType === 'application/pdf') { // Modern PDF handling
        try {
          // console.log(`Fetching PDF content AS BUFFER: ${attachment.fileName} (ID: ${attachment.fileId}) for ${providerKey}`);
          const pdfBufferResult = await fetchGcpFileContent(sessionId, session.companyId.toString(), { fileId: attachment.fileId, returnAs: 'buffer' });

          if (pdfBufferResult.success && pdfBufferResult.data instanceof Buffer) {
            // For now, use text extraction approach for all providers until file parts are fully stable
            const fileContentResult = await fetchGcpFileContent(sessionId, session.companyId.toString(), { fileId: attachment.fileId, returnAs: 'string' });
            if (fileContentResult.success && typeof fileContentResult.data === 'string') {
              let pdfTextToAppend = fileContentResult.data;
              const MAX_PDF_TEXT_CHARS = 7000;
              if (pdfTextToAppend.length > MAX_PDF_TEXT_CHARS) {
                pdfTextToAppend = pdfTextToAppend.substring(0, MAX_PDF_TEXT_CHARS) + "\n\n[...PDF text truncated due to length...]\n";
                // console.log(`Truncated extracted PDF text for ${attachment.fileName} to ${MAX_PDF_TEXT_CHARS} characters.`);
              }
              (userMessageContentParts[0] as TextPart).text += `\n\n--- Attached PDF: ${attachment.fileName} ---\n${pdfTextToAppend}\n--- End of File ---`;
              // console.log(`${providerKey} PDF attachment processed as text extraction: ${attachment.fileName}`);
            } else {
              // Fallback for unknown providers: text extraction
              const fileContentResult = await fetchGcpFileContent(sessionId, session.companyId.toString(), { fileId: attachment.fileId, returnAs: 'string' });
              if (fileContentResult.success && typeof fileContentResult.data === 'string') {
                (userMessageContentParts[0] as TextPart).text += `\n\n--- Attached PDF (text fallback): ${attachment.fileName} ---\n${fileContentResult.data.slice(0, 7000)}\n--- End of File ---`;
              } else {
                (userMessageContentParts[0] as TextPart).text += `\n\n[PDF omitted: provider ${providerKey} does not support files]`;
              }
              // console.log(`PDF processed as text fallback for ${providerKey}: ${attachment.fileName}`);
            }
          } else {
            // console.warn(`Could not fetch PDF as buffer: ${attachment.fileName}. Error: ${pdfBufferResult.error || 'Unknown error'}. Falling back to text extraction.`);
            const fileContentResult = await fetchGcpFileContent(sessionId, session.companyId.toString(), { fileId: attachment.fileId, returnAs: 'string' });
            if (fileContentResult.success && typeof fileContentResult.data === 'string') {
              let pdfTextToAppend = fileContentResult.data;
              const MAX_PDF_TEXT_CHARS = 7000;
              if (pdfTextToAppend.length > MAX_PDF_TEXT_CHARS) {
                pdfTextToAppend = pdfTextToAppend.substring(0, MAX_PDF_TEXT_CHARS) + "\n\n[...PDF text truncated due to length...]\n";
                // console.log(`Truncated extracted PDF text for ${attachment.fileName} to ${MAX_PDF_TEXT_CHARS} characters.`);
              }
              (userMessageContentParts[0] as TextPart).text += `\n\n--- Attached PDF (text fallback): ${attachment.fileName} ---\n${pdfTextToAppend}\n--- End of File ---`;
            } else {
              (userMessageContentParts[0] as TextPart).text += `\n\n[Could not load PDF content: ${attachment.fileName}]`;
            }
          }
        } catch (error) {
          // console.error(`Error fetching/processing PDF ${attachment.fileName}:`, error);
          (userMessageContentParts[0] as TextPart).text += `\n\n[Error loading PDF: ${attachment.fileName}]`;
        }
      } else if (attachment.fileId) { // Other non-image files (TXT, CSV, etc.)
        try {
          // console.log(`Fetching non-image file content AS TEXT: ${attachment.fileName} (ID: ${attachment.fileId}) for provider ${providerKey}`);
          const fileContentResult = await fetchGcpFileContent(sessionId, session.companyId.toString(), { fileId: attachment.fileId, returnAs: 'string' });
          
          if (fileContentResult.success && typeof fileContentResult.data === 'string') {
            (userMessageContentParts[0] as TextPart).text += `\n\n--- Attached File: ${attachment.fileName} ---\n${fileContentResult.data}\n--- End of File: ${attachment.fileName} ---`;
            // console.log(`Non-image file content (text) appended for ${providerKey}: ${attachment.fileName}`);
          } else {
            // console.warn(`Could not fetch content for file: ${attachment.fileName} (ID: ${attachment.fileId}). Result: ${JSON.stringify(fileContentResult)}`);
            (userMessageContentParts[0] as TextPart).text += `\n\n[Could not load content for attached file: ${attachment.fileName}]`;
          }
        } catch (error) {
          // console.error(`Error fetching content for file ${attachment.fileName} (ID: ${attachment.fileId}):`, error);
          (userMessageContentParts[0] as TextPart).text += `\n\n[Error loading content for attached file: ${attachment.fileName}]`;
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
    // processedUserInput is updated based on text from *supported* files, if any.
    processedUserInput = (userMessageContentParts.find(part => part.type === 'text') as TextPart)?.text || userInput;
  }

  const userMessage = new Message({
    sessionId: new mongoose.Types.ObjectId(session._id),
    sender: 'user',
    content: processedUserInput, // Contains original user text + text from supported files
    assistantId: new mongoose.Types.ObjectId(assistant._id),
    userId: new mongoose.Types.ObjectId(session.userId),
    timestamp: new Date(),
    messageType: attachments && attachments.length > 0 ? 'file_upload_text' : 'text',
    data: {
      ...(metadata || {}),
      originalUserInput: userInput,
      attachments: attachments?.map(att => ({
        fileName: att.fileName,
        mimeType: att.mimeType,
        fileId: att.fileId,
        url: att.url,
      }))
    },
  });
  console.log(`[handleSessionMessage] About to save user message for session ${sessionId}`);
  await userMessage.save();
  console.log(`[handleSessionMessage] User message saved for session ${sessionId}`);

  // If an unsupported file was attached, send the specific assistant response and return, bypassing LLM for this turn.
  if (hasUnsupportedAttachment && firstUnsupportedAttachmentInfo) {
    console.log(`[handleSessionMessage] Condition for direct response MET: hasUnsupportedAttachment=true, fileName=${firstUnsupportedAttachmentInfo.fileName}, userInput="${userInput}"`);
    let fileTypeDescription = "file";
    let followUpSuggestion = "If you need anything else, let me know!";

    if (firstUnsupportedAttachmentInfo.mimeType.startsWith('audio/')) {
        fileTypeDescription = "audio file";
        followUpSuggestion = "Would you like me to try to transcribe this file? Or do you need other help?";
    } else if (firstUnsupportedAttachmentInfo.mimeType.startsWith('video/')) {
        fileTypeDescription = "video file";
        followUpSuggestion = "You can use this link to view or download. If you need anything else, let me know!";
    }
    
    const formattedAssistantResponseText = `Here is the link to the ${fileTypeDescription} "${firstUnsupportedAttachmentInfo.fileName}" that you uploaded:\n${firstUnsupportedAttachmentInfo.url}\nYou can use this link to listen/view or download. ${followUpSuggestion}`;

    const assistantMessage = new Message({
      sessionId: new mongoose.Types.ObjectId(session._id),
      sender: 'assistant',
      content: formattedAssistantResponseText,
      assistantId: new mongoose.Types.ObjectId(assistant._id),
      userId: new mongoose.Types.ObjectId(session.userId),
      timestamp: new Date(),
      messageType: 'text',
    });
    await assistantMessage.save();
    console.log(`[handleSessionMessage] Saved direct assistant message for ${firstUnsupportedAttachmentInfo.fileName}. Content: "${formattedAssistantResponseText}"`);
    console.log(`[handleSessionMessage] Returning direct response. Bypassing LLM.`);
    return formattedAssistantResponseText; // Return non-streamed text directly
  } else {
    console.log(`[handleSessionMessage] Condition for direct response NOT MET: hasUnsupportedAttachment=${hasUnsupportedAttachment}, firstUnsupportedAttachmentInfo is ${firstUnsupportedAttachmentInfo ? 'set' : 'null'}, userInput="${userInput}". Proceeding to LLM call or further processing.`);
  }

  console.log(`[handleSessionMessage] About to fetch DB messages for session ${sessionId}`);
  const dbMessages = await getMessagesBySessionId(sessionId.toString());
  console.log(`[handleSessionMessage] Fetched ${dbMessages.length} DB messages for session ${sessionId}`);
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
    // console.log(`Using cached toolsForSdk for assistant ${assistant._id}`);
  } else {
    toolsForSdk = {};
    console.log(`[handleSessionMessage] About to create function factory for assistant ${assistant._id}. Allowed actions: ${JSON.stringify(assistant.allowedActions)}`);
    const functionFactory = await createFunctionFactory(actionContext, assistant.allowedActions);
    console.log(`[handleSessionMessage] Function factory created for assistant ${assistant._id}. Found ${Object.keys(functionFactory).length} functions.`);
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
    
    const executeFunc = async (args: any) => {
      // console.log(`[Tool Execution] Function ${currentFuncName} called with sessionId from closure: ${sessionId}`);
      const currentSession = await Session.findById(sessionId);
      if (!currentSession) {
        throw new Error('Session not found during tool execution');
      }
      // console.log(`[Tool Execution] Retrieved current session ID: ${currentSession._id.toString()}, company ID: ${currentSession.companyId.toString()}`);
      
      const functionCallPayload: FunctionCall = { function: { name: currentFuncName, arguments: JSON.stringify(args) } };
      const { result, error } = await executeFunctionCall(
        functionCallPayload, 
        currentSession._id.toString(), 
        currentSession.companyId.toString(), 
        assistant.allowedActions
      );
      if (error) {
        // console.error(`Error in tool ${currentFuncName} execution:`, error);
        throw new Error(typeof error === 'string' ? error : (error as any)?.message || 'Tool execution failed');
      }
      return result;
    };
    
      toolsForSdk[funcName] = tool({ description: funcDef.description, parameters: zodSchema, execute: executeFunc });
    }
    toolsCache.set(cacheKey, toolsForSdk);
    // console.log(`Cached toolsForSdk for assistant ${assistant._id}`);
  }
  
  let modelIdentifier = assistant.llmModel || 'gpt-4o-mini';
  console.log(`[handleSessionMessage] About to get API key for provider ${providerKey} and company ${session.companyId.toString()}`);
  const llmApiKey = await getApiKey(session.companyId.toString(), `${providerKey}_api_key`);
  if (!llmApiKey) {
    console.error(`[handleSessionMessage] ${providerKey} API key not found for company ${session.companyId.toString()}.`);
    throw new Error(`${providerKey} API key not found for company.`);
  }
  console.log(`[handleSessionMessage] API key for ${providerKey} obtained.`);

  if (providerKey === 'google' && modelIdentifier && !modelIdentifier.startsWith('models/')) {
    modelIdentifier = `models/${modelIdentifier}`;
    // console.log(`Prefixed Google model ID: ${modelIdentifier}`);
  }
    
  // console.log(`Using LLM provider: ${providerKey}, model: ${modelIdentifier} for session ${sessionId}`);
  let shouldStream = metadata?.['X-Experimental-Stream'] === 'true';
  // console.log(`Original shouldStream: ${shouldStream}`);
  // shouldStream = false; // DIAGNOSTIC: Force non-streaming // REVERTED
  // console.log(`Forced shouldStream: ${shouldStream}`);

  console.log(`[handleSessionMessage] About to process system prompt template for session ${sessionId}`);
  const systemPrompt = await processTemplate(assistant.llmPrompt, sessionId.toString());
  console.log(`[handleSessionMessage] System prompt processed for session ${sessionId}`);

  // Construct user message content for LLM
  // The userMessageForLlm will now use the userMessageContentParts array
  const userMessageForLlm: CoreMessage = {
    role: 'user',
    content: userMessageContentParts, // This array contains text and formatted image parts
  };

  let messagesForLlm: CoreMessage[] = [...history];
  const lastHistoryMessage = history.length > 0 ? history[history.length - 1] : null;

  // Avoid direct duplication if the last history message is identical to the current user input text
  if (lastHistoryMessage && lastHistoryMessage.role === 'user' && 
      typeof lastHistoryMessage.content === 'string' && 
      lastHistoryMessage.content === userInput &&
      userMessageContentParts.length === 1 && userMessageContentParts[0].type === 'text' && userMessageContentParts[0].text === userInput) {
    console.log('[handleSessionMessage] Last history message is identical to current user input text. Using only current input.');
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
  
  const maxPromptTokens: number = assistant.maxTokens || 25000; // Use assistant's maxTokens, default to 25k if somehow undefined
  
  let { trimmedMessages, tokensInPrompt: actualTokensInPrompt } = trimToWindow(messagesForLlm, maxPromptTokens);
  
  // Handle the case where trimmedMessages is empty, especially after the trimToWindow call
  if (trimmedMessages.length === 0 && messagesForLlm.length > 0) {
    console.error(`[handleSessionMessage] All messages were trimmed for session ${sessionId}. This usually means the first message (e.g., with a large CSV) exceeded the token limit of ${maxPromptTokens}.`);
    // Construct a user-facing error message to be sent back.
    // This part depends on how errors are propagated to the user.
    // For now, we'll throw an error that should be caught by the global error handler.
    // Ideally, this would be a more specific error type.
    throw new Error(`The content provided (e.g., an attached file) is too large to process. Please reduce the size and try again. Max token limit: ${maxPromptTokens}`);
  }
  
  // console.log(`Manual trim: Target tokens: ${maxPromptTokens}, Actual: ${actualTokensInPrompt}, Original msgs: ${messagesForLlm.length}, Trimmed msgs: ${trimmedMessages.length}`);

  if (providerKey === 'anthropic') {
    // console.log('Anthropic provider: Prepending system prompt to messages array as well.');
    trimmedMessages = [{ role: 'system', content: systemPrompt }, ...trimmedMessages.filter(m => m.role !== 'system')];
  }

  let aggregatedResponse = '';
  let finalLlmResult: Awaited<ReturnType<typeof generateText>> | undefined;

  try {
    // shouldStream = false; // DIAGNOSTIC: Force non-streaming // REVERTED
    console.log(`[handleSessionMessage] Streaming is ${shouldStream ? "ENABLED" : "DISABLED (check metadata or diagnostic override)"}`);
    const llm = getProvider(providerKey, modelIdentifier, llmApiKey as string);

    const slimToolsForIntent = (input: string, allTools: Record<string, Tool<any, any>>): Record<string, Tool<any, any>> => {
      // console.log(`Tool slimming disabled for input: "${input}". Returning all ${Object.keys(allTools).length} tools.`);
      return allTools;
    };
    const relevantTools = slimToolsForIntent(userInput, toolsForSdk);

    if (shouldStream) {
    const streamCallOptions: Parameters<typeof streamText>[0] = {
      model: llm,
      messages: trimmedMessages, // This now contains correctly formatted multimodal messages
      tools: relevantTools, 
      maxSteps: 5,
      maxRetries: 2,
    };
    if (systemPrompt !== undefined) {
      streamCallOptions.system = systemPrompt;
    }
    
    let streamResult;
    try {
      streamResult = await streamText(streamCallOptions);
      console.log(`[handleSessionMessage] streamText call appears to have completed for session ${sessionId}.`);
      // Log initial streamResult properties
      if (streamResult) {
        console.log(`[handleSessionMessage] Initial streamResult properties for session ${sessionId}:`, {
          // Be careful about logging the entire object if it's huge or contains sensitive stream internals
          type: (streamResult as any).type, // Vercel AI SDK often includes a 'type'
          usage: (streamResult as any).usage, // Often contains token usage
          // Log other potentially relevant non-iterable properties if known
        });
      }
    } catch (streamError: any) {
      console.error(`[handleSessionMessage] CRITICAL ERROR during streamText call for session ${sessionId}:`, streamError);
      console.error(`[handleSessionMessage] StreamError Name: ${streamError.name}, Message: ${streamError.message}, Stack: ${streamError.stack}`);
      if (streamError.cause) {
        console.error(`[handleSessionMessage] StreamError Cause:`, streamError.cause);
      }
      throw streamError; // Re-throw to be caught by the outer try-catch
    }
      
      (async () => {
        try {
          const finalText = await streamResult.text;
          const toolCalls = await streamResult.toolCalls; 
          const toolResults = await streamResult.toolResults;

          // console.log('Stream finished, saving full assistant message to DB.'); 
          // if (finalText) console.log('Final text length (for DB):', finalText.length);
          // if (toolCalls) console.log('Tool Calls (for DB):', JSON.stringify(toolCalls, null, 2));
          // if (toolResults) console.log('Tool Results (for DB):', JSON.stringify(toolResults, null, 2));
          
          const cleanedText = cleanActionAnnotations(finalText);
          const processedResponse = await processTemplate(cleanedText, sessionId.toString());
          
          const assistantMessageData: Partial<IMessage> = {
            sessionId: new mongoose.Types.ObjectId(session._id),
            sender: 'assistant',
            content: processedResponse,
            assistantId: new mongoose.Types.ObjectId(assistant._id),
            userId: new mongoose.Types.ObjectId(session.userId),
            timestamp: new Date(),
            messageType: 'text', 
            data: {},
          };

          if (toolCalls && toolCalls.length > 0) {
            assistantMessageData.messageType = 'tool_calls'; 
            assistantMessageData.data = { ...assistantMessageData.data, toolCalls: toolCalls };
          }
          if (toolResults && toolResults.length > 0) {
            if (assistantMessageData.messageType !== 'tool_calls') {
                 assistantMessageData.messageType = 'tool_results'; 
            }
            assistantMessageData.data = { ...assistantMessageData.data, toolResults: toolResults };
          }
          
          const assistantMessage = new Message(assistantMessageData);
          await assistantMessage.save();
          // console.log('Assistant message from streamed response (with potential tool data) saved to DB.');

        } catch (dbError) {
          // console.error('Error saving streamed assistant message to DB:', dbError);
        }
      })().catch(streamProcessingError => {
        // console.error('Error processing full streamed text for DB save:', streamProcessingError);
      });

      // console.log(`Returning stream object for session ${sessionId} for client consumption.`); 
      return streamResult;
    } else {
    const generateCallOptions: Parameters<typeof generateText>[0] = {
      model: llm,
      messages: trimmedMessages, // This now contains correctly formatted multimodal messages
      tools: relevantTools,
      maxSteps: 5,
      maxRetries: 2,
    };
    if (systemPrompt !== undefined) {
      generateCallOptions.system = systemPrompt;
    }
    // No separate experimental_attachments or attachments field needed here
    // console.log('Calling generateText. Multimodal content is part of the messages array.');
    const result = await generateText(generateCallOptions);
    aggregatedResponse = result.text;
    finalLlmResult = result;

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
        if (errorMessage.includes('model not found') || 
            errorMessage.includes('permission denied') || 
            errorMessage.includes('api key not valid') ||
            errorMessage.includes('invalid api key')) {
            // console.error('Gemini API Error (detected by message):', error);
            specificGeminiError = true;
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
    
    const cleanedResponse = cleanActionAnnotations(aggregatedResponse);
    const processedResponse = await processTemplate(cleanedResponse, sessionId.toString());
    
    const assistantMessageData: Partial<IMessage> = {
      sessionId: new mongoose.Types.ObjectId(session._id),
      sender: 'assistant',
      content: processedResponse,
      assistantId: new mongoose.Types.ObjectId(assistant._id),
      userId: new mongoose.Types.ObjectId(session.userId),
      timestamp: new Date(),
      messageType: 'text', 
      data: {},
    };

    if (finalLlmResult.toolCalls && finalLlmResult.toolCalls.length > 0) {
      assistantMessageData.messageType = 'tool_calls'; 
      assistantMessageData.data = { ...assistantMessageData.data, toolCalls: finalLlmResult.toolCalls };
    }
    if (finalLlmResult.toolResults && finalLlmResult.toolResults.length > 0) {
      if (assistantMessageData.messageType !== 'tool_calls') {
           assistantMessageData.messageType = 'tool_results'; 
      }
      assistantMessageData.data = { ...assistantMessageData.data, toolResults: finalLlmResult.toolResults };
    }

    const assistantMessage = new Message(assistantMessageData);
    await assistantMessage.save();
    
    return processedResponse; 
  }
  
  if (shouldStream) {
    // console.error("Reached end of function in streaming mode without returning stream. This shouldn't happen.");
    throw new Error("Internal error: Failed to return stream in streaming mode.");
  }
  
  throw new Error("Unhandled case in handleSessionMessage");
};
