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
  // Properties from ActionExecutionError
  actionName?: string;
  originalError?: any;
  statusCode?: number; // Common, also in ActionValidationError and ActionServiceError
  // Properties from ActionValidationError
  fieldErrors?: Record<string, string>;
  // Properties from ActionServiceError
  serviceName?: string;
  serviceResponse?: any;
  // Generic details bucket
  details?: Record<string, unknown>;
}

import { ActionExecutionError, ActionValidationError, ActionServiceError, BaseActionError } from '../../utils/actionErrors'; // Import custom errors

export const extractErrorDetails = (error: unknown): DetailedError => {
  if (error instanceof BaseActionError) { // Handle our custom errors first for specific properties
    const baseDetails: DetailedError = {
      message: error.message,
      name: error.name,
      stack: error.stack,
    };

    // Add specific properties from custom errors to the top level
    if (error instanceof ActionExecutionError) {
      return {
        ...baseDetails,
        actionName: error.actionName,
        originalError: error.originalError, // This might still be complex, consider further processing if needed
        statusCode: error.statusCode,
        // Capture any other enumerable properties not explicitly handled, if any
        details: Object.fromEntries(Object.entries(error).filter(([key]) => !['name', 'message', 'stack', 'actionName', 'originalError', 'statusCode'].includes(key)))
      };
    } else if (error instanceof ActionValidationError) {
      return {
        ...baseDetails,
        fieldErrors: error.fieldErrors,
        statusCode: error.statusCode,
        details: Object.fromEntries(Object.entries(error).filter(([key]) => !['name', 'message', 'stack', 'fieldErrors', 'statusCode'].includes(key)))
      };
    } else if (error instanceof ActionServiceError) {
      return {
        ...baseDetails,
        serviceName: error.serviceName,
        serviceResponse: error.serviceResponse, // This might still be complex
        statusCode: error.statusCode,
        details: Object.fromEntries(Object.entries(error).filter(([key]) => !['name', 'message', 'stack', 'serviceName', 'serviceResponse', 'statusCode'].includes(key)))
      };
    }
    // Fallback for BaseActionError or other derived types not specifically handled above
    return {
      ...baseDetails,
      details: Object.fromEntries(Object.entries(error).filter(([key]) => !['name', 'message', 'stack'].includes(key)))
    };
  } else if (error instanceof Error) { // Standard Error
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
      // For generic errors, keep other properties in 'details'
      details: Object.fromEntries(Object.entries(error).filter(([key]) => !['name', 'message', 'stack'].includes(key)))
    };
  } else if (typeof error === 'object' && error !== null) { // Plain object error
    return {
      message: String((error as Record<string, unknown>).message || 'Unknown error'),
      details: error as Record<string, unknown> // The whole object becomes details
    };
  } else { // Other types
    return { message: String(error) };
  }
};

export type { ActionContext, FunctionFactory, FunctionDefinition };
