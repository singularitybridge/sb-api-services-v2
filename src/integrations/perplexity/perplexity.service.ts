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
}

export async function performPerplexitySearch(
  companyId: string,
  model: string,
  query: string,
): Promise<string> {
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
    };

    // Note: search_mode parameter has been deprecated
    // The API now uses different parameters for search customization
    // For now, we'll omit the searchMode to avoid 400 errors

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

    // Handle different response structures for reasoning models
    if (model.includes('reasoning')) {
      // Reasoning models may include <think> tags before the content
      const content = response.data.choices[0]?.message?.content || '';
      // Extract content after any <think> sections if present
      const cleanContent = content
        .replace(/<think>[\s\S]*?<\/think>/g, '')
        .trim();
      return cleanContent;
    }

    const content = response.data.choices[0]?.message?.content || '';
    return content;
  } catch (error) {
    console.error('Error calling Perplexity API:', error);
    throw new Error('Failed to perform Perplexity search');
  }
}
