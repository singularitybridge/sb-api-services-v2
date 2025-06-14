import { ActionContext, FunctionFactory, StandardActionResult } from '../actions/types';
import * as linearService from './linear.service';
import { executeAction, ExecuteActionOptions } from '../actions/executor';
import { ActionValidationError } from '../../utils/actionErrors';
import { Issue, IssuePayload, User, Team, WorkflowState, CommentPayload } from "@linear/sdk";

// Define input argument interfaces
interface FetchIssuesArgs { first?: number; }
interface CreateIssueArgs { title: string; description: string; teamId: string; }
interface UpdateIssueArgs { issueId: string; updateData: { title?: string; status?: string; description?: string; }; }
interface DeleteIssueArgs { issueId: string; }
interface FetchIssuesByUserArgs { userId: string; }
interface FetchIssuesByDateArgs { days: number; }
interface CreateCommentArgs { issueId: string; body: string; }

// Define R types for StandardActionResult<R>
interface MessageData { message: string; }

// Define S type (service call lambda's response) for executeAction
interface ServiceLambdaResponse<R_Payload = any> {
  success: boolean;
  data?: R_Payload;
  error?: string;
  description?: string;
}

const SERVICE_NAME = 'linearService';

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
    function: async (args: FetchIssuesArgs): Promise<StandardActionResult<Issue[]>> => {
      if (!context.companyId) throw new ActionValidationError('Company ID is missing.');
      const { first = 50 } = args;
      return executeAction<Issue[], ServiceLambdaResponse<Issue[]>>(
        'fetchIssues',
        async () => {
          const res = await linearService.fetchIssues(context.companyId!, first);
          // service returns { success: boolean; data?: Issue[]; error?: string }
          return { ...res, description: res.error }; 
        },
        { serviceName: SERVICE_NAME }
      );
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
    function: async (args: CreateIssueArgs): Promise<StandardActionResult<IssuePayload>> => {
      if (!context.companyId) throw new ActionValidationError('Company ID is missing.');
      const { title, description, teamId } = args;
      if (!title || !description || !teamId) throw new ActionValidationError('Title, description, and teamId are required.');
      return executeAction<IssuePayload, ServiceLambdaResponse<IssuePayload>>(
        'createLinearIssue',
        async () => {
          const res = await linearService.createIssue(context.companyId!, title, description, teamId);
          // service returns { success: boolean; data?: IssuePayload; error?: string }
          return { ...res, description: res.error }; 
        },
        { serviceName: SERVICE_NAME }
      );
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
            status: { // Note: service handles mapping status name to stateId
              type: 'string',
              description: 'New status of the issue (e.g., "Todo", "In Progress")',
            },
            description: { // Added to interface, ensure service supports it
                type: 'string',
                description: 'New description for the issue'
            }
          },
          description: 'Data to update in the issue',
        },
      },
      required: ['issueId', 'updateData'],
      additionalProperties: false,
    },
    function: async (args: UpdateIssueArgs): Promise<StandardActionResult<MessageData>> => {
      if (!context.companyId) throw new ActionValidationError('Company ID is missing.');
      const { issueId, updateData } = args;
      if (!issueId || !updateData) throw new ActionValidationError('issueId and updateData are required.');
      return executeAction<MessageData, ServiceLambdaResponse<MessageData>>(
        'updateLinearIssue',
        async () => {
          const res = await linearService.updateIssue(context.companyId!, issueId, updateData);
          // service returns { success: boolean; error?: string }
          return { ...res, description: res.error, data: res.success ? { message: 'Issue updated successfully' } : undefined };
        },
        { serviceName: SERVICE_NAME }
      );
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
    function: async (args: DeleteIssueArgs): Promise<StandardActionResult<MessageData>> => {
      if (!context.companyId) throw new ActionValidationError('Company ID is missing.');
      if (!args.issueId) throw new ActionValidationError('issueId is required.');
      return executeAction<MessageData, ServiceLambdaResponse<MessageData>>(
        'deleteLinearIssue',
        async () => {
          const res = await linearService.deleteIssue(context.companyId!, args.issueId);
          // service returns { success: boolean; error?: string }
          return { ...res, description: res.error, data: res.success ? { message: 'Issue deleted successfully' } : undefined };
        },
        { serviceName: SERVICE_NAME }
      );
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
    function: async (): Promise<StandardActionResult<Issue[]>> => {
      if (!context.companyId) throw new ActionValidationError('Company ID is missing.');
      return executeAction<Issue[], ServiceLambdaResponse<Issue[]>>(
        'fetchAllLinearIssues',
        async () => {
          const res = await linearService.fetchAllIssues(context.companyId!);
          return { ...res, description: res.error };
        },
        { serviceName: SERVICE_NAME }
      );
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
    function: async (args: FetchIssuesByUserArgs): Promise<StandardActionResult<Issue[]>> => {
      if (!context.companyId) throw new ActionValidationError('Company ID is missing.');
      if (!args.userId) throw new ActionValidationError('userId is required.');
      return executeAction<Issue[], ServiceLambdaResponse<Issue[]>>(
        'fetchLinearIssuesByUser',
        async () => {
          const res = await linearService.fetchIssuesByUser(context.companyId!, args.userId);
          return { ...res, description: res.error };
        },
        { serviceName: SERVICE_NAME }
      );
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
    function: async (args: FetchIssuesByDateArgs): Promise<StandardActionResult<Issue[]>> => {
      if (!context.companyId) throw new ActionValidationError('Company ID is missing.');
      if (args.days === undefined || typeof args.days !== 'number' || args.days <=0) throw new ActionValidationError('days parameter is required and must be a positive number.');
      return executeAction<Issue[], ServiceLambdaResponse<Issue[]>>(
        'fetchLinearIssuesByDate',
        async () => {
          const res = await linearService.fetchIssuesByDate(context.companyId!, args.days);
          return { ...res, description: res.error };
        },
        { serviceName: SERVICE_NAME }
      );
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
    function: async (): Promise<StandardActionResult<User[]>> => {
      if (!context.companyId) throw new ActionValidationError('Company ID is missing.');
      return executeAction<User[], ServiceLambdaResponse<User[]>>(
        'fetchLinearUserList',
        async () => {
          const res = await linearService.fetchUserList(context.companyId!);
          return { ...res, description: res.error };
        },
        { serviceName: SERVICE_NAME }
      );
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
    function: async (): Promise<StandardActionResult<Team[]>> => {
      if (!context.companyId) throw new ActionValidationError('Company ID is missing.');
      return executeAction<Team[], ServiceLambdaResponse<Team[]>>(
        'fetchLinearTeams',
        async () => {
          const res = await linearService.fetchTeams(context.companyId!);
          return { ...res, description: res.error };
        },
        { serviceName: SERVICE_NAME }
      );
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
    function: async (): Promise<StandardActionResult<WorkflowState[]>> => {
      if (!context.companyId) throw new ActionValidationError('Company ID is missing.');
      return executeAction<WorkflowState[], ServiceLambdaResponse<WorkflowState[]>>(
        'fetchIssueStatuses',
        async () => {
          const res = await linearService.fetchIssueStatuses(context.companyId!);
          return { ...res, description: res.error };
        },
        { serviceName: SERVICE_NAME }
      );
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
    function: async (args: CreateCommentArgs): Promise<StandardActionResult<CommentPayload>> => {
      if (!context.companyId) throw new ActionValidationError('Company ID is missing.');
      const { issueId, body } = args;
      if (!issueId || !body) throw new ActionValidationError('issueId and body are required.');
      return executeAction<CommentPayload, ServiceLambdaResponse<CommentPayload>>(
        'createLinearComment',
        async () => {
          const res = await linearService.createComment(context.companyId!, issueId, body);
          return { ...res, description: res.error };
        },
        { serviceName: SERVICE_NAME }
      );
    },
  },
});
