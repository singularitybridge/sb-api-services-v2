import {
  BedrockAgentRuntimeClient,
  RetrieveCommand,
  RetrieveCommandInput,
  RetrieveCommandOutput,
} from '@aws-sdk/client-bedrock-agent-runtime';
import { getApiKey } from '../../services/api.key.service';
import {
  BedrockKBConfig,
  SearchOptions,
  SearchResult,
  RetrievalResult,
  BedrockErrorType,
} from './aws_bedrock_kb.types';

export class BedrockKnowledgeBaseService {
  private client: BedrockAgentRuntimeClient | null = null;
  private config: BedrockKBConfig | null = null;
  private companyId: string;

  constructor(companyId: string) {
    this.companyId = companyId;
  }

  /**
   * Initialize the AWS Bedrock client with credentials from the database
   */
  private async initializeClient(): Promise<void> {
    if (this.client && this.config) {
      return; // Already initialized
    }

    // Retrieve encrypted credentials from database
    const [accessKeyId, secretAccessKey, knowledgeBaseId, region] =
      await Promise.all([
        getApiKey(this.companyId, 'aws_access_key_id'),
        getApiKey(this.companyId, 'aws_secret_access_key'),
        getApiKey(this.companyId, 'aws_bedrock_kb_id'),
        getApiKey(this.companyId, 'aws_region'),
      ]);

    if (!accessKeyId || !secretAccessKey || !knowledgeBaseId) {
      throw new Error(
        'Missing AWS Bedrock configuration. Please configure AWS credentials and Knowledge Base ID.',
      );
    }

    this.config = {
      accessKeyId,
      secretAccessKey,
      region: region || 'us-east-1',
      knowledgeBaseId,
    };

    this.client = new BedrockAgentRuntimeClient({
      region: this.config.region,
      credentials: {
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey,
      },
    });
  }

  /**
   * Search the knowledge base for relevant content
   * @param query - The search query
   * @param options - Search options
   * @returns Array of search results with content and metadata
   */
  async search(
    query: string,
    options: SearchOptions = {},
  ): Promise<SearchResult[]> {
    await this.initializeClient();

    if (!this.client || !this.config) {
      throw new Error('Bedrock client not initialized');
    }

    const { numberOfResults = 5, searchType = null } = options;

    try {
      const commandInput: RetrieveCommandInput = {
        knowledgeBaseId: this.config.knowledgeBaseId,
        retrievalQuery: {
          text: query,
        },
      };

      // Add optional retrieval configuration
      if (numberOfResults || searchType) {
        commandInput.retrievalConfiguration = {
          vectorSearchConfiguration: {
            ...(numberOfResults && { numberOfResults }),
            ...(searchType && { overrideSearchType: searchType }),
          },
        };
      }

      const command = new RetrieveCommand(commandInput);
      const response: RetrieveCommandOutput = await this.client.send(command);

      if (response.retrievalResults) {
        return this.formatResults(response.retrievalResults);
      }

      return [];
    } catch (error: any) {
      console.error('Knowledge Base search error:', error.message);
      throw this.transformError(error);
    }
  }

  /**
   * Format raw retrieval results into standardized SearchResult format
   */
  private formatResults(retrievalResults: RetrievalResult[]): SearchResult[] {
    return retrievalResults.map((result) => ({
      content: result.content?.text || '',
      score: result.score || 0,
      source: this.extractSource(result),
      metadata: result.metadata || {},
      contentLength: result.content?.text?.length || 0,
    }));
  }

  /**
   * Extract source URL from retrieval result
   */
  private extractSource(result: RetrievalResult): string {
    if (result.location?.webLocation?.url) {
      return result.location.webLocation.url;
    }
    if (result.location?.s3Location?.uri) {
      return result.location.s3Location.uri;
    }
    return 'Unknown source';
  }

  /**
   * Transform AWS SDK errors into more meaningful error messages
   */
  private transformError(error: any): Error {
    const errorMessage = error.message || 'Unknown error occurred';
    const errorName = error.name || error.__type || 'UnknownError';

    switch (errorName) {
      case BedrockErrorType.VALIDATION_ERROR:
        return new Error(
          `Invalid configuration: ${errorMessage}. Please verify your Knowledge Base ID and ensure it's active.`,
        );
      case BedrockErrorType.ACCESS_DENIED:
        return new Error(
          `Access denied: ${errorMessage}. Please check your IAM permissions for bedrock:Retrieve.`,
        );
      case BedrockErrorType.UNRECOGNIZED_CLIENT:
        return new Error(
          `Invalid AWS credentials: ${errorMessage}. Please verify your AWS Access Key ID and Secret Access Key.`,
        );
      case BedrockErrorType.RESOURCE_NOT_FOUND:
        return new Error(
          `Knowledge Base not found: ${errorMessage}. Please verify the Knowledge Base exists in the specified region.`,
        );
      case BedrockErrorType.THROTTLING:
        return new Error(
          `Rate limit exceeded: ${errorMessage}. Please wait a moment and try again.`,
        );
      default:
        return new Error(`AWS Bedrock error: ${errorMessage}`);
    }
  }

  /**
   * Get formatted search results for agent consumption
   * @param query - The search query
   * @param maxResults - Maximum number of results
   * @returns Formatted string of search results
   */
  async getFormattedResults(
    query: string,
    maxResults: number = 3,
  ): Promise<string> {
    const results = await this.search(query, { numberOfResults: maxResults });

    if (results.length === 0) {
      return 'No relevant results found in the knowledge base.';
    }

    let formatted = `Found ${results.length} relevant results:\n\n`;

    results.forEach((result, index) => {
      formatted += `**Result ${index + 1}** (Score: ${result.score.toFixed(
        2,
      )})\n`;
      formatted += `Source: ${result.source}\n`;

      // Truncate content if too long for display
      const maxContentLength = 500;
      const content =
        result.content.length > maxContentLength
          ? result.content.substring(0, maxContentLength) + '...'
          : result.content;

      formatted += `Content: ${content}\n\n`;
    });

    return formatted.trim();
  }

  /**
   * Perform a test search to validate configuration
   * @returns Boolean indicating if the configuration is valid
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.search('test', { numberOfResults: 1 });
      return true;
    } catch (error) {
      console.error('Bedrock KB connection test failed:', error);
      return false;
    }
  }
}
