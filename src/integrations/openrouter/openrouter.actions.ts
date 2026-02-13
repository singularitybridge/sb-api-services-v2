import { ActionContext, FunctionFactory } from '../actions/types';
import { TestConnectionResult } from '../../services/integration-config.service';
import axios from 'axios';

/**
 * Validate OpenRouter connection by listing models.
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
    const response = await axios.get('https://openrouter.ai/api/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
      timeout: 10000,
    });

    if (response.status === 200 && response.data?.data?.length > 0) {
      return {
        success: true,
        message: `Connected — ${response.data.data.length} models available`,
      };
    }

    return { success: false, error: 'Unexpected response from OpenRouter API' };
  } catch (error: any) {
    if (error.response?.status === 401) {
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
