import {
  ActionContext,
  FunctionFactory,
  StandardActionResult,
} from '../actions/types';
import { BedrockKnowledgeBaseService } from './aws_bedrock_kb.service';
import { executeAction } from '../actions/executor';
import {
  ActionValidationError,
  ActionExecutionError,
} from '../../utils/actionErrors';
import {
  FormattedSearchResult,
  SearchServiceResponse,
} from './aws_bedrock_kb.types';
import { getApiKey } from '../../services/api.key.service';

const SERVICE_NAME = 'AWS Bedrock Knowledge Base';

/**
 * Create AWS Bedrock Knowledge Base actions
 */
export const createAWSBedrockKBActions = (
  context: ActionContext,
): FunctionFactory => {
  const { companyId } = context;

  return {
    /**
     * Search the AWS Bedrock Knowledge Base for relevant content
     */
    searchKnowledgeBase: {
      description:
        'Search AWS Bedrock Knowledge Base for relevant content using vector-based semantic search',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query to find relevant documentation',
          },
          numberOfResults: {
            type: 'number',
            description:
              'Maximum number of results to return (default: 5, max: 100)',
            minimum: 1,
            maximum: 100,
          },
          searchType: {
            type: 'string',
            description: 'Type of search to perform',
            enum: ['HYBRID', 'SEMANTIC'],
          },
        },
        required: ['query'],
        additionalProperties: false,
      },
      function: async (params: {
        query: string;
        numberOfResults?: number;
        searchType?: 'HYBRID' | 'SEMANTIC';
      }): Promise<StandardActionResult<FormattedSearchResult>> => {
        // Input validation
        if (!params.query || params.query.trim() === '') {
          throw new ActionValidationError(
            'Search query is required and cannot be empty.',
          );
        }

        if (
          params.numberOfResults &&
          (params.numberOfResults < 1 || params.numberOfResults > 100)
        ) {
          throw new ActionValidationError(
            'Number of results must be between 1 and 100.',
          );
        }

        // Check if AWS credentials are configured
        const hasCredentials = await checkAWSCredentials(companyId);
        if (!hasCredentials) {
          throw new ActionExecutionError(
            'AWS Bedrock Knowledge Base is not configured. Please add AWS credentials and Knowledge Base ID.',
            {
              actionName: 'searchKnowledgeBase',
              statusCode: 400,
            },
          );
        }

        return executeAction<FormattedSearchResult, SearchServiceResponse>(
          'searchKnowledgeBase',
          async (): Promise<SearchServiceResponse> => {
            try {
              const service = new BedrockKnowledgeBaseService(companyId);
              const results = await service.search(params.query, {
                numberOfResults: params.numberOfResults,
                searchType: params.searchType || null,
              });

              return {
                success: true,
                data: {
                  success: true,
                  results: results,
                  summary: `Found ${results.length} relevant ${
                    results.length === 1 ? 'result' : 'results'
                  } in the knowledge base`,
                },
              };
            } catch (error: any) {
              // Let executeAction handle the error wrapping
              throw error;
            }
          },
          {
            serviceName: SERVICE_NAME,
            successMessage: 'Successfully searched the knowledge base',
          },
        );
      },
    },

    /**
     * Get formatted search results for agent consumption
     */
    getFormattedKBResults: {
      description:
        'Search knowledge base and return formatted results optimized for AI agent consumption',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query to find relevant documentation',
          },
          maxResults: {
            type: 'number',
            description:
              'Maximum number of results to return in formatted output (default: 3)',
            minimum: 1,
            maximum: 10,
          },
        },
        required: ['query'],
        additionalProperties: false,
      },
      function: async (params: {
        query: string;
        maxResults?: number;
      }): Promise<
        StandardActionResult<{ formattedText: string; resultCount: number }>
      > => {
        // Input validation
        if (!params.query || params.query.trim() === '') {
          throw new ActionValidationError(
            'Search query is required and cannot be empty.',
          );
        }

        if (
          params.maxResults &&
          (params.maxResults < 1 || params.maxResults > 10)
        ) {
          throw new ActionValidationError(
            'Max results must be between 1 and 10 for formatted output.',
          );
        }

        // Check if AWS credentials are configured
        const hasCredentials = await checkAWSCredentials(companyId);
        if (!hasCredentials) {
          throw new ActionExecutionError(
            'AWS Bedrock Knowledge Base is not configured. Please add AWS credentials and Knowledge Base ID.',
            {
              actionName: 'getFormattedKBResults',
              statusCode: 400,
            },
          );
        }

        return executeAction<
          { formattedText: string; resultCount: number },
          {
            success: boolean;
            data?: { formattedText: string; resultCount: number };
            description?: string;
          }
        >(
          'getFormattedKBResults',
          async () => {
            try {
              const service = new BedrockKnowledgeBaseService(companyId);
              const formattedResults = await service.getFormattedResults(
                params.query,
                params.maxResults || 3,
              );

              // Extract result count from formatted text
              const resultCountMatch =
                formattedResults.match(/Found (\d+) relevant/);
              const resultCount = resultCountMatch
                ? parseInt(resultCountMatch[1], 10)
                : 0;

              return {
                success: true,
                data: {
                  formattedText: formattedResults,
                  resultCount: resultCount,
                },
              };
            } catch (error: any) {
              throw error;
            }
          },
          {
            serviceName: SERVICE_NAME,
            successMessage: 'Successfully retrieved formatted search results',
          },
        );
      },
    },

    /**
     * Test AWS Bedrock Knowledge Base connection
     */
    testBedrockConnection: {
      description:
        'Test the connection to AWS Bedrock Knowledge Base to verify configuration',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
        additionalProperties: false,
      },
      function: async (): Promise<
        StandardActionResult<{ connected: boolean; message: string }>
      > => {
        return executeAction<
          { connected: boolean; message: string },
          {
            success: boolean;
            data?: { connected: boolean; message: string };
            description?: string;
          }
        >(
          'testBedrockConnection',
          async () => {
            try {
              const service = new BedrockKnowledgeBaseService(companyId);
              const isConnected = await service.testConnection();

              return {
                success: true,
                data: {
                  connected: isConnected,
                  message: isConnected
                    ? 'Successfully connected to AWS Bedrock Knowledge Base'
                    : 'Failed to connect to AWS Bedrock Knowledge Base. Please check your configuration.',
                },
              };
            } catch (error: any) {
              return {
                success: false,
                description: `Connection test failed: ${error.message}`,
              };
            }
          },
          {
            serviceName: SERVICE_NAME,
          },
        );
      },
    },
  };
};

/**
 * Helper function to check if AWS credentials are configured
 */
async function checkAWSCredentials(companyId: string): Promise<boolean> {
  try {
    const [accessKeyId, secretAccessKey, knowledgeBaseId] = await Promise.all([
      getApiKey(companyId, 'aws_access_key_id'),
      getApiKey(companyId, 'aws_secret_access_key'),
      getApiKey(companyId, 'aws_bedrock_kb_id'),
    ]);

    return !!(accessKeyId && secretAccessKey && knowledgeBaseId);
  } catch (error) {
    return false;
  }
}
