import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { FunctionFactory, ActionContext, FunctionDefinition } from './types';
import { processTemplate } from '../../services/template.service';
import { publishSessionMessage } from '../../services/pusher.service';
import { discoverActionById } from '../../services/integration.service';
import { getSessionById } from '../../services/session.service';
import { SupportedLanguage } from '../../services/discovery.service';
import {
  sanitizeFunctionName,
  getIntegrationFolders,
  loadConfig,
  createPrefixedActions,
  filterAllowedActions,
  convertOpenAIFunctionName,
  extractErrorDetails,
  DetailedError
} from './utils';

const loadActionModule = async (actionFilePath: string, config: any, context: ActionContext): Promise<FunctionFactory> => {
  try {
    const module = await import(actionFilePath);
    const actionCreator = module[config.actionCreator];

    if (typeof actionCreator === 'function') {
      return actionCreator(context) as FunctionFactory;
    } else {
      console.log(`No valid action creator found in ${actionFilePath}`);
      return {};
    }
  } catch (error) {
    console.error(`Failed to process ${actionFilePath}:`, error);
    return {};
  }
};

const processIntegrationFolder = async (folder: string, integrationsPath: string, context: ActionContext): Promise<FunctionFactory> => {
  const integrationPath = join(integrationsPath, folder);
  const configFilePath = join(integrationPath, 'integration.config.json');
  const config = loadConfig(configFilePath);

  if (!config) return {};

  const actionFilePath = join(integrationPath, config.actionsFile || `${folder}.actions.ts`);
  const actionObj = await loadActionModule(actionFilePath, config, context);
  const integrationName = config.name || folder;

  return createPrefixedActions(actionObj, integrationName);
};

export const createFunctionFactory = async (context: ActionContext, allowedActions: string[]): Promise<FunctionFactory> => {
  const integrationsPath = join(__dirname, '..');
  const integrationFolders = getIntegrationFolders(integrationsPath);

  const allActionPromises = integrationFolders.map(folder => processIntegrationFolder(folder, integrationsPath, context));
  const allActionResults = await Promise.all(allActionPromises);

  const allActions = allActionResults.reduce((acc, actions) => ({ ...acc, ...actions }), {});
  return filterAllowedActions(allActions, allowedActions);
};

const prepareActionExecution = async (
  functionName: string,
  args: any,
  sessionId: string,
  sessionLanguage: SupportedLanguage
) => {
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

const publishActionMessage = async (
  sessionId: string,
  status: 'started' | 'completed' | 'failed',
  executionDetails: {
    id: string;
    actionId: string;
    serviceName: string;
    actionTitle: string;
    actionDescription: string;
    icon: string;
    args: any;
    originalActionId: string;
    language: SupportedLanguage;
  }
) => {
  await publishSessionMessage(sessionId, 'action_execution', {
    ...executionDetails,
    status
  });
};

export const executeFunctionCall = async (
  call: any,
  sessionId: string,
  companyId: string,
  allowedActions: string[]
): Promise<{ result?: any; error?: DetailedError }> => {
  const context: ActionContext = { sessionId, companyId };
  const functionFactory = await createFunctionFactory(context, allowedActions);

  const functionName = call.function.name as string;
  const originalActionId = functionName;
  const session = await getSessionById(sessionId);
  const sessionLanguage = session.language as SupportedLanguage;

  if (functionName in functionFactory) {
    try {
      const args = JSON.parse(call.function.arguments);
      const { executionId, convertedActionId, actionInfo, processedArgs } = await prepareActionExecution(
        functionName,
        args,
        sessionId,
        sessionLanguage
      );

      await publishActionMessage(sessionId, 'started', {
        id: executionId,
        actionId: convertedActionId,
        serviceName: actionInfo.serviceName,
        actionTitle: actionInfo.actionTitle,
        actionDescription: actionInfo.description,
        icon: actionInfo.icon || '',
        args: processedArgs,
        originalActionId,
        language: sessionLanguage,
      });

      const result = await functionFactory[functionName].function(processedArgs);

      await publishActionMessage(sessionId, 'completed', {
        id: executionId,
        actionId: convertedActionId,
        serviceName: actionInfo.serviceName,
        actionTitle: actionInfo.actionTitle,
        actionDescription: actionInfo.description,
        icon: actionInfo.icon || '',
        args: processedArgs,
        originalActionId,
        language: sessionLanguage,
      });

      return { result };
    } catch (error) {
      console.error(`Error executing function ${functionName}:`, error);

      const failedActionInfo = await discoverActionById(convertOpenAIFunctionName(functionName), sessionLanguage);
      await publishActionMessage(sessionId, 'failed', {
        id: uuidv4(),
        actionId: convertOpenAIFunctionName(functionName),
        serviceName: failedActionInfo?.serviceName || 'unknown',
        actionTitle: failedActionInfo?.actionTitle || 'unknown',
        actionDescription: failedActionInfo?.description || 'unknown',
        icon: failedActionInfo?.icon || '',
        args: JSON.parse(call.function.arguments),
        originalActionId: functionName,
        language: sessionLanguage,
      });

      return { error: extractErrorDetails(error) };
    }
  } else {
    return { error: { message: `Function ${functionName} not implemented in the factory` } };
  }
};

export { sanitizeFunctionName };
export type { ActionContext, FunctionFactory, FunctionDefinition };