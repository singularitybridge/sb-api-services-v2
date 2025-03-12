import { Client } from '@notionhq/client';
import { getApiKey } from '../../services/api.key.service';

/**
 * Initialize the Notion client with the API key from the company's API key store
 */
export const initNotionClient = async (companyId: string): Promise<Client> => {
  const apiKey = await getApiKey(companyId, 'NOTION_API_KEY');
  if (!apiKey) {
    throw new Error('Notion API key not found');
  }
  
  return new Client({ auth: apiKey });
};

/**
 * Fetch items from a Notion database
 */
export const fetchDatabaseItems = async (
  companyId: string,
  databaseId: string,
  filter?: Record<string, any>,
  sorts?: Record<string, any>[]
): Promise<{ success: boolean; data?: any }> => {
  if (!databaseId) {
    throw new Error('Database ID is required');
  }
  
  try {
    const notion = await initNotionClient(companyId);
    const queryParams: any = { database_id: databaseId };
    
    if (filter) {
      queryParams.filter = filter;
    }
    
    if (sorts && sorts.length > 0) {
      queryParams.sorts = sorts;
    }
    
    const response = await notion.databases.query(queryParams);
    return { success: true, data: response.results };
  } catch (error: any) {
    throw new Error(`Notion API error: ${error.message}`);
  }
};

/**
 * Create a new page in Notion
 */
export const createPage = async (
  companyId: string,
  parentId: string,
  parentType: 'database_id' | 'page_id',
  properties: Record<string, any>,
  children?: Record<string, any>[]
): Promise<{ success: boolean; data?: any }> => {
  if (!parentId) {
    throw new Error('Parent ID is required');
  }
  
  if (!properties) {
    throw new Error('Properties are required');
  }
  
  try {
    const notion = await initNotionClient(companyId);
    
    const pageData: any = {
      [parentType]: parentId,
      properties
    };
    
    if (children && children.length > 0) {
      pageData.children = children;
    }
    
    const response = await notion.pages.create(pageData);
    return { success: true, data: response };
  } catch (error: any) {
    throw new Error(`Notion API error: ${error.message}`);
  }
};

/**
 * Update an existing page in Notion
 */
export const updatePage = async (
  companyId: string,
  pageId: string,
  properties: Record<string, any>
): Promise<{ success: boolean; data?: any }> => {
  if (!pageId) {
    throw new Error('Page ID is required');
  }
  
  if (!properties) {
    throw new Error('Properties are required');
  }
  
  try {
    const notion = await initNotionClient(companyId);
    const response = await notion.pages.update({
      page_id: pageId,
      properties
    });
    
    return { success: true, data: response };
  } catch (error: any) {
    throw new Error(`Notion API error: ${error.message}`);
  }
};

/**
 * Search for content in Notion
 */
export const searchNotion = async (
  companyId: string,
  query: string,
  searchParams?: Record<string, any>
): Promise<{ success: boolean; data?: any }> => {
  try {
    const notion = await initNotionClient(companyId);
    const params: any = {};
    
    if (query) {
      params.query = query;
    }
    
    if (searchParams) {
      Object.assign(params, searchParams);
    }
    
    const response = await notion.search(params);
    return { success: true, data: response.results };
  } catch (error: any) {
    throw new Error(`Notion API error: ${error.message}`);
  }
};

/**
 * Verify that the Notion API key is valid
 */
export const verifyNotionApiKey = async (apiKey: string): Promise<boolean> => {
  try {
    const notion = new Client({ auth: apiKey });
    // Make a simple request to verify the API key
    await notion.users.me({});
    return true;
  } catch (error) {
    console.error('Error verifying Notion API key:', error);
    return false;
  }
};
