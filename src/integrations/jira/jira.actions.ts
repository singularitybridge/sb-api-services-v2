import { ActionContext, FunctionFactory } from '../actions/types';
import { createJiraTicket, fetchJiraTickets, getJiraTicketById } from './jira.service';

export const createJiraActions = (context: ActionContext): FunctionFactory => ({
  createTicket: {
    description: 'Creates a new JIRA ticket',
    parameters: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: 'Title of the ticket' },
        description: { type: 'string', description: 'Detailed description of the ticket' },
        projectKey: { type: 'string', description: 'JIRA project key' },
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
        projectKey: { type: 'string', description: 'JIRA project key' },
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
});
