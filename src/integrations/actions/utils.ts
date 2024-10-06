import { readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { ActionContext, FunctionFactory, FunctionDefinition } from './types';

export const sanitizeFunctionName = (name: string): string =>
  name.replace(/\./g, '_').replace(/[^a-zA-Z0-9_-]/g, '');

export const getIntegrationFolders = (integrationsPath: string): string[] =>
  readdirSync(integrationsPath).filter(folder =>
    existsSync(join(integrationsPath, folder, 'integration.config.json'))
  );

export const loadConfig = (configPath: string): Record<string, unknown> | null => {
  try {
    return require(configPath);
  } catch (error) {
    console.error(`Failed to read config file: ${configPath}`, error);
    return null;
  }
};

export const createPrefixedActions = (
  actionObj: FunctionFactory,
  integrationName: string
): FunctionFactory =>
  Object.fromEntries(
    Object.entries(actionObj).map(([actionName, funcDef]) => {
      const fullActionName = `${integrationName}.${actionName}`;
      const sanitizedName = sanitizeFunctionName(fullActionName);
      return [sanitizedName, {
        ...(funcDef as FunctionDefinition<any>),
        originalName: fullActionName
      }];
    })
  );

export const filterAllowedActions = (
  allActions: FunctionFactory,
  allowedActions: string[]
): FunctionFactory => {
  const sanitizedAllowedActions = allowedActions.map(sanitizeFunctionName);
  return Object.fromEntries(
    Object.entries(allActions).filter(([actionName]) =>
      sanitizedAllowedActions.includes(actionName)
    )
  ) as FunctionFactory;
};

export const convertOpenAIFunctionName = (name: string): string => {
  // Split the function name into parts separated by underscores
  const nameParts = name.split('_');

  if (nameParts.length < 2) {
    // If there's no underscore or only one part, return the name as-is
    return name;
  }

  // Assume the integration name is everything up to the second-to-last part
  const integrationName = nameParts.slice(0, -1).join('_');
  const actionName = nameParts[nameParts.length - 1];

  // Replace any remaining underscores in the action name with dots
  const formattedActionName = actionName.replace(/_/g, '.');

  return `${integrationName}.${formattedActionName}`;
};



export interface DetailedError {
  message: string;
  name?: string;
  stack?: string;
  details?: Record<string, unknown>;
}

export const extractErrorDetails = (error: unknown): DetailedError => {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
      details: Object.fromEntries(Object.entries(error).filter(([key]) => !['name', 'message', 'stack'].includes(key)))
    };
  } else if (typeof error === 'object' && error !== null) {
    return {
      message: String((error as Record<string, unknown>).message || 'Unknown error'),
      details: error as Record<string, unknown>
    };
  } else {
    return { message: String(error) };
  }
};

export type { ActionContext, FunctionFactory, FunctionDefinition };