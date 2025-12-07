import { v4 as uuidv4 } from 'uuid';
import {
  FunctionFactory,
  ActionContext,
  FunctionCall,
  ActionInfo,
  ExecutionDetails,
} from './types';
import { processTemplate } from '../../services/template.service';
import { discoverActionById } from '../../services/integration.service';
import {
  getCurrentSession,
  getSessionById,
} from '../../services/session.service';
import { SupportedLanguage } from '../../services/discovery.service';
import { createFunctionFactory } from './loaders';
import { publishActionMessage } from './publishers';
import {
  convertOpenAIFunctionName,
  extractErrorDetails,
  DetailedError,
} from './utils';

const sendActionUpdate = async (
  sessionId: string,
  status: 'started' | 'completed' | 'failed',
  executionDetails: ExecutionDetails,
) => {
  // Send via Pusher only - this ensures consistent format with messages endpoint
  // Don't let Pusher errors affect action execution
  try {
    await publishActionMessage(sessionId, status, executionDetails);
  } catch (error) {
    console.error('Pusher error (non-critical):', error);
    // Don't rethrow - Pusher errors shouldn't stop the action
  }
};

interface PreparedAction {
  executionId: string;
  convertedActionId: string;
  actionInfo: ActionInfo;
  processedArgs: Record<string, unknown>;
}

interface ActionResult {
  success: boolean;
  data?: any;
  error?: string;
}

const prepareActionExecution = async (
  functionName: string,
  args: Record<string, unknown>,
  sessionId: string,
  sessionLanguage: SupportedLanguage,
): Promise<PreparedAction> => {
  const executionId = uuidv4();
  const convertedActionId = convertOpenAIFunctionName(functionName);
  const actionInfo = await discoverActionById(
    convertedActionId,
    sessionLanguage,
  );

  if (!actionInfo) {
    throw new Error(`Action info not found for ${convertedActionId}`);
  }

  const processedArgs = await Promise.all(
    Object.entries(args).map(async ([key, value]) => {
      if (typeof value === 'string') {
        return [key, await processTemplate(value, sessionId)];
      }
      // Preserve arrays as-is (don't treat them as objects to recurse into)
      if (Array.isArray(value)) {
        return [key, value];
      }
      if (typeof value === 'object' && value !== null) {
        // Recursively process nested objects
        const nestedProcessedArgs = await prepareActionExecution(
          functionName,
          value as Record<string, unknown>,
          sessionId,
          sessionLanguage,
        );
        return [key, nestedProcessedArgs.processedArgs];
      }
      return [key, value];
    }),
  );

  return {
    executionId,
    convertedActionId,
    actionInfo,
    processedArgs: Object.fromEntries(processedArgs),
  };
};

