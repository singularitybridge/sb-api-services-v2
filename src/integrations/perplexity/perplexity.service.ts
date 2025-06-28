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
    'llama-3.1-sonar-small-128k-online',
    'llama-3.1-sonar-large-128k-online',
  ];
  if (!validModels.includes(model)) {
    throw new Error('Invalid model specified');
  }

  try {
    const response = await axios.post<PerplexityResponse>(
      'https://api.perplexity.ai/chat/completions',
      {
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
      },
      {
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
        },
      },
    );

    // Extract and return only the content from the response
    const content = response.data.choices[0]?.message?.content || '';
    return content;
  } catch (error) {
    console.error('Error calling Perplexity API:', error);
    throw new Error('Failed to perform Perplexity search');
  }
}
