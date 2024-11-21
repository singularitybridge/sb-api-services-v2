import { ActionContext, FunctionFactory } from '../actions/types';
import * as linearService from './linear.service';

interface FetchIssuesArgs {
  first?: number;
}

interface CreateIssueArgs {
  title: string;
  description: string;
  teamId: string;
}

interface UpdateIssueArgs {
  issueId: string;
  updateData: {
    title?: string;
    status?: string;
  };
}

interface DeleteIssueArgs {
  issueId: string;
}

interface FetchIssuesByUserArgs {
  userId: string;
}

interface FetchIssuesByDateArgs {
  days: number;
}

interface CreateCommentArgs {
  issueId: string;
  body: string;
}

export const createLinearActions = (context: ActionContext): FunctionFactory => ({
  fetchIssues: {
    description: 'Fetch issues from Linear',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        first: {
          type: 'number',
          description: 'Number of issues to fetch',
        },
      },
      required: [],
      additionalProperties: false,
    },
    function: async (args: FetchIssuesArgs) => {
      const { first = 50 } = args;

      try {
        const result = await linearService.fetchIssues(context.companyId, first);
        return {
          success: true,
          result: result.data,
        };
      } catch (error) {
        console.error('fetchIssues: Error fetching issues', error);
        return {
          success: false,
          error: 'Failed to fetch issues',
          message: 'An error occurred while fetching issues from Linear.',
        };
      }
    },
  },

  createLinearIssue: {
    description: 'Create a new issue in Linear',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Title of the issue',
        },
        description: {
          type: 'string',
          description: 'Description of the issue',
        },
        teamId: {
          type: 'string',
          description: 'ID of the team the issue belongs to',
        },
      },
      required: ['title', 'description', 'teamId'],
      additionalProperties: false,
    },
    function: async (args: CreateIssueArgs) => {
      const { title, description, teamId } = args;

      try {
        const result = await linearService.createIssue(context.companyId, title, description, teamId);
        return {
          success: true,
          result,
        };
      } catch (error) {
        console.error('createLinearIssue: Error creating issue', error);
        return {
          success: false,
          error: 'Failed to create issue',
          message: 'An error occurred while creating an issue in Linear.',
        };
      }
    },
  },

  updateLinearIssue: {
    description: 'Update an existing issue in Linear',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        issueId: {
          type: 'string',
          description: 'ID of the issue to update',
        },
        updateData: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: 'New title of the issue',
            },
            status: {
              type: 'string',
              description: 'New status of the issue',
            },
          },
          description: 'Data to update in the issue',
        },
      },
      required: ['issueId', 'updateData'],
      additionalProperties: false,
    },
    function: async (args: UpdateIssueArgs) => {
      const { issueId, updateData } = args;

      try {
        await linearService.updateIssue(context.companyId, issueId, updateData);
        return {
          success: true,
          result: { message: 'Issue updated successfully' },
        };
      } catch (error) {
        console.error('updateLinearIssue: Error updating issue', error);
        return {
          success: false,
          error: 'Failed to update issue',
          message: 'An error occurred while updating the issue in Linear.',
        };
      }
    },
  },

  deleteLinearIssue: {
    description: 'Delete an issue from Linear',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        issueId: {
          type: 'string',
          description: 'ID of the issue to delete',
        },
      },
      required: ['issueId'],
      additionalProperties: false,
    },
    function: async (args: DeleteIssueArgs) => {
      const { issueId } = args;

      try {
        await linearService.deleteIssue(context.companyId, issueId);
        return {
          success: true,
          result: { message: 'Issue deleted successfully' },
        };
      } catch (error) {
        console.error('deleteLinearIssue: Error deleting issue', error);
        return {
          success: false,
          error: 'Failed to delete issue',
          message: 'An error occurred while deleting the issue from Linear.',
        };
      }
    },
  },

  fetchAllLinearIssues: {
    description: 'Fetch all issues from Linear',
    strict: true,
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    function: async () => {
      try {
        const result = await linearService.fetchAllIssues(context.companyId);
        return {
          success: true,
          result: result.data,
        };
      } catch (error) {
        console.error('fetchAllLinearIssues: Error fetching all issues', error);
        return {
          success: false,
          error: 'Failed to fetch all issues',
          message: 'An error occurred while fetching all issues from Linear.',
        };
      }
    },
  },

  fetchLinearIssuesByUser: {
    description: 'Fetch issues assigned to a specific user from Linear',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'ID of the user to fetch issues for',
        },
      },
      required: ['userId'],
      additionalProperties: false,
    },
    function: async (args: FetchIssuesByUserArgs) => {
      const { userId } = args;

      try {
        const result = await linearService.fetchIssuesByUser(context.companyId, userId);
        return {
          success: true,
          result,
        };
      } catch (error) {
        console.error('fetchLinearIssuesByUser: Error fetching issues by user', error);
        return {
          success: false,
          error: 'Failed to fetch issues by user',
          message: 'An error occurred while fetching issues for the specified user from Linear.',
        };
      }
    },
  },

  fetchLinearIssuesByDate: {
    description: 'Fetch issues created or updated within a specific number of days',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        days: {
          type: 'number',
          description: 'Number of days to look back',
        },
      },
      required: ['days'],
      additionalProperties: false,
    },
    function: async (args: FetchIssuesByDateArgs) => {
      const { days } = args;

      try {
        const result = await linearService.fetchIssuesByDate(context.companyId, days);
        return {
          success: true,
          result,
        };
      } catch (error) {
        console.error('fetchLinearIssuesByDate: Error fetching issues by date', error);
        return {
          success: false,
          error: 'Failed to fetch issues by date',
          message: 'An error occurred while fetching issues within the specified date range from Linear.',
        };
      }
    },
  },

  fetchLinearUserList: {
    description: 'Fetch list of users from Linear',
    strict: true,
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    function: async () => {
      try {
        const result = await linearService.fetchUserList(context.companyId);
        return {
          success: true,
          result,
        };
      } catch (error) {
        console.error('fetchLinearUserList: Error fetching user list', error);
        return {
          success: false,
          error: 'Failed to fetch user list',
          message: 'An error occurred while fetching the list of users from Linear.',
        };
      }
    },
  },

  fetchLinearTeams: {
    description: 'Fetch list of teams from Linear',
    strict: true,
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    function: async () => {
      try {
        const result = await linearService.fetchTeams(context.companyId);
        return {
          success: true,
          result,
        };
      } catch (error) {
        console.error('fetchLinearTeams: Error fetching teams', error);
        return {
          success: false,
          error: 'Failed to fetch teams',
          message: 'An error occurred while fetching the list of teams from Linear.',
        };
      }
    },
  },

  fetchIssueStatuses: {
    description: 'Fetch issue statuses from Linear',
    strict: true,
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    function: async () => {
      try {
        const result = await linearService.fetchIssueStatuses(context.companyId);
        return {
          success: true,
          result,
        };
      } catch (error) {
        console.error('fetchIssueStatuses: Error fetching issue statuses', error);
        return {
          success: false,
          error: 'Failed to fetch issue statuses',
          message: 'An error occurred while fetching issue statuses from Linear.',
        };
      }
    },
  },

  createLinearComment: {
    description: 'Create a new comment on a Linear issue',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        issueId: {
          type: 'string',
          description: 'ID of the issue to comment on',
        },
        body: {
          type: 'string',
          description: 'Content of the comment',
        },
      },
      required: ['issueId', 'body'],
      additionalProperties: false,
    },
    function: async (args: CreateCommentArgs) => {
      const { issueId, body } = args;

      try {
        const result = await linearService.createComment(context.companyId, issueId, body);
        return {
          success: true,
          result,
        };
      } catch (error) {
        console.error('createLinearComment: Error creating comment', error);
        return {
          success: false,
          error: 'Failed to create comment',
          message: 'An error occurred while creating a comment on the Linear issue.',
        };
      }
    },
  },
});