export const executeFunctionCall = async (
  call: FunctionCall,
  sessionId: string,
  companyId: string,
  allowedActions: string[],
): Promise<{ result?: unknown; error?: DetailedError }> => {
  console.log(
    `[executeFunctionCall] Starting execution with sessionId: ${sessionId}, companyId: ${companyId}`,
  );

  // Get the current session to ensure we have the latest session ID
  const session = await getSessionById(sessionId);
  const currentSession = await getCurrentSession(session.userId, companyId);
  const activeSessionId = currentSession
    ? currentSession._id.toString()
    : sessionId;

  const updatedSession = await getSessionById(activeSessionId);
  const sessionLanguage = updatedSession.language as SupportedLanguage;
  const context: ActionContext = {
    sessionId: activeSessionId,
    companyId,
    language: sessionLanguage,
    assistantId: updatedSession.assistantId?.toString(),
    userId: updatedSession.userId?.toString(),
  };

  let functionFactory: FunctionFactory;
  try {
    functionFactory = await createFunctionFactory(context, allowedActions);
  } catch (error) {
    console.error(
      '[executeFunctionCall] Critical error creating function factory:',
      error,
    );
    // Return an empty factory to allow the assistant to continue working
    functionFactory = {};
  }

  console.log(
    `[executeFunctionCall] Allowed actions for session ${activeSessionId}:`,
    JSON.stringify(allowedActions),
  ); // Added logging

  const functionName = call.function.name;
  const originalActionId = functionName;

  console.log(
    `[executeFunctionCall] Attempting to execute function: ${functionName}`,
  );
  console.log(
    `[executeFunctionCall] Raw arguments: ${call.function.arguments}`,
  );

  if (functionName in functionFactory) {
    let executionDetails: ExecutionDetails | undefined; // Initialize as undefined to fix TypeScript error

    try {
      const args = JSON.parse(call.function.arguments) as Record<
        string,
        unknown
      >;
      console.log(`[executeFunctionCall] Parsed arguments:`, args);

      const { executionId, convertedActionId, actionInfo, processedArgs } =
        await prepareActionExecution(
          functionName,
          args,
          activeSessionId, // Changed to activeSessionId
          sessionLanguage,
        );

      const input = Object.keys(processedArgs).length > 0 ? processedArgs : {};

      executionDetails = {
        id: executionId,
        actionId: convertedActionId,
        serviceName: actionInfo.serviceName,
        actionTitle: actionInfo.actionTitle,
        actionDescription: actionInfo.description,
        icon: actionInfo.icon || '',
        args: processedArgs,
        originalActionId,
        language: sessionLanguage,
        input,
      };

      console.log(
        `[executeFunctionCall] Sending 'started' update for action ${convertedActionId} to session ${activeSessionId}`,
      ); // Changed to activeSessionId
      await sendActionUpdate(activeSessionId, 'started', executionDetails); // Changed to activeSessionId

      // Improved file search detection
      const isFileSearch =
        functionName === 'file_search' ||
        actionInfo.actionTitle.toLowerCase().includes('file search') ||
        actionInfo.description.toLowerCase().includes('file search');

      if (isFileSearch) {
        // Publish a notification for file search detection
        await sendActionUpdate(activeSessionId, 'started', {
          // Changed to activeSessionId
          id: uuidv4(),
          actionId: 'file_search_notification',
          serviceName: 'File Search Notification',
          actionTitle: 'File Search In Progress',
          actionDescription: 'File search operation in progress',
          icon: 'search',
          args: {},
          originalActionId: 'file_search_notification',
          language: sessionLanguage,
          input: {
            message:
              'File search operation detected and in progress. Retrieving relevant information...',
          },
        });
      }

      const result = (await functionFactory[functionName].function(
        processedArgs,
      )) as ActionResult;

      if (!result.success) {
        // If the result is not successful, publish failed message and return error result (not throw)
        // This ensures the LLM gets the error information as a tool result
        const errorDetails = extractErrorDetails(
          result.error || 'Unknown error',
        );
        await sendActionUpdate(activeSessionId, 'failed', {
          ...executionDetails,
          output: result,
          error: errorDetails,
        }); // Changed to activeSessionId

        const errorReturn = {
          result: `Error: ${result.error || 'Action failed'}`,
        };
        console.log(
          `[executeFunctionCall] Returning error to AI SDK for ${functionName}:`,
          JSON.stringify(errorReturn, null, 2),
        );
        return errorReturn;
      } else {
        // If success is true, publish completed message and return result
        await sendActionUpdate(activeSessionId, 'completed', {
          ...executionDetails,
          output: result,
        });
        if (isFileSearch) {
          // Complete the file search notification
          await sendActionUpdate(activeSessionId, 'completed', {
            id: uuidv4(),
            actionId: 'file_search_notification',
            serviceName: 'File Search Notification',
            actionTitle: 'File Search Completed',
            actionDescription: 'File search operation completed',
            icon: 'search',
            args: {},
            originalActionId: 'file_search_notification',
            language: sessionLanguage,
            input: {
              message:
                'File search completed. Results retrieved and incorporated into the response.',
            },
          });
        }
        // Ensure result.data is never null or undefined
        const resultData = result.data ?? {
          message: 'Action completed successfully',
        };
        const successReturn = { result: resultData };
        // console.log(`[executeFunctionCall] Returning success data to AI SDK for ${functionName}:`, JSON.stringify(successReturn, null, 2));
        return successReturn;
      }
    } catch (error) {
      console.error(
        `[executeFunctionCall] Error executing function ${functionName}:`,
        error,
      );

      const errorDetails = extractErrorDetails(error);

      // If executionDetails was set (error occurred after sending 'started'), reuse it
      // Otherwise, create new execution details for the failed message
      if (executionDetails) {
        // Reuse the executionId from the started message to ensure update works properly
        await sendActionUpdate(activeSessionId, 'failed', {
          ...executionDetails, // Use the same execution details from the try block
          // Include both output and error for consistency with the non-thrown error case
          output: {
            success: false,
            error: errorDetails.message,
            errorDetails: errorDetails, // Include full error details in output as well
          },
          error: errorDetails,
        });
      } else {
        // Error occurred before executionDetails was set, create new details
        const failedActionInfo = await discoverActionById(
          convertOpenAIFunctionName(functionName),
          sessionLanguage,
        );
        const args = JSON.parse(call.function.arguments);
        const input = Object.keys(args).length > 0 ? args : {};

        await sendActionUpdate(activeSessionId, 'failed', {
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
          // Include both output and error for consistency with the non-thrown error case
          output: {
            success: false,
            error: errorDetails.message,
            errorDetails: errorDetails, // Include full error details in output as well
          },
          error: errorDetails,
        });
      }

      // Standardize the return to the AI SDK to always have a 'result' field for errors
      // The Pusher message already contains the full 'errorDetails' object.
      const sdkErrorReturn = {
        result: `Error: ${errorDetails.name} - ${errorDetails.message}`,
      };
      console.log(
        `[executeFunctionCall] Returning error to AI SDK for ${functionName} (from catch block):`,
        JSON.stringify(sdkErrorReturn, null, 2),
      );
      return sdkErrorReturn;
    }
  } else {
    // This case should also align with the { result: "Error: ..." } structure.
    // For consistency with the above, let's use { result: "Error: ..." }
    const notImplementedError = {
      message: `Function ${functionName} not implemented in the factory`,
    };
    console.warn(`[executeFunctionCall] ${notImplementedError.message}`);
    return { result: `Error: ${notImplementedError.message}` };
  }
};
