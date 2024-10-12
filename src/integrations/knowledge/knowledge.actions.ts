import { ActionContext, FunctionFactory } from '../actions/types';
import { searchFiles } from './knowledge.service';

export const createKnowledgeActions = (context: ActionContext): FunctionFactory => ({
  searchFiles: {
    description: 'Search files in the knowledge base',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The search query' },
        fileType: { type: 'string', description: 'Optional file type filter' },
      },
      required: ['query'],
      additionalProperties: false,
    },
    function: async (params: { query: string; fileType?: string }) => {
      return await searchFiles(context, params);
    },
  },
});
