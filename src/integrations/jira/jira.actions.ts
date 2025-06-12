import { ActionContext, FunctionFactory, FunctionDefinition } from '../actions/types'; // Added FunctionDefinition
import { 
  createJiraTicket, 
  fetchJiraTickets, 
  getJiraTicketById,
  getJiraTicketFields, // Added import for getJiraTicketFields
  getJiraTicketComments, // Added import for getJiraTicketComments
  addCommentToJiraTicket,
  updateJiraTicket,
  addTicketToCurrentSprint as addTicketToCurrentSprintService,
  searchJiraUsers, // Added import for searchJiraUsers
  assignJiraTicket // Added import for assignJiraTicket
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
  fields?: string[]; // Optional: Array of field names to fetch
}

interface GetTicketArgs {
  issueIdOrKey: string;
  fields?: string[]; // Optional: Array of field names to fetch, e.g., ["summary", "status", "*all"]
}

interface AddCommentArgs {
  issueIdOrKey: string;
  commentBody: string;
}

interface UpdateTicketArgs {
  issueIdOrKey: string;
  summary?: string;
  description?: string;
  assigneeAccountId?: string | null; // To allow unassigning by passing null
  labels?: string[];
}

interface AddTicketToCurrentSprintArgs {
  boardId: string;
  issueKey: string;
}

// New argument types for user search and assignment
interface SearchUsersArgs {
  query?: string;
  startAt?: number;
  maxResults?: number;
  accountId?: string;
}

interface AssignTicketArgs {
  issueIdOrKey: string;
  accountId: string | null; // Allow null for unassigning
}

interface GetTicketCommentsArgs {
  issueIdOrKey: string;
  startAt?: number;
  maxResults?: number;
  orderBy?: string;
  expand?: string;
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
        maxResults: { type: 'number', description: 'Maximum number of tickets to fetch' }, // Removed default: 50
        fields: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional: Array of field names to fetch (e.g., ["summary", "status"], or ["*all"] for all fields). Defaults to a curated set (id, key, summary, status, descriptionText, sprintInfo) if omitted.'
        }
      },
      required: ['projectKey'],
      additionalProperties: false,
    },
    function: async (params: FetchTicketsArgs): Promise<any> => {
      // Pass the fields parameter to the service function
      return await fetchJiraTickets(context.sessionId, context.companyId, {
        projectKey: params.projectKey,
        maxResults: params.maxResults,
        fieldsToFetch: params.fields // Pass the new optional fields
      });
    },
  },
  getTicket: {
    description: 'Gets a specific JIRA ticket by ID or key. Optionally specify which fields to retrieve.',
    parameters: {
      type: 'object',
      properties: {
        issueIdOrKey: { type: 'string', description: 'ID or key of the JIRA ticket.' },
        fields: { 
          type: 'array', 
          items: { type: 'string' },
          description: 'Optional: Array of field names to fetch (e.g., ["summary", "status"], or ["*all"] for all fields). Defaults to a curated set if omitted.' 
        }
      },
      required: ['issueIdOrKey'],
      additionalProperties: false,
    },
    function: async (params: GetTicketArgs): Promise<any> => {
      // Pass the fields parameter to the service function
      return await getJiraTicketById(context.sessionId, context.companyId, { 
        issueIdOrKey: params.issueIdOrKey, 
        fieldsToFetch: params.fields 
      });
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
        summary: { type: 'string', description: 'New summary for the ticket (optional)' },
        description: { type: 'string', description: 'New description for the ticket (optional)' },
        assigneeAccountId: {
          type: ['string', 'null'],
          description: 'The account ID of the user to assign the ticket to (optional). Pass null to unassign.'
        },
        labels: {
          type: 'array',
          items: { type: 'string' },
          description: 'New list of labels for the ticket (optional). This will overwrite existing labels if provided.'
        }
      },
      required: ['issueIdOrKey'],
      additionalProperties: false,
    },
    function: async (params: UpdateTicketArgs): Promise<any> => {
      const fieldsToUpdate: Record<string, any> = {};

      if (params.summary !== undefined) {
        fieldsToUpdate.summary = params.summary;
      }
      if (params.description !== undefined) {
        fieldsToUpdate.description = params.description;
      }
      if (params.assigneeAccountId !== undefined) {
        if (params.assigneeAccountId === null) {
          fieldsToUpdate.assignee = null; // For unassigning
        } else if (params.assigneeAccountId) { // Ensure it's a non-empty string
          fieldsToUpdate.assignee = { accountId: params.assigneeAccountId };
        }
        // If assigneeAccountId is an empty string, it's ignored here.
      }
      if (params.labels !== undefined) {
        fieldsToUpdate.labels = params.labels;
      }

      // It's possible fieldsToUpdate is empty if only issueIdOrKey was provided.
      // The JIRA API might error or do nothing. This is acceptable.
      // Alternatively, could add a check: if (Object.keys(fieldsToUpdate).length === 0) return { message: "No update fields provided." }

      const serviceParams = {
        issueIdOrKey: params.issueIdOrKey,
        fields: fieldsToUpdate
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
  searchUsers: {
    description: 'Searches for JIRA users by query (name, email) or account ID.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query for user name or email.' },
        startAt: { type: 'number', description: 'Starting index for pagination (default: 0).' },
        maxResults: { type: 'number', description: 'Maximum number of users to return (default: 50).' },
        accountId: { type: 'string', description: 'Specific JIRA user account ID to search for.' }
      },
      // `required` can be an empty array if no parameters are strictly required for a basic search
      required: [], 
      additionalProperties: false, // No other properties allowed
    },
    function: async (params: SearchUsersArgs): Promise<any> => {
      return await searchJiraUsers(context.sessionId, context.companyId, params);
    },
  },
  assignTicket: {
    description: 'Assigns a JIRA ticket to a specified user account ID, or unassigns it if accountId is null.',
    parameters: {
      type: 'object',
      properties: {
        issueIdOrKey: { type: 'string', description: 'ID or key of the JIRA ticket.' },
        accountId: { type: ['string', 'null'], description: 'JIRA user account ID to assign the ticket to. Pass null to unassign.' }
      },
      required: ['issueIdOrKey', 'accountId'], // accountId is required, even if null
      additionalProperties: false,
    },
    function: async (params: AssignTicketArgs): Promise<any> => {
      return await assignJiraTicket(context.sessionId, context.companyId, params);
    },
  },
  getTicketFields: {
    description: 'Gets all available fields in JIRA.',
    parameters: {
      type: 'object',
      properties: {}, // No parameters needed
      required: [], // Added empty required array
      additionalProperties: false,
    },
    function: async (): Promise<any> => { // No params expected for this action
      return await getJiraTicketFields(context.sessionId, context.companyId);
    },
  },
  getTicketComments: {
    description: 'Gets comments for a specific JIRA ticket.',
    parameters: {
      type: 'object',
      properties: {
        issueIdOrKey: { type: 'string', description: 'ID or key of the JIRA ticket.' },
        startAt: { type: 'number', description: 'Starting index for pagination (optional).' },
        maxResults: { type: 'number', description: 'Maximum number of comments to return (optional).' },
        orderBy: { type: 'string', description: 'Order of comments e.g., "-created" for newest first (optional).' },
        expand: { type: 'string', description: 'Fields to expand, e.g., "renderedBody" (optional).' }
      },
      required: ['issueIdOrKey'],
      additionalProperties: false,
    },
    function: async (params: GetTicketCommentsArgs): Promise<any> => {
      return await getJiraTicketComments(context.sessionId, context.companyId, params);
    },
  },
});
