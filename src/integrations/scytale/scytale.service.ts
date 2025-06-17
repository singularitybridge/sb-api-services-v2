import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3002/context';

export interface ScytaleContextTypeResponse {
    companyId: string;
    contextTypes: string[];
}

export interface ScytaleContextItem {
    id: string;
    createdAt: string;
    updatedAt: string;
    companyId: string;
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
 * Fetches the list of available context types for a given company.
 * @param companyId The ID of the company.
 * @returns A promise that resolves to an object indicating success or failure, with data if successful.
 */
export const getContextTypesPerCompany = async (
  companyId: string,
): Promise<{ success: boolean; data?: ScytaleContextTypeResponse; error?: string }> => {
  try {
    const url = `${BASE_URL}/${companyId}/types`;
    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch context types for ${companyId}: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = (await response.json()) as ScytaleContextTypeResponse;
    return { success: true, data };
  } catch (error: any) {
    console.error(`Error in getContextTypesPerCompany for companyId ${companyId}:`, error);
    return { success: false, error: error.message || 'An unknown error occurred while fetching company context types.' };
  }
};

/**
 * Fetches detailed information for a specific context item for a given company and context type.
 * @param companyId The ID of the company.
 * @param contextType The type of the context item (e.g., 'control', 'policy').
 * @returns A promise that resolves to an object indicating success or failure, with data if successful.
 */
export const getContextItemsByCompanyAndType = async (
  companyId: string,
  contextType: string,
): Promise<{ success: boolean; data?: ScytaleContextItem[]; error?: string }> => {
  if (!companyId || !contextType) {
    throw new Error('Both companyId and contextType parameters are required.');
  }
  try {
    const url = `${BASE_URL}/${companyId}/${contextType}/items`;
    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch context items for company ${companyId} and type ${contextType}: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = (await response.json()) as ScytaleContextItem[];
    return { success: true, data };
  } catch (error: any) {
    console.error(`Error in getContextItemsByCompanyAndType (companyId: ${companyId}, contextType: ${contextType}):`, error);
    return { success: false, error: error.message || `An unknown error occurred while fetching context items for type ${contextType}.` };
  }
};

/**
 * Performs a vector search for context items.
 * @param companyId The ID of the company.
 * @param searchRequest The search query and optional limit.
 * @returns A promise that resolves to an object indicating success or failure, with data if successful.
 */
export const contextVectorSearch = async (
  companyId: string,
  searchRequest: ScytaleVectorSearchRequest,
): Promise<{ success: boolean; data?: ScytaleVectorSearchResponse; error?: string }> => {
  if (!companyId || !searchRequest || !searchRequest.query) {
    throw new Error('companyId and a search query are required for vector search.');
  }
  try {
    const url = `${BASE_URL}/${companyId}/search`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(searchRequest),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to perform vector search for ${companyId}: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = (await response.json()) as ScytaleVectorSearchResponse;
    return { success: true, data };
  } catch (error: any) {
    console.error(`Error in contextVectorSearch (companyId: ${companyId}, query: ${searchRequest.query}):`, error);
    return { success: false, error: error.message || 'An unknown error occurred during vector search.' };
  }
};
