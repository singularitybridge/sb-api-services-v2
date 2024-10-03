import { readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { ActionContext, FunctionFactory, FunctionDefinition } from './types';

export const sanitizeFunctionName = (name: string): string =>
  name.replace(/\./g, '_').replace(/[^a-zA-Z0-9_-]/g, '');

export const getIntegrationFolders = (integrationsPath: string): string[] =>
  readdirSync(integrationsPath).filter(folder =>
    existsSync(join(integrationsPath, folder, 'integration.config.json'))
  );

export const loadConfig = (configPath: string): any => {
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
        ...(funcDef as FunctionDefinition),
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

export const convertOpenAIFunctionName = (name: string): string =>
  name.startsWith('ai_agent_executor_')
    ? name.replace(/^ai_agent_executor_/, 'ai_agent_executor.')
    : name.replace(/_/g, '.');

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
      message: String((error as any).message || 'Unknown error'),
      details: error as Record<string, unknown>
    };
  } else {
    return { message: String(error) };
  }
};