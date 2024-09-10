import { ActionContext, FunctionDefinition } from './types';
import * as linearService from '../services/linear.service';

export const createLinearActions = (context: ActionContext) => {
  const fetchIssues: FunctionDefinition = {
    function: async ({ first = 50 }) => {
      const issues = await linearService.fetchIssues(context.companyId, first);
      return issues;
    },
    description: 'Fetch issues from Linear',
    parameters: {
      type: 'object',
      properties: {
        first: {
          type: 'number',
          description: 'Number of issues to fetch',
        },
      },
      required: [],
    },
  };

  return {
    fetchLinearIssues: fetchIssues,
  };
};