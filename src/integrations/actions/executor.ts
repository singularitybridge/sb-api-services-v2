// src/integrations/actions/executor.ts

import { StandardActionResult } from './types';
import {
  ActionExecutionError,
  ActionServiceError,
} from '../../utils/actionErrors';

/**
 * Options for the executeAction function.
 * @template R The type of the data in the StandardActionResult.
 * @template S The type of the raw service call result.
 */
export interface ExecuteActionOptions<R, S = any> {
  /** A human-readable message for the success case. If not provided, a default will be used. */
  successMessage?: string;
  /** A function to extract and transform the relevant data from the service call result. */
  dataExtractor?: (serviceResult: S) => R;
  /** A function to transform an error before it's re-thrown. Useful for wrapping or adding context. */
  errorTransformer?: (error: any, actionName: string) => Error;
  /** The name of the service being called, for better error reporting. */
  serviceName?: string;
}

/**
 * A centralized function to execute an action's underlying service call,
 * handle its response, and standardize the result or error.
 *
 * @template R The type of the 'data' payload in the StandardActionResult.
 * @template S The type of the raw result from the serviceCall.
 * @param {string} actionName - The name of the action being executed (for logging/error context).
 * @param {() => Promise<S>} serviceCall - A function that returns a Promise of the service call result.
 *                                        The service call result is expected to have a `success: boolean`
 *                                        and optionally `description: string` and `data: any`.
 * @param {ExecuteActionOptions<R, S>} [options] - Optional parameters to customize behavior.
 * @returns {Promise<StandardActionResult<R>>} A Promise resolving to a StandardActionResult.
 * @throws {ActionServiceError | ActionExecutionError | Error} Throws an appropriate error on failure.
 */
export async function executeAction<
  R,
  S extends { success: boolean; description?: string; data?: any } = any,
>(
  actionName: string,
  serviceCall: () => Promise<S>,
  options?: ExecuteActionOptions<R, S>,
): Promise<StandardActionResult<R>> {
  try {
    const result = await serviceCall();

    if (result.success === false) {
      // If the service call itself indicates failure (e.g., returns { success: false, ... })
      const message =
        result.description || "Service call for '" + actionName + "' failed.";
      throw new ActionServiceError(message, {
        serviceName: options?.serviceName,
        serviceResponse: result,
        // statusCode can be added if the service result provides it
      });
    }

    const extractedData = options?.dataExtractor
      ? options.dataExtractor(result)
      : (result.data as R); // Default to using result.data directly

    const actionResult: StandardActionResult<R> = {
      success: true,
      message:
        options?.successMessage ||
        result.description ||
        actionName + ' completed successfully.',
      data: extractedData,
    };

    // Preserve costInfo if the service call returned it
    if ((result as any).costInfo) {
      actionResult.costInfo = (result as any).costInfo;
    }

    return actionResult;
  } catch (error) {
    if (options?.errorTransformer) {
      throw options.errorTransformer(error, actionName);
    }

    if (
      error instanceof ActionServiceError ||
      error instanceof ActionExecutionError
    ) {
      throw error; // Re-throw known action errors
    }

    // Wrap other errors in ActionExecutionError for consistent handling
    // For HTTP errors (axios), include the response body so AI models
    // get actionable context (e.g. 409 "trip is processing" messages)
    let errorMessage: string;
    const axiosResponse = (error as any)?.response;
    if (axiosResponse?.status && axiosResponse?.data) {
      const body = typeof axiosResponse.data === 'string'
        ? axiosResponse.data
        : JSON.stringify(axiosResponse.data);
      errorMessage = `HTTP ${axiosResponse.status}: ${body}`;
    } else if (error instanceof Error) {
      errorMessage = error.message;
    } else {
      errorMessage = 'An unexpected error occurred in ' + actionName + '.';
    }
    throw new ActionExecutionError(errorMessage, {
      actionName,
      originalError: error,
    });
  }
}
