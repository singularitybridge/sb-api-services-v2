import { ActionContext, FunctionDefinition } from '../actions/types';
import * as linearService from './linear.service';

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

export const createLinearActions = (context: ActionContext) => {
  const fetchIssues: FunctionDefinition = {
    function: async ({ first = 50 }: { first?: number }) => {
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

  const createIssue: FunctionDefinition = {
    function: async ({ title, description, teamId }: CreateIssueArgs) => {
      const issue = await linearService.createIssue(context.companyId, title, description, teamId);
      return issue;
    },
    description: 'Create a new issue in Linear',
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
    },
  };

  const updateIssue: FunctionDefinition = {
    function: async ({ issueId, updateData }: UpdateIssueArgs) => {
      await linearService.updateIssue(context.companyId, issueId, updateData);
      return { success: true };
    },
    description: 'Update an existing issue in Linear',
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
    },
  };

  const deleteIssue: FunctionDefinition = {
    function: async ({ issueId }: { issueId: string }) => {
      await linearService.deleteIssue(context.companyId, issueId);
      return { success: true };
    },
    description: 'Delete an issue from Linear',
    parameters: {
      type: 'object',
      properties: {
        issueId: {
          type: 'string',
          description: 'ID of the issue to delete',
        },
      },
      required: ['issueId'],
    },
  };

  const fetchAllIssues: FunctionDefinition = {
    function: async () => {
      const issues = await linearService.fetchAllIssues(context.companyId);
      return issues;
    },
    description: 'Fetch all issues from Linear',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  };

  const fetchIssuesByUser: FunctionDefinition = {
    function: async ({ userId }: FetchIssuesByUserArgs) => {
      const issues = await linearService.fetchIssuesByUser(context.companyId, userId);
      return issues;
    },
    description: 'Fetch issues assigned to a specific user from Linear',
    parameters: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'ID of the user to fetch issues for',
        },
      },
      required: ['userId'],
    },
  };

  const fetchIssuesByDate: FunctionDefinition = {
    function: async ({ days }: FetchIssuesByDateArgs) => {
      const issues = await linearService.fetchIssuesByDate(context.companyId, days);
      return issues;
    },
    description: 'Fetch issues created or updated within a specific number of days',
    parameters: {
      type: 'object',
      properties: {
        days: {
          type: 'number',
          description: 'Number of days to look back',
        },
      },
      required: ['days'],
    },
  };

  const fetchUserList: FunctionDefinition = {
    function: async () => {
      const users = await linearService.fetchUserList(context.companyId);
      return users;
    },
    description: 'Fetch list of users from Linear',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  };

  const fetchTeams: FunctionDefinition = {
    function: async () => {
      const teams = await linearService.fetchTeams(context.companyId);
      return teams;
    },
    description: 'Fetch list of teams from Linear',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  };

  const fetchIssueStatuses: FunctionDefinition = {
    function: async () => {
      const statuses = await linearService.fetchIssueStatuses(context.companyId);
      return statuses;
    },
    description: 'Fetch issue statuses from Linear',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  };

  const createComment: FunctionDefinition = {
    function: async ({ issueId, body }: CreateCommentArgs) => {
      const comment = await linearService.createComment(context.companyId, issueId, body);
      return comment;
    },
    description: 'Create a new comment on a Linear issue',
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
    },
  };

  return {
    fetchIssues,
    createLinearIssue: createIssue,
    updateLinearIssue: updateIssue,
    deleteLinearIssue: deleteIssue,
    fetchAllLinearIssues: fetchAllIssues,
    fetchLinearIssuesByUser: fetchIssuesByUser,
    fetchLinearIssuesByDate: fetchIssuesByDate,
    fetchLinearUserList: fetchUserList,
    fetchLinearTeams: fetchTeams,
    fetchIssueStatuses,
    createLinearComment: createComment,
  };
};