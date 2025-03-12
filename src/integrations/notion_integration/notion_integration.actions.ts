import { ActionContext, FunctionFactory } from '../actions/types';
import { 
  fetchDatabaseItems, 
  createPage, 
  updatePage, 
  searchNotion 
} from './notion_integration.service';

interface GetDatabaseItemsArgs {
  databaseId: string;
  filter?: object;
  sorts?: object[];
}

interface CreatePageArgs {
  parentId: string;
  parentType: 'database_id' | 'page_id';
  properties: object;
  children?: object[];
}

interface UpdatePageArgs {
  pageId: string;
  properties: object;
}

interface SearchNotionArgs {
  query: string;
  searchParams?: object;
}

export const createNotionIntegrationActions = (context: ActionContext): FunctionFactory => ({
  getDatabaseItems: {
    description: 'Retrieves items from a specified Notion database',
    parameters: {
      type: 'object',
      properties: {
        databaseId: { 
          type: 'string', 
          description: 'The ID of the Notion database' 
        },
        filter: {
          type: 'object',
          description: 'Optional filter to apply to the database query'
        },
        sorts: {
          type: 'array',
          description: 'Optional sort configurations for the database query'
        }
      },
      required: ['databaseId'],
      additionalProperties: false,
    },
    function: async (args: GetDatabaseItemsArgs) => {
      return await fetchDatabaseItems(
        context.companyId, 
        args.databaseId, 
        args.filter, 
        args.sorts
      );
    },
  },

  createNotionPage: {
    description: 'Creates a new page in Notion, either in a database or as a child of another page',
    parameters: {
      type: 'object',
      properties: {
        parentId: {
          type: 'string',
          description: 'The ID of the parent (database or page)'
        },
        parentType: {
          type: 'string',
          description: 'The type of parent (database_id or page_id)',
          enum: ['database_id', 'page_id']
        },
        properties: {
          type: 'object',
          description: 'The properties of the page to create'
        },
        children: {
          type: 'array',
          description: 'Optional content blocks for the page'
        }
      },
      required: ['parentId', 'parentType', 'properties'],
      additionalProperties: false,
    },
    function: async (args: CreatePageArgs) => {
      return await createPage(
        context.companyId,
        args.parentId,
        args.parentType,
        args.properties,
        args.children
      );
    },
  },

  updateNotionPage: {
    description: 'Updates an existing page in Notion',
    parameters: {
      type: 'object',
      properties: {
        pageId: {
          type: 'string',
          description: 'The ID of the page to update'
        },
        properties: {
          type: 'object',
          description: 'The properties to update on the page'
        }
      },
      required: ['pageId', 'properties'],
      additionalProperties: false,
    },
    function: async (args: UpdatePageArgs) => {
      return await updatePage(
        context.companyId,
        args.pageId,
        args.properties
      );
    },
  },

  searchNotion: {
    description: 'Searches for content across the Notion workspace',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query'
        },
        searchParams: {
          type: 'object',
          description: 'Optional additional search parameters'
        }
      },
      required: ['query'],
      additionalProperties: false,
    },
    function: async (args: SearchNotionArgs) => {
      return await searchNotion(
        context.companyId,
        args.query,
        args.searchParams
      );
    },
  },
});
