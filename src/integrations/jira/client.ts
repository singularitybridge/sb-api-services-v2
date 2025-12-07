/**
 * Jira Client Module
 * Handles client initialization and provides a request wrapper
 */

import { Version3Client } from 'jira.js';
import { getApiKey } from '../../services/api.key.service';
import { Result } from './types';

// ============================================================================
// Client Initialization
// ============================================================================

/**
 * Initialize a Jira client for a company
 * @param companyId - The company ID to get credentials for
 * @returns Initialized Version3Client
 */
export const initializeClient = async (
  companyId: string,
): Promise<Version3Client> => {
  const apiToken = await getApiKey(companyId, 'jira_api_token');
  const domain = await getApiKey(companyId, 'jira_domain');
  const email = await getApiKey(companyId, 'jira_email');

  if (!apiToken || !domain || !email) {
    throw new Error(
      'Missing JIRA configuration. Please set JIRA_API_TOKEN, JIRA_DOMAIN, and JIRA_EMAIL.',
    );
  }

  const host = domain.endsWith('.atlassian.net')
    ? `https://${domain}/`
    : `https://${domain}.atlassian.net/`;

  return new Version3Client({
    host,
    authentication: {
      basic: {
        email,
        apiToken,
      },
    },
  });
};

// ============================================================================
// Request Wrapper
// ============================================================================

export interface JiraRequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  url: string;
  params?: Record<string, any>;
  data?: any;
}

/**
 * Extract a user-friendly error message from Jira API errors
 */
export const extractJiraErrorMessage = (
  error: any,
  defaultMessage: string,
): string => {
  const jiraError = error?.error || error;

  if (jiraError?.errorMessages && jiraError.errorMessages.length > 0) {
    return jiraError.errorMessages.join(' ');
  }

  if (jiraError?.errors && Object.keys(jiraError.errors).length > 0) {
    return Object.entries(jiraError.errors)
      .map(([field, msg]) => `${field}: ${msg}`)
      .join('; ');
  }

  if (jiraError?.message) {
    return jiraError.message;
  }

  return defaultMessage;
};

/**
 * Execute a raw Jira API request with standardized error handling
 * Wraps the callback-based sendRequest in a Promise
 */
export const executeJiraRequest = async <T = any>(
  client: Version3Client,
  options: JiraRequestOptions,
  errorContext: string,
): Promise<T> => {
  return new Promise((resolve, reject) => {
    client.sendRequest(
      {
        method: options.method,
        url: options.url,
        params: options.params,
        data: options.data,
      },
      (error: any, data: any) => {
        if (error) {
          const message = extractJiraErrorMessage(error, errorContext);
          reject(new Error(message));
        } else {
          resolve(data);
        }
      },
    );
  });
};

/**
 * Execute a Jira operation and wrap the result in a Result<T>
 * Provides consistent error handling across all service functions
 */
export const withJiraClient = async <T>(
  companyId: string,
  operation: (client: Version3Client) => Promise<T>,
  errorContext: string,
): Promise<Result<T>> => {
  try {
    const client = await initializeClient(companyId);
    const data = await operation(client);
    return { success: true, data };
  } catch (error: any) {
    const message = error?.message || errorContext;
    return {
      success: false,
      error: message.startsWith('Failed')
        ? message
        : `${errorContext}: ${message}`,
    };
  }
};

/**
 * Execute a Jira operation that returns Result<T> internally
 * For operations that handle their own Result wrapping
 */
export const withJiraClientRaw = async <T>(
  companyId: string,
  operation: (client: Version3Client) => Promise<Result<T>>,
  errorContext: string,
): Promise<Result<T>> => {
  try {
    const client = await initializeClient(companyId);
    return await operation(client);
  } catch (error: any) {
    return {
      success: false,
      error: `${errorContext}: ${error?.message || 'Unknown error'}`,
    };
  }
};
