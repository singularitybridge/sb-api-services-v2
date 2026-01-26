import { v4 as uuidv4 } from 'uuid';
import mongoose from 'mongoose';
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

/**
 * Check if a string is a valid MongoDB ObjectId
 */
const isValidObjectId = (id: string): boolean => {
  return mongoose.Types.ObjectId.isValid(id) && id !== 'stateless_execution';
};

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

/**
 * Execute a function call with an explicit ActionContext.
 * This is the primary execution path - context is passed directly, no session lookup needed.
 */
export const executeFunctionCallWithContext = async (
  call: FunctionCall,
  context: ActionContext,
  allowedActions: string[],
): Promise<{ result?: unknown; error?: DetailedError }> => {
  console.log(
    `[executeFunctionCallWithContext] Starting execution with context:`,
    {
      sessionId: context.sessionId,
      companyId: context.companyId,
      isStateless: context.isStateless,
      userId: context.userId,
      assistantId: context.assistantId,
    },
  );

  let functionFactory: FunctionFactory;
  try {
    functionFactory = await createFunctionFactory(context, allowedActions);
  } catch (error) {
    console.error(
      '[executeFunctionCallWithContext] Critical error creating function factory:',
      error,
    );
    // Return an empty factory to allow the assistant to continue working
    functionFactory = {};
  }

  const activeSessionId = context.sessionId;
  const sessionLanguage = context.language;

  console.log(
    `[executeFunctionCallWithContext] Allowed actions for session ${activeSessionId}:`,
    JSON.stringify(allowedActions),
  );

  const functionName = call.function.name;
  const originalActionId = functionName;

  console.log(
    `[executeFunctionCallWithContext] Attempting to execute function: ${functionName}`,
  );
  console.log(
    `[executeFunctionCallWithContext] Raw arguments: ${call.function.arguments}`,
  );

  if (functionName in functionFactory) {
    let executionDetails: ExecutionDetails | undefined;

    try {
      const args = JSON.parse(call.function.arguments) as Record<
        string,
        unknown
      >;
      console.log(`[executeFunctionCallWithContext] Parsed arguments:`, args);

      const { executionId, convertedActionId, actionInfo, processedArgs } =
        await prepareActionExecution(
          functionName,
          args,
          activeSessionId,
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

      // Only send Pusher updates for non-stateless sessions
      if (!context.isStateless) {
        console.log(
          `[executeFunctionCallWithContext] Sending 'started' update for action ${convertedActionId} to session ${activeSessionId}`,
        );
        await sendActionUpdate(activeSessionId, 'started', executionDetails);
      }

      // Improved file search detection
      const isFileSearch =
        functionName === 'file_search' ||
        actionInfo.actionTitle.toLowerCase().includes('file search') ||
        actionInfo.description.toLowerCase().includes('file search');

      if (isFileSearch && !context.isStateless) {
        // Publish a notification for file search detection
        await sendActionUpdate(activeSessionId, 'started', {
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
        const errorDetails = extractErrorDetails(
          result.error || 'Unknown error',
        );
        if (!context.isStateless) {
          await sendActionUpdate(activeSessionId, 'failed', {
            ...executionDetails,
            output: result,
            error: errorDetails,
          });
        }

        const errorReturn = {
          result: `Error: ${result.error || 'Action failed'}`,
        };
        console.log(
          `[executeFunctionCallWithContext] Returning error to AI SDK for ${functionName}:`,
          JSON.stringify(errorReturn, null, 2),
        );
        return errorReturn;
      } else {
        if (!context.isStateless) {
          await sendActionUpdate(activeSessionId, 'completed', {
            ...executionDetails,
            output: result,
          });
          if (isFileSearch) {
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
        }
        const resultData = result.data ?? {
          message: 'Action completed successfully',
        };
        const successReturn = { result: resultData };
        return successReturn;
      }
    } catch (error) {
      console.error(
        `[executeFunctionCallWithContext] Error executing function ${functionName}:`,
        error,
      );

      const errorDetails = extractErrorDetails(error);

      if (!context.isStateless) {
        if (executionDetails) {
          await sendActionUpdate(activeSessionId, 'failed', {
            ...executionDetails,
            output: {
              success: false,
              error: errorDetails.message,
              errorDetails: errorDetails,
            },
            error: errorDetails,
          });
        } else {
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
            output: {
              success: false,
              error: errorDetails.message,
              errorDetails: errorDetails,
            },
            error: errorDetails,
          });
        }
      }

      const sdkErrorReturn = {
        result: `Error: ${errorDetails.name} - ${errorDetails.message}`,
      };
      console.log(
        `[executeFunctionCallWithContext] Returning error to AI SDK for ${functionName} (from catch block):`,
        JSON.stringify(sdkErrorReturn, null, 2),
      );
      return sdkErrorReturn;
    }
  } else {
    const notImplementedError = {
      message: `Function ${functionName} not implemented in the factory`,
    };
    console.warn(
      `[executeFunctionCallWithContext] ${notImplementedError.message}`,
    );
    return { result: `Error: ${notImplementedError.message}` };
  }
};

/**
 * Execute a function call by deriving context from a session lookup.
 * This is the legacy path - use executeFunctionCallWithContext when context is already available.
 */
export const executeFunctionCall = async (
  call: FunctionCall,
  sessionId: string,
  companyId: string,
  allowedActions: string[],
): Promise<{ result?: unknown; error?: DetailedError }> => {
  console.log(
    `[executeFunctionCall] Starting execution with sessionId: ${sessionId}, companyId: ${companyId}`,
  );

  // Check if sessionId is valid for database lookup
  if (!isValidObjectId(sessionId)) {
    console.error(
      `[executeFunctionCall] Invalid sessionId "${sessionId}" - cannot derive context from session. Use executeFunctionCallWithContext instead.`,
    );
    return {
      error: {
        name: 'InvalidSessionError',
        message: `Cannot execute function call: sessionId "${sessionId}" is not a valid session ID. For stateless execution, use executeFunctionCallWithContext with an explicit ActionContext.`,
      },
    };
  }

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
    isStateless: false,
  };

  // Delegate to the context-first implementation
  return executeFunctionCallWithContext(call, context, allowedActions);
};
