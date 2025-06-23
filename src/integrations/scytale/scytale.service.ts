import fetch from 'node-fetch';
import { getApiKey } from '../../services/api.key.service';

export interface ScytaleContextTypeResponse {
    contextId: string;
    contextTypes: string[];
}

export interface ScytaleContextItem {
    id: string;
    createdAt: string;
    updatedAt: string;
    contextId: string;
    contextType: string;
    internalId: string;
    name: string;
    description: string;
}

export interface ScytaleVectorSearchRequest {
    query: string;
    limit?: number;
}

export interface ScytaleVectorSearchResultItem {
    item: ScytaleContextItem;
    score: number;
}

export interface ScytaleVectorSearchResponse {
    results: ScytaleVectorSearchResultItem[];
}

/**
 * Fetches the list of available context types for a given context.
 * @param contextId The ID of the context.
 * @returns A promise that resolves to an object indicating success or failure, with data if successful.
 */
export const getContextTypesPerCompany = async (
  companyId: string,
  contextId: string,
): Promise<{ success: boolean; data?: ScytaleContextTypeResponse; error?: string }> => {
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
      throw new Error(`Failed to fetch context types for ${contextId}: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = (await response.json()) as ScytaleContextTypeResponse;
    return { success: true, data };
  } catch (error: any) {
    console.error(`Error in getContextTypesPerCompany for contextId ${contextId}:`, error);
    return { success: false, error: error.message || 'An unknown error occurred while fetching context types.' };
  }
};

/**
 * Fetches detailed information for a specific context item for a given context and context type.
 * @param contextId The ID of the context.
 * @param contextType The type of the context item (e.g., 'control', 'policy').
 * @returns A promise that resolves to an object indicating success or failure, with data if successful.
 */
export const getContextItemsByCompanyAndType = async (
  companyId: string,
  contextId: string,
  contextType: string,
): Promise<{ success: boolean; data?: ScytaleContextItem[]; error?: string }> => {
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

    const url = `${scytaleBaseUrl}/${contextId}/${contextType}/items`;
    const headers: Record<string, string> = {};
    if (scytaleAuthToken) {
      headers['Authorization'] = `Bearer ${scytaleAuthToken}`;
    }
    const response = await fetch(url, { headers });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch context items for context ${contextId} and type ${contextType}: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = (await response.json()) as ScytaleContextItem[];
    return { success: true, data };
  } catch (error: any) {
    console.error(`Error in getContextItemsByCompanyAndType (contextId: ${contextId}, contextType: ${contextType}):`, error);
    return { success: false, error: error.message || `An unknown error occurred while fetching context items for type ${contextType}.` };
  }
};

/**
 * Performs a vector search for context items.
 * @param contextId The ID of the context.
 * @param searchRequest The search query and optional limit.
 * @returns A promise that resolves to an object indicating success or failure, with data if successful.
 */
export const contextVectorSearch = async (
  companyId: string,
  contextId: string,
  searchRequest: ScytaleVectorSearchRequest,
): Promise<{ success: boolean; data?: ScytaleVectorSearchResponse; error?: string }> => {
  if (!contextId || !searchRequest || !searchRequest.query) {
    throw new Error('contextId and a search query are required for vector search.');
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
      throw new Error(`Failed to perform vector search for ${contextId}: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = (await response.json()) as ScytaleVectorSearchResponse;
    return { success: true, data };
  } catch (error: any) {
    console.error(`Error in contextVectorSearch (contextId: ${contextId}, query: ${searchRequest.query}):`, error);
    return { success: false, error: error.message || 'An unknown error occurred during vector search.' };
  }
};
