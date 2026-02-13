import { ActionContext, FunctionFactory } from '../actions/types';
import { TestConnectionResult } from '../../services/integration-config.service';
import axios from 'axios';

/**
 * Validate OpenRouter connection by checking API key via /auth/key endpoint.
 * The /models endpoint is public, so we use /auth/key to actually verify the key.
 */
export async function validateConnection(
  apiKeys: Record<string, string>,
): Promise<TestConnectionResult> {
  const apiKey = apiKeys.openrouter_api_key;

  if (!apiKey) {
    return {
      success: false,
      error: 'OpenRouter API key is not configured',
    };
  }

  try {
    const response = await axios.get('https://openrouter.ai/api/v1/auth/key', {
      headers: { Authorization: `Bearer ${apiKey}` },
      timeout: 10000,
    });

    if (response.status === 200 && response.data?.data) {
      const label = response.data.data.label || 'API key';
      return {
        success: true,
        message: `Connected — key "${label}" verified`,
      };
    }

    return { success: false, error: 'Unexpected response from OpenRouter API' };
  } catch (error: any) {
    const status = error.response?.status;
    if (status === 401 || status === 502) {
      return {
        success: false,
        error: 'Invalid API key. Please check your OpenRouter API key.',
      };
    }
    return {
      success: false,
      error: error.message || 'Failed to connect to OpenRouter',
    };
  }
}

/**
 * OpenRouter is a provider, not an action-based integration.
 * Models are accessed by setting llmProvider to 'openrouter' on an agent.
 * This empty factory is required for the discovery system.
 */
export const createOpenRouterActions = (
  _context: ActionContext,
): FunctionFactory => ({});
