// AWS Bedrock Knowledge Base Types

export interface SearchOptions {
  numberOfResults?: number;
  searchType?: 'HYBRID' | 'SEMANTIC' | null;
}

export interface SearchResult {
  content: string;
  score: number;
  source: string;
  metadata: Record<string, any>;
  contentLength: number;
}

export interface BedrockKBConfig {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  knowledgeBaseId: string;
}

export interface FormattedSearchResult {
  success: boolean;
  results: SearchResult[];
  summary: string;
}

// Service response types for executeAction
export interface SearchServiceResponse {
  success: boolean;
  data?: FormattedSearchResult;
  description?: string;
  error?: string;
}

// AWS SDK Response Types
export interface RetrievalResult {
  content?: {
    text?: string;
  };
  location?: {
    webLocation?: {
      url?: string;
    };
    s3Location?: {
      uri?: string;
    };
    type?: string;
  };
  score?: number;
  metadata?: Record<string, any>;
}

export interface RetrieveResponse {
  retrievalResults?: RetrievalResult[];
  nextToken?: string;
}

// Error types
export enum BedrockErrorType {
  VALIDATION_ERROR = 'ValidationException',
  ACCESS_DENIED = 'AccessDeniedException',
  UNRECOGNIZED_CLIENT = 'UnrecognizedClientException',
  RESOURCE_NOT_FOUND = 'ResourceNotFoundException',
  THROTTLING = 'ThrottlingException',
  SERVICE_ERROR = 'ServiceException',
}

export interface BedrockError extends Error {
  errorType: BedrockErrorType;
  statusCode?: number;
  requestId?: string;
}
