import { ActionContext, FunctionFactory } from '../actions/types';
import { 
  createJiraTicket, 
  fetchJiraTickets, 
  getJiraTicketById,
  addCommentToJiraTicket,
  updateJiraTicket,
  addTicketToCurrentSprint as addTicketToCurrentSprintService
} from './jira.service';

export const createJiraActions = (context: ActionContext): FunctionFactory => ({
  createTicket: {
    description: 'Creates a new JIRA ticket',
    parameters: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: 'Title of the ticket' },
        description: { type: 'string', description: 'Detailed description of the ticket' },
        projectKey: { type: 'string', description: 'JIRA project key (e.g., "PROJ"). This is essential for creating the ticket in the correct project.' },
        issueType: { type: 'string', description: 'Type of issue (e.g., Task, Bug)', default: 'Task' }
      },
      required: ['summary', 'description', 'projectKey'],
      additionalProperties: false,
    },
    function: async (params: any) => {
      return await createJiraTicket(context.sessionId, context.companyId, params);
    },
  },
  fetchTickets: {
    description: 'Fetches JIRA tickets from a project',
    parameters: {
      type: 'object',
      properties: {
        projectKey: { type: 'string', description: 'JIRA project key (e.g., "PROJ"). This is essential for fetching tickets from the correct project.' },
        maxResults: { type: 'number', description: 'Maximum number of tickets to fetch', default: 50 }
      },
      required: ['projectKey'],
      additionalProperties: false,
    },
    function: async (params: any) => {
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
    function: async (params: any) => {
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
    function: async (params: any) => {
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
          description: 'An object containing the fields to update. For example: {"summary": "New summary", "assignee": {"name": "user@example.com"}, "labels": ["new-label", "another-label"]}. Refer to JIRA API for updatable fields and their structure.',
          additionalProperties: true 
        }
      },
      required: ['issueIdOrKey', 'fields'],
      additionalProperties: false,
    },
    function: async (params: any) => {
      return await updateJiraTicket(context.sessionId, context.companyId, params);
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
    function: async (params: any) => {
      return await addTicketToCurrentSprintService(context.sessionId, context.companyId, params);
    },
  },
});
