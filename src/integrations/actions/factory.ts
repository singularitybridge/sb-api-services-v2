import { readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { FunctionFactory, ActionContext, FunctionDefinition } from './types';
import { processTemplate } from '../../services/template.service';

const sanitizeFunctionName = (name: string): string => {
  // Replace dots with underscores and remove any other non-compliant characters
  return name.replace(/\./g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
};

export const createFunctionFactory = async (context: ActionContext, allowedActions: string[]): Promise<FunctionFactory> => {
  const integrationsPath = join(__dirname, '..');
  const integrationFolders = readdirSync(integrationsPath).filter(folder =>
    existsSync(join(integrationsPath, folder, 'integration.config.json'))
  );

  let allActions: FunctionFactory = {};

  for (const folder of integrationFolders) {
    const integrationPath = join(integrationsPath, folder);
    const configFilePath = join(integrationPath, 'integration.config.json');

    let config: any;
    try {
      config = require(configFilePath);
    } catch (error) {
      console.error(`Failed to read config file for ${folder}:`, error);
      continue;
    }

    const actionFilePath = join(integrationPath, config.actionsFile || `${folder}.actions.ts`);

    if (!existsSync(actionFilePath)) {
      console.log(`Action file not found for ${folder}. Skipping.`);
      continue;
    }

    try {
      const module = await import(actionFilePath);
      const actionCreator = module[config.actionCreator];

      if (typeof actionCreator === 'function') {
        const actionObj = actionCreator(context) as FunctionFactory;
        const integrationName = config.name || folder;
        const prefixedActions = Object.fromEntries(
          Object.entries(actionObj).map(([actionName, funcDef]) => {
            const fullActionName = `${integrationName}.${actionName}`;
            const sanitizedName = sanitizeFunctionName(fullActionName);
            return [sanitizedName, {
              ...funcDef as FunctionDefinition,
              originalName: fullActionName // Store the original name
            }];
          })
        );
        allActions = { ...allActions, ...prefixedActions };
      } else {
        console.log(`No valid action creator found for ${folder}.`);
      }
    } catch (error) {
      console.error(`Failed to process ${actionFilePath}:`, error);
    }
  }

  const sanitizedAllowedActions = allowedActions.map(sanitizeFunctionName);
  const functionFactory = Object.fromEntries(
    Object.entries(allActions).filter(([actionName]) => sanitizedAllowedActions.includes(actionName))
  ) as FunctionFactory;

  return functionFactory;
};

interface DetailedError {
  message: string;
  name?: string;
  stack?: string;
  details?: Record<string, unknown>;
}

function extractErrorDetails(error: unknown): DetailedError {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
      details: Object.fromEntries(Object.entries(error).filter(([key]) => !['name', 'message', 'stack'].includes(key)))
    };
  } else if (typeof error === 'object' && error !== null) {
    return {
      message: String((error as any).message || 'Unknown error'),
      details: error as Record<string, unknown>
    };
  } else {
    return { message: String(error) };
  }
}

export const executeFunctionCall = async (
  call: any,
  sessionId: string,
  companyId: string,
  allowedActions: string[]
): Promise<{ result?: any; error?: DetailedError }> => {
  const context: ActionContext = { sessionId, companyId };
  const functionFactory = await createFunctionFactory(context, allowedActions);

  const functionName = sanitizeFunctionName(call.function.name as string);

  if (functionName in functionFactory) {
    try {
      let args = JSON.parse(call.function.arguments);
      console.log('processing args', args);
      for (const key in args) {
        if (typeof args[key] === 'string') {
          args[key] = await processTemplate(args[key], sessionId);
        }
      }

      const result = await functionFactory[functionName].function(args);
      return { result };
    } catch (error) {
      console.error(`Error executing function ${functionName}:`, error);
      return { error: extractErrorDetails(error) };
    }
  } else {
    return { error: { message: `Function ${functionName} not implemented in the factory` } };
  }
};

export { sanitizeFunctionName };
export type { ActionContext, FunctionFactory, FunctionDefinition };