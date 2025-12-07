import axios from 'axios';
import { getApiKey } from '../../services/api.key.service';

interface PerplexityResponse {
  id: string;
  model: string;
  created: number;
  object: string;
  choices: {
    index: number;
    finish_reason: string;
    delta?: {
      content: string;
    };
    message?: {
      role: string;
      content: string;
    };
  }[];
  related_questions?: string[];
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function makePerplexityRequest(
  apiKey: string,
  requestBody: any,
  attempt: number = 1,
  maxRetries: number = 3,
): Promise<PerplexityResponse> {
  try {
    const response = await axios.post<PerplexityResponse>(
      'https://api.perplexity.ai/chat/completions',
      requestBody,
      {
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
        },
      },
    );
    return response.data;
  } catch (error: any) {
    const status = error.response?.status;
    const isRetryable =
      status === 520 ||
      status === 502 ||
      status === 503 ||
      status === 504 ||
      status === 429;

    if (isRetryable && attempt < maxRetries) {
      const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      console.warn(
        `Perplexity API error ${status}, retrying in ${backoffMs}ms (attempt ${attempt}/${maxRetries})`,
      );
      await sleep(backoffMs);
      return makePerplexityRequest(
        apiKey,
        requestBody,
        attempt + 1,
        maxRetries,
      );
    }

    throw error;
  }
}

export async function performPerplexitySearch(
  companyId: string,
  model: string,
  query: string,
  searchMode: 'academic' | 'sec' | 'web' = 'web',
  returnRelatedQuestions: boolean = false,
  reasoningEffort: 'low' | 'medium' | 'high' = 'medium',
): Promise<{ searchResult: string; relatedQuestions?: string[] }> {
  const apiKey = await getApiKey(companyId, 'perplexity_api_key');
  if (!apiKey) {
    throw new Error('Perplexity API key not found');
  }

  const validModels = [
    'sonar',
    'sonar-pro',
    'sonar-reasoning',
    'sonar-reasoning-pro',
    'sonar-deep-research',
  ];

  if (!validModels.includes(model)) {
    throw new Error('Invalid model specified');
  }

  try {
    const requestBody: any = {
      model,
      messages: [
        {
          role: 'system',
          content: 'Be precise and concise.',
        },
        {
          role: 'user',
          content: query,
        },
      ],
      search_mode: searchMode,
      return_related_questions: returnRelatedQuestions,
    };

    // Add reasoning_effort only for sonar-deep-research model
    if (model === 'sonar-deep-research') {
      requestBody.reasoning_effort = reasoningEffort;
    }

    const data = await makePerplexityRequest(apiKey, requestBody);

    // Handle different response structures for reasoning models
    const content = data.choices[0]?.message?.content || '';

    let cleanContent = content;
    if (model.includes('reasoning')) {
      // Reasoning models may include <think> tags before the content
      // Extract content after any <think> sections if present
      cleanContent = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    }

    const result: { searchResult: string; relatedQuestions?: string[] } = {
      searchResult: cleanContent,
    };

    // Include related questions if they were requested and returned
    if (returnRelatedQuestions && data.related_questions) {
      result.relatedQuestions = data.related_questions;
    }

    return result;
  } catch (error: any) {
    const status = error.response?.status;
    console.error('Error calling Perplexity API:', error);
    console.error('Error details:', {
      message: error.message,
      response: error.response?.data,
      status,
    });

    let errorMessage = 'Failed to perform Perplexity search';
    if (status === 520) {
      errorMessage =
        'Perplexity API is temporarily unavailable (520 error). Please try again in a moment.';
    } else if (status === 429) {
      errorMessage =
        'Perplexity API rate limit exceeded. Please try again later.';
    } else if (status >= 500) {
      errorMessage = `Perplexity API server error (${status}). Please try again.`;
    } else if (error.response?.data?.error) {
      errorMessage = `Perplexity API error: ${error.response.data.error}`;
    } else {
      errorMessage = `Failed to perform Perplexity search: ${error.message}`;
    }

    throw new Error(errorMessage);
  }
}

/**
 * Verify Perplexity API key by making a minimal test request
 */
export async function verifyPerplexityKey(apiKey: string): Promise<boolean> {
  try {
    // Make a minimal request to verify the key
    await axios.post(
      'https://api.perplexity.ai/chat/completions',
      {
        model: 'sonar',
        messages: [
          {
            role: 'user',
            content: 'test',
          },
        ],
        max_tokens: 1, // Minimal token usage for verification
      },
      {
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
        },
      },
    );
    return true;
  } catch (error: any) {
    // 401 or 403 means invalid/unauthorized key
    const status = error.response?.status;
    if (status === 401 || status === 403) {
      return false;
    }
    // For other errors (network issues, server errors), return false but don't throw
    // This is more user-friendly than throwing errors during key verification
    console.error('Perplexity key verification error:', error.message, status);
    return false;
  }
}
