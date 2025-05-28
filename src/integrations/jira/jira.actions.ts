import { ActionContext, FunctionFactory, FunctionDefinition } from '../actions/types'; // Added FunctionDefinition
import { 
  createJiraTicket, 
  fetchJiraTickets, 
  getJiraTicketById,
  addCommentToJiraTicket,
  updateJiraTicket,
  addTicketToCurrentSprint as addTicketToCurrentSprintService
} from './jira.service';

// Argument types for JIRA actions
interface CreateTicketArgs {
  summary: string;
  description: string;
  projectKey: string;
  issueType?: string; // Default handled in service
}

interface FetchTicketsArgs {
  projectKey: string;
  maxResults?: number; // Default handled in service
}

interface GetTicketArgs {
  issueIdOrKey: string;
}

interface AddCommentArgs {
  issueIdOrKey: string;
  commentBody: string;
}

interface UpdateTicketArgs {
  issueIdOrKey: string;
  fields?: Record<string, any>;
}

interface AddTicketToCurrentSprintArgs {
  boardId: string;
  issueKey: string;
}

const projectKeyParamDefinition = {
  type: 'string' as const, // Use 'as const' for literal type
  description: 'JIRA project key (e.g., "PROJ"). This is essential for targeting the correct project.'
};

export const createJiraActions = (context: ActionContext): FunctionFactory => ({
  createTicket: {
    description: 'Creates a new JIRA ticket',
    parameters: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: 'Title of the ticket' },
        description: { type: 'string', description: 'Detailed description of the ticket' },
        projectKey: projectKeyParamDefinition,
        issueType: { type: 'string', description: 'Type of issue (e.g., Task, Bug)' } // Removed default: 'Task'
      },
      required: ['summary', 'description', 'projectKey'],
      additionalProperties: false,
    },
    function: async (params: CreateTicketArgs): Promise<any> => {
      return await createJiraTicket(context.sessionId, context.companyId, params);
    },
  },
  fetchTickets: {
    description: 'Fetches JIRA tickets from a project',
    parameters: {
      type: 'object',
      properties: {
        projectKey: projectKeyParamDefinition,
        maxResults: { type: 'number', description: 'Maximum number of tickets to fetch' } // Removed default: 50
      },
      required: ['projectKey'],
      additionalProperties: false,
    },
    function: async (params: FetchTicketsArgs): Promise<any> => {
      return await fetchJiraTickets(context.sessionId, context.companyId, params);
    },
  },
  getTicket: {
    description: 'Gets a specific JIRA ticket by ID or key',
    parameters: {
      type: 'object',
      properties: {
        issueIdOrKey: { type: 'string', description: 'ID or key of the JIRA ticket' }
      },
      required: ['issueIdOrKey'],
      additionalProperties: false,
    },
    function: async (params: GetTicketArgs): Promise<any> => {
      return await getJiraTicketById(context.sessionId, context.companyId, params);
    },
  },
  addComment: {
    description: 'Adds a comment to a specific JIRA ticket',
    parameters: {
      type: 'object',
      properties: {
        issueIdOrKey: { type: 'string', description: 'ID or key of the JIRA ticket' },
        commentBody: { type: 'string', description: 'The text content of the comment' }
      },
      required: ['issueIdOrKey', 'commentBody'],
      additionalProperties: false,
    },
    function: async (params: AddCommentArgs): Promise<any> => {
      return await addCommentToJiraTicket(context.sessionId, context.companyId, params);
    },
  },
  updateTicket: {
    description: 'Updates an existing JIRA ticket. Provide only the fields you want to change.',
    parameters: {
      type: 'object',
      properties: {
        issueIdOrKey: { type: 'string', description: 'ID or key of the JIRA ticket to update' },
        fields: { 
          type: 'object', 
          description: 'An object containing the fields to update. For example: {"summary": "New summary", "assignee": {"name": "user@example.com"}, "labels": ["new-label", "another-label"]}. Refer to JIRA API for updatable fields and their structure.'
        }
      },
      required: ['issueIdOrKey'], 
      additionalProperties: false,
    },
    function: async (params: UpdateTicketArgs): Promise<any> => {
      const serviceParams = {
        issueIdOrKey: params.issueIdOrKey,
        fields: params.fields ?? {} // Default to empty object if fields is undefined
      };
      return await updateJiraTicket(context.sessionId, context.companyId, serviceParams);
    },
  },
  addTicketToCurrentSprint: {
    description: 'Adds a JIRA ticket to the current active sprint on a specified board.',
    parameters: {
      type: 'object',
      properties: {
        boardId: { type: 'string', description: 'The ID of the JIRA board.' },
        issueKey: { type: 'string', description: 'The key of the JIRA ticket (e.g., "PROJ-123").' }
      },
      required: ['boardId', 'issueKey'],
      additionalProperties: false,
    },
    function: async (params: AddTicketToCurrentSprintArgs): Promise<any> => {
      return await addTicketToCurrentSprintService(context.sessionId, context.companyId, params);
    },
  },
});
