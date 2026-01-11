/**
 * RoomBoss Client Module
 * Handles HTTP Basic Auth client initialization and request execution
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { getApiKey } from '../../services/api.key.service';
import { Result } from './types';

const DEFAULT_BASE_URL = 'https://api.roomboss.com';

// ============================================================================
// Client Initialization
// ============================================================================

/**
 * Initialize a RoomBoss client for a company
 * Uses HTTP Basic Authentication
 */
export const initializeClient = async (
  companyId: string,
): Promise<AxiosInstance> => {
  const username = await getApiKey(companyId, 'roomboss_username');
  const password = await getApiKey(companyId, 'roomboss_password');

  if (!username || !password) {
    throw new Error(
      'Missing RoomBoss configuration. Please set roomboss_username and roomboss_password in company settings.',
    );
  }

  return axios.create({
    baseURL: DEFAULT_BASE_URL,
    auth: {
      username,
      password,
    },
    headers: {
      Accept: 'application/json',
    },
    timeout: 30000,
  });
};

// ============================================================================
// Error Handling
// ============================================================================

/**
 * Extract user-friendly error message from RoomBoss API errors
 */
export const extractRoomBossErrorMessage = (
  error: unknown,
  defaultMessage: string,
): string => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{
      error?: string;
      message?: string;
      errorMessage?: string;
    }>;

    // Check for RoomBoss-specific error format
    const responseData = axiosError.response?.data;
    if (responseData?.error) {
      return responseData.error;
    }
    if (responseData?.message) {
      return responseData.message;
    }
    if (responseData?.errorMessage) {
      return responseData.errorMessage;
    }

    // HTTP status-based messages
    if (axiosError.response?.status === 401) {
      return 'Authentication failed. Please check RoomBoss credentials.';
    }
    if (axiosError.response?.status === 403) {
      return 'Access denied. Insufficient permissions for this operation.';
    }
    if (axiosError.response?.status === 404) {
      return 'Resource not found.';
    }

    if (axiosError.message) {
      return axiosError.message;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return defaultMessage;
};

// ============================================================================
// Request Execution
// ============================================================================

export interface RoomBossRequestOptions {
  endpoint: string;
  params?: Record<string, unknown>;
}

/**
 * Execute a RoomBoss GET request with standardized error handling
 * All RoomBoss API calls are GET requests with query parameters
 */
export const executeRoomBossRequest = async <T = unknown>(
  client: AxiosInstance,
  options: RoomBossRequestOptions,
  errorContext: string,
): Promise<T> => {
  try {
    // Filter out undefined/null params
    const cleanParams: Record<string, unknown> = {};
    if (options.params) {
      for (const [key, value] of Object.entries(options.params)) {
        if (value !== undefined && value !== null && value !== '') {
          cleanParams[key] = value;
        }
      }
    }

    const response = await client.get<T>(options.endpoint, {
      params: cleanParams,
    });
    return response.data;
  } catch (error) {
    const message = extractRoomBossErrorMessage(error, errorContext);
    throw new Error(message);
  }
};

/**
 * Execute a RoomBoss operation and wrap the result in a Result<T>
 */
export const withRoomBossClient = async <T>(
  companyId: string,
  operation: (client: AxiosInstance) => Promise<T>,
  errorContext: string,
): Promise<Result<T>> => {
  try {
    const client = await initializeClient(companyId);
    const data = await operation(client);
    return { success: true, data };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: message.startsWith('Failed')
        ? message
        : `${errorContext}: ${message}`,
    };
  }
};
