import { readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { FunctionFactory, ActionContext, FunctionDefinition } from './types';
import { processTemplate } from '../../services/template.service';
import sanitize from 'sanitize-filename';

export function sanitizeFunctionName(name: string): string {
  return sanitize(name)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^a-zA-Z0-9_]/g, '_') // Replace special characters with underscores
    .replace(/^_+|_+$/g, '') // Remove leading and trailing underscores
    .replace(/\s+/g, '_'); // Replace spaces with underscores
}

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
        // Prefix the action names with the integration name and sanitize
        const prefixedActions = Object.fromEntries(
          Object.entries(actionObj).map(([actionName, funcDef]) => {
            const fullActionName = sanitizeFunctionName(`${folder}.${actionName}`);
            return [fullActionName, funcDef as FunctionDefinition];
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

  // Sanitize allowed actions
  const sanitizedAllowedActions = allowedActions.map(actionName => sanitizeFunctionName(actionName));

  // Filter allowed actions
  const functionFactory = Object.fromEntries(
    Object.entries(allActions).filter(([actionName]) => sanitizedAllowedActions.includes(actionName))
  ) as FunctionFactory;

  return functionFactory;
};

export const executeFunctionCall = async (call: any, sessionId: string, companyId: string, allowedActions: string[]) => {
  const context: ActionContext = { sessionId, companyId };
  const functionFactory = await createFunctionFactory(context, allowedActions);

  const functionName = sanitizeFunctionName(call.function.name as string);

  if (functionName in functionFactory) {
    let args = JSON.parse(call.function.arguments);
    console.log('processing args', args);
    // Process each argument with the template service
    for (const key in args) {
      if (typeof args[key] === 'string') {
        args[key] = await processTemplate(args[key], sessionId);
      }
    }

    return await functionFactory[functionName].function(args);
  } else {
    throw new Error(`Function ${functionName} not implemented in the factory`);
  }
};

export type { ActionContext, FunctionFactory, FunctionDefinition };