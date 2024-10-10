import { v4 as uuidv4 } from 'uuid';
import { FunctionFactory, ActionContext, FunctionCall, ActionInfo, ExecutionDetails } from './types';
import { processTemplate } from '../../services/template.service';
import { discoverActionById } from '../../services/integration.service';
import { getSessionById } from '../../services/session.service';
import { SupportedLanguage } from '../../services/discovery.service';
import { createFunctionFactory } from './loaders';
import { publishActionMessage } from './publishers';
import {
  convertOpenAIFunctionName,
  extractErrorDetails,
  DetailedError
} from './utils';

interface PreparedAction {
  executionId: string;
  convertedActionId: string;
  actionInfo: ActionInfo;
  processedArgs: Record<string, unknown>;
}

const prepareActionExecution = async (
  functionName: string,
  args: Record<string, unknown>,
  sessionId: string,
  sessionLanguage: SupportedLanguage
): Promise<PreparedAction> => {
  const executionId = uuidv4();
  const convertedActionId = convertOpenAIFunctionName(functionName);
  const actionInfo = await discoverActionById(convertedActionId, sessionLanguage);

  if (!actionInfo) {
    throw new Error(`Action info not found for ${convertedActionId}`);
  }

  const processedArgs = await Promise.all(
    Object.entries(args).map(async ([key, value]) => [
      key,
      typeof value === 'string' ? await processTemplate(value, sessionId) : value
    ])
  );

  return {
    executionId,
    convertedActionId,
    actionInfo,
    processedArgs: Object.fromEntries(processedArgs)
  };
};

export const executeFunctionCall = async (
  call: FunctionCall,
  sessionId: string,
  companyId: string,
  allowedActions: string[]
): Promise<{ result?: unknown; error?: DetailedError }> => {
  const context: ActionContext = { sessionId, companyId };
  const functionFactory = await createFunctionFactory(context, allowedActions);

  const functionName = call.function.name;
  const originalActionId = functionName;
  const session = await getSessionById(sessionId);
  const sessionLanguage = session.language as SupportedLanguage;

  if (functionName in functionFactory) {
    try {
      const args = JSON.parse(call.function.arguments) as Record<string, unknown>;
      const { executionId, convertedActionId, actionInfo, processedArgs } = await prepareActionExecution(
        functionName,
        args,
        sessionId,
        sessionLanguage
      );

      const input = Object.keys(processedArgs).length > 0 ? processedArgs : {};

      const executionDetails: ExecutionDetails = {
        id: executionId,
        actionId: convertedActionId,
        serviceName: actionInfo.serviceName,
        actionTitle: actionInfo.actionTitle,
        actionDescription: actionInfo.description,
        icon: actionInfo.icon || '',
        args: processedArgs,
        originalActionId,
        language: sessionLanguage,
        input
      };

      await publishActionMessage(sessionId, 'started', executionDetails);

      // Improved file search detection
      const isFileSearch = functionName === 'file_search' ||
                           actionInfo.actionTitle.toLowerCase().includes('file search') || 
                           actionInfo.description.toLowerCase().includes('file search');

      if (isFileSearch) {
        // Publish a notification for file search detection
        await publishActionMessage(sessionId, 'started', {
          id: uuidv4(),
          actionId: 'file_search_notification',
          serviceName: 'File Search Notification',
          actionTitle: 'File Search In Progress',
          actionDescription: 'File search operation in progress',
          icon: 'search',
          args: {},
          originalActionId: 'file_search_notification',
          language: sessionLanguage,
          input: { message: 'File search operation detected and in progress. Retrieving relevant information...' }
        });
      }

      const result = await functionFactory[functionName].function(processedArgs);

      if (result && typeof result === 'object' && 'error' in result) {
        // If the result contains an error field, treat it as a failure
        const errorDetails = extractErrorDetails(result.error);
        await publishActionMessage(sessionId, 'failed', { ...executionDetails, output: result, error: errorDetails });
        return { error: errorDetails };
      } else {
        // If no error, publish completed message and return result
        await publishActionMessage(sessionId, 'completed', { ...executionDetails, output: result });
        if (isFileSearch) {
          // Complete the file search notification
          await publishActionMessage(sessionId, 'completed', {
            id: uuidv4(),
            actionId: 'file_search_notification',
            serviceName: 'File Search Notification',
            actionTitle: 'File Search Completed',
            actionDescription: 'File search operation completed',
            icon: 'search',
            args: {},
            originalActionId: 'file_search_notification',
            language: sessionLanguage,
            input: { message: 'File search completed. Results retrieved and incorporated into the response.' }
          });
        }
        return { result };
      }
    } catch (error) {
      console.error(`Error executing function ${functionName}:`, error);

      const failedActionInfo = await discoverActionById(convertOpenAIFunctionName(functionName), sessionLanguage);
      const errorDetails = extractErrorDetails(error);
      const args = JSON.parse(call.function.arguments);
      const input = Object.keys(args).length > 0 ? args : {};
      
      await publishActionMessage(sessionId, 'failed', {
        id: uuidv4(),
        actionId: convertOpenAIFunctionName(functionName),
        serviceName: failedActionInfo?.serviceName || 'unknown',
        actionTitle: failedActionInfo?.actionTitle || 'unknown',
        actionDescription: failedActionInfo?.description || 'unknown',
        icon: failedActionInfo?.icon || '',
        args,
        originalActionId: functionName,
        language: sessionLanguage,
        input,        
        error: errorDetails
      });

      return { error: errorDetails };
    }
  } else {
    return { error: { message: `Function ${functionName} not implemented in the factory` } };
  }
};
