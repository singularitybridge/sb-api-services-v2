import fetch from 'node-fetch';
import { getApiKey } from '../../services/api.key.service';

export interface ContextTypeResponse {
  contextId: string;
  contextTypes: string[];
}

export interface ContextItem {
  id: string;
  createdAt: string;
  updatedAt: string;
  contextId: string;
  contextType: string;
  internalId: string;
  name: string;
  description: string;
}

export interface VectorSearchRequest {
  query: string;
  limit?: number;
}

export interface VectorSearchResultItem {
  item: ContextItem;
  score: number;
}

export interface VectorSearchResponse {
  results: VectorSearchResultItem[];
}

export interface IndexingStatusResponse {
  queueSize: number;
  pending: number;
  isPaused: boolean;
}

/**
 * Fetches the list of available context types for a given context.
 * @param contextId The ID of the context.
 * @returns A promise that resolves to an object indicating success or failure, with data if successful.
 */
export const getContextTypes = async (
  companyId: string,
  contextId: string,
): Promise<{
  success: boolean;
  data?: ContextTypeResponse;
  error?: string;
}> => {
  try {
    let scytaleBaseUrl = await getApiKey(companyId, 'scytale_base_url');
    const scytaleAuthToken = await getApiKey(companyId, 'scytale_auth_token');

    if (!scytaleBaseUrl) {
      throw new Error('Scytale Base URL not configured.');
    }

    // Temporary fix: Ensure the base URL ends with /context if it's missing
    if (!scytaleBaseUrl.endsWith('/context')) {
      scytaleBaseUrl = `${scytaleBaseUrl}/context`;
    }

    const url = `${scytaleBaseUrl}/${contextId}/types`;
    const headers: Record<string, string> = {};
    if (scytaleAuthToken) {
      headers['Authorization'] = `Bearer ${scytaleAuthToken}`;
    }
    const response = await fetch(url, { headers });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to fetch context types for ${contextId}: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    const data = (await response.json()) as ContextTypeResponse;
    return { success: true, data };
  } catch (error: any) {
    console.error(
      `Error in getContextTypes for contextId ${contextId}:`,
      error,
    );
    return {
      success: false,
      error:
        error.message ||
        'An unknown error occurred while fetching context types.',
    };
  }
};

/**
 * Fetches the indexing status of the context.
 * @param companyId The ID of the company.
 * @returns A promise that resolves to an object indicating success or failure, with data if successful.
 */
export const getIndexingStatus = async (
  companyId: string,
): Promise<{
  success: boolean;
  data?: IndexingStatusResponse;
  error?: string;
}> => {
  try {
    let scytaleBaseUrl = await getApiKey(companyId, 'scytale_base_url');
    const scytaleAuthToken = await getApiKey(companyId, 'scytale_auth_token');

    if (!scytaleBaseUrl) {
      throw new Error('Scytale Base URL not configured.');
    }

    // Ensure the base URL ends with /context if it's missing
    if (!scytaleBaseUrl.endsWith('/context')) {
      scytaleBaseUrl = `${scytaleBaseUrl}/context`;
    }

    const url = `${scytaleBaseUrl}/indexing-status`;
    const headers: Record<string, string> = {};
    if (scytaleAuthToken) {
      headers['Authorization'] = `Bearer ${scytaleAuthToken}`;
    }
    const response = await fetch(url, { headers });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to fetch indexing status: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    const data = (await response.json()) as IndexingStatusResponse;
    return { success: true, data };
  } catch (error: any) {
    console.error(`Error in getIndexingStatus:`, error);
    return {
      success: false,
      error:
        error.message ||
        'An unknown error occurred while fetching indexing status.',
    };
  }
};

/**
 * Fetches detailed information for a specific context item for a given context and context type.
 * @param contextId The ID of the context.
 * @param contextType The type of the context item (e.g., 'control', 'policy').
 * @returns A promise that resolves to an object indicating success or failure, with data if successful.
 */
export const getContextItems = async (
  companyId: string,
  contextId: string,
  contextType: string,
  limit?: number,
  offset?: number,
): Promise<{ success: boolean; data?: ContextItem[]; error?: string }> => {
  if (!contextId || !contextType) {
    throw new Error('Both contextId and contextType parameters are required.');
  }
  try {
    let scytaleBaseUrl = await getApiKey(companyId, 'scytale_base_url');
    const scytaleAuthToken = await getApiKey(companyId, 'scytale_auth_token');

    if (!scytaleBaseUrl) {
      throw new Error('Scytale Base URL not configured.');
    }

    // Temporary fix: Ensure the base URL ends with /context if it's missing
    if (!scytaleBaseUrl.endsWith('/context')) {
      scytaleBaseUrl = `${scytaleBaseUrl}/context`;
    }

    let url = `${scytaleBaseUrl}/${contextId}/${contextType}/items`;
    const queryParams = new URLSearchParams();
    if (limit !== undefined) {
      queryParams.append('limit', limit.toString());
    }
    if (offset !== undefined) {
      queryParams.append('offset', offset.toString());
    }

    if (queryParams.toString()) {
      url = `${url}?${queryParams.toString()}`;
    }

    const headers: Record<string, string> = {};
    if (scytaleAuthToken) {
      headers['Authorization'] = `Bearer ${scytaleAuthToken}`;
    }
    const response = await fetch(url, { headers });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to fetch context items for context ${contextId} and type ${contextType}: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    const data = (await response.json()) as ContextItem[];
    return { success: true, data };
  } catch (error: any) {
    console.error(
      `Error in getContextItems (contextId: ${contextId}, contextType: ${contextType}):`,
      error,
    );
    return {
      success: false,
      error:
        error.message ||
        `An unknown error occurred while fetching context items for type ${contextType}.`,
    };
  }
};

/**
 * Performs a vector search for context items.
 * @param contextId The ID of the context.
 * @param searchRequest The search query and optional limit.
 * @returns A promise that resolves to an object indicating success or failure, with data if successful.
 */
export const vectorSearch = async (
  companyId: string,
  contextId: string,
  searchRequest: VectorSearchRequest,
): Promise<{
  success: boolean;
  data?: VectorSearchResponse;
  error?: string;
}> => {
  if (!contextId || !searchRequest || !searchRequest.query) {
    throw new Error(
      'contextId and a search query are required for vector search.',
    );
  }
  try {
    let scytaleBaseUrl = await getApiKey(companyId, 'scytale_base_url');
    const scytaleAuthToken = await getApiKey(companyId, 'scytale_auth_token');

    if (!scytaleBaseUrl) {
      throw new Error('Scytale Base URL not configured.');
    }

    // Temporary fix: Ensure the base URL ends with /context if it's missing
    if (!scytaleBaseUrl.endsWith('/context')) {
      scytaleBaseUrl = `${scytaleBaseUrl}/context`;
    }

    const url = `${scytaleBaseUrl}/${contextId}/search`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (scytaleAuthToken) {
      headers['Authorization'] = `Bearer ${scytaleAuthToken}`;
    }
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(searchRequest),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to perform vector search for ${contextId}: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    const data = (await response.json()) as VectorSearchResponse;
    return { success: true, data };
  } catch (error: any) {
    console.error(
      `Error in vectorSearch (contextId: ${contextId}, query: ${searchRequest.query}):`,
      error,
    );
    return {
      success: false,
      error: error.message || 'An unknown error occurred during vector search.',
    };
  }
};
