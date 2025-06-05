import { Version3Client, Version3Models } from 'jira.js';
import { getApiKey, ApiKeyType } from '../../services/api.key.service';

let client: Version3Client | null = null;

const initializeClient = async (companyId: string) => {
  if (client) return client;

  const apiToken = await getApiKey(companyId, 'jira_api_token');
  const domain = await getApiKey(companyId, 'jira_domain');
  const email = await getApiKey(companyId, 'jira_email');

  if (!apiToken || !domain || !email) {
    throw new Error('Missing JIRA configuration. Please set JIRA_API_TOKEN, JIRA_DOMAIN, and JIRA_EMAIL.');
  }

  const host = domain.endsWith('.atlassian.net') ? `https://${domain}/` : `https://${domain}.atlassian.net/`;

  client = new Version3Client({
    host,
    authentication: {
      basic: {
        email,
        apiToken
      }
    }
  });

  return client;
};

export const createJiraTicket = async (
  sessionId: string,
  companyId: string,
  params: {
    summary: string;
    description: string;
    projectKey: string;
    issueType?: string;
  }
) => {
  try {
    const client = await initializeClient(companyId);

    const newIssue = await client.issues.createIssue({
      fields: {
        summary: params.summary,
        issuetype: {
          name: params.issueType || 'Task'
        },
        project: {
          key: params.projectKey
        },
        description: {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  text: params.description,
                  type: 'text'
                }
              ]
            }
          ]
        }
      }
    });

    return { success: true, data: newIssue };
  } catch (error: any) {
    return { success: false, error: `Failed to create JIRA ticket: ${error?.message || 'Unknown error'}` };
  }
};

export const fetchJiraTickets = async (
  sessionId: string,
  companyId: string,
  params: {
    projectKey: string;
    maxResults?: number;
  }
) => {
  try {
    const client = await initializeClient(companyId);
    const maxResults = params.maxResults || 50;

    let startAt = 0;
    let allTickets: Version3Models.Issue[] = [];
    
    while (true) {
      const response = await client.issueSearch.searchForIssuesUsingJql({
        startAt,
        maxResults,
        jql: `project = ${params.projectKey}`
      });
      
      const issues = response.issues || [];
      if (!issues.length) {
        break;
      }
      
      allTickets = allTickets.concat(issues);
      startAt += maxResults;

      // If we've reached the requested limit, stop
      if (params.maxResults && allTickets.length >= params.maxResults) {
        allTickets = allTickets.slice(0, params.maxResults);
        break;
      }
    }
    
    return { success: true, data: allTickets };
  } catch (error: any) {
    return { success: false, error: `Failed to fetch JIRA tickets: ${error?.message || 'Unknown error'}` };
  }
};

export const getJiraTicketById = async (
  sessionId: string,
  companyId: string,
  params: {
    issueIdOrKey: string;
  }
) => {
  try {
    const client = await initializeClient(companyId);

    const issue = await client.issues.getIssue({
      issueIdOrKey: params.issueIdOrKey
    });

    // Simplify the ticket data before returning
    const simplifiedIssue = {
      key: issue.key,
      summary: issue.fields?.summary,
      status: issue.fields?.status?.name,
      description: issue.fields?.description?.content?.[0]?.content?.[0]?.text, // Extract text from ADF
      assignee: issue.fields?.assignee?.displayName,
      reporter: issue.fields?.reporter?.displayName,
      created: issue.fields?.created,
      updated: issue.fields?.updated,
      // You can add other essential fields here if needed
      // For example, to include all fields for debugging or more complex scenarios:
      // rawFields: issue.fields 
    };
    
    return { success: true, data: simplifiedIssue };
  } catch (error: any) {
    return { success: false, error: `Failed to fetch JIRA ticket: ${error?.message || 'Unknown error'}` };
  }
};

export const addCommentToJiraTicket = async (
  sessionId: string,
  companyId: string,
  params: {
    issueIdOrKey: string;
    commentBody: string;
  }
) => {
  try {
    const client = await initializeClient(companyId);

    const comment = await client.issueComments.addComment({
      issueIdOrKey: params.issueIdOrKey,
      // Attempting to use 'comment' as the key for ADF instead of 'body'
      comment: { 
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [
              {
                text: params.commentBody,
                type: 'text'
              }
            ]
          }
        ]
      }
    });
    return { success: true, data: comment };
  } catch (error: any) {
    return { success: false, error: `Failed to add comment to JIRA ticket: ${error?.message || 'Unknown error'}` };
  }
};

export const updateJiraTicket = async (
  sessionId: string,
  companyId: string,
  params: {
    issueIdOrKey: string;
    fields: { [key: string]: any }; // Flexible fields for update
  }
) => {
  try {
    const client = await initializeClient(companyId);

    // The jira.js library expects no response for editIssue, so we don't assign it.
    // A successful call implies the update worked.
    console.log(`[DEBUG] jira.service.ts: updateJiraTicket called for ${params.issueIdOrKey} with fields:`, JSON.stringify(params.fields, null, 2)); // DEBUG
    await client.issues.editIssue({
      issueIdOrKey: params.issueIdOrKey,
      fields: params.fields
    });
    console.log(`[DEBUG] jira.service.ts: editIssue successful for ${params.issueIdOrKey}`); // DEBUG
    // Refetch the issue to return its updated state
    const updatedIssue = await client.issues.getIssue({
      issueIdOrKey: params.issueIdOrKey
    });
    console.log(`[DEBUG] jira.service.ts: Fetched updated issue ${params.issueIdOrKey}, assignee:`, updatedIssue.fields?.assignee?.displayName); // DEBUG
    return { success: true, data: updatedIssue };
  } catch (error: any) {
    console.error(`[DEBUG] jira.service.ts: Error in updateJiraTicket for ${params.issueIdOrKey}:`, error); // DEBUG
    return { success: false, error: `Failed to update JIRA ticket: ${error?.message || 'Unknown error'}` };
  }
};

export const addTicketToCurrentSprint = async (
  sessionId: string,
  companyId: string,
  params: {
    boardId: string; // Jira board ID is usually a number, but API might accept string
    issueKey: string;
  }
) => {
  try {
    const client = await initializeClient(companyId);

    // 1. Get active sprints for the board
    // jira.js expects boardId to be a number.
    const boardIdNumber = parseInt(params.boardId, 10);
    if (isNaN(boardIdNumber)) {
      return { success: false, error: 'Invalid boardId. It must be a number.' };
    }

    // 1. Get active sprints for the board using sendRequest, wrapped in a Promise
    const activeSprintsResponse: any = await new Promise((resolve, reject) => {
      client.sendRequest(
        {
          method: 'GET',
          url: `/rest/agile/1.0/board/${boardIdNumber}/sprint?state=active`,
        },
        (error: any, data: any) => {
          if (error) {
            // The error object from jira.js might be complex.
            // Try to extract a meaningful message.
            const jiraError = error?.error || error; // error.error might contain { errorMessages: [], errors: {} }
            let message = 'Failed to get active sprints.';
            if (jiraError?.errorMessages && jiraError.errorMessages.length > 0) {
              message = jiraError.errorMessages.join(' ');
            } else if (jiraError?.message) {
              message = jiraError.message;
            } else if (typeof jiraError === 'string') {
              message = jiraError;
            }
            reject(new Error(message));
          } else {
            resolve(data);
          }
        }
      );
    });

    if (!activeSprintsResponse || !activeSprintsResponse.values || activeSprintsResponse.values.length === 0) {
      return { success: false, error: `No active sprint found for board ID ${params.boardId}. Response: ${JSON.stringify(activeSprintsResponse)}` };
    }

    const activeSprint = activeSprintsResponse.values[0];
    if (!activeSprint.id || !activeSprint.name) {
      return { success: false, error: `Active sprint found but it does not have a valid ID or name. Sprint data: ${JSON.stringify(activeSprint)}` };
    }

    // 2. Add the issue to the active sprint using sendRequest, wrapped in a Promise
    await new Promise<void>((resolve, reject) => {
      client.sendRequest(
        {
          method: 'POST',
          url: `/rest/agile/1.0/sprint/${activeSprint.id}/issue`,
          data: {
            issues: [params.issueKey],
          },
        },
        (error: any, data: any) => { // Assuming POST might not return significant data on success
          if (error) {
            const jiraError = error?.error || error;
            let message = `Failed to add issue ${params.issueKey} to sprint ${activeSprint.id}.`;
            if (jiraError?.errorMessages && jiraError.errorMessages.length > 0) {
              message = jiraError.errorMessages.join(' ');
            } else if (jiraError?.message) {
              message = jiraError.message;
            } else if (typeof jiraError === 'string') {
              message = jiraError;
            }
            reject(new Error(message));
          } else {
            resolve();
          }
        }
      );
    });

    return { success: true, message: `Ticket ${params.issueKey} successfully added to sprint '${activeSprint.name}' (ID: ${activeSprint.id}).` };
  } catch (error: any) {
    // Check if the error is from Jira client or a generic one
    const errorMessage = error.message || (error.errorMessages && error.errorMessages.join(', ')) || 'Unknown error';
    return { success: false, error: `Failed to add ticket ${params.issueKey} to current sprint on board ${params.boardId}: ${errorMessage}` };
  }
};

export const searchJiraUsers = async (
  sessionId: string,
  companyId: string,
  params: {
    query?: string;
    startAt?: number;
    maxResults?: number;
    accountId?: string; // Added accountId for specific user search
  }
) => {
  try {
    const client = await initializeClient(companyId);
    const searchParams: any = { // Using 'any' for flexibility with jira.js types
      query: params.query || '',
      startAt: params.startAt || 0,
      maxResults: params.maxResults || 50,
    };
    // The jira.js library's findUsers method doesn't directly support searching by accountId in its primary params.
    // If a specific accountId is provided, and the query is empty, we might adjust the query or rely on JIRA's behavior.
    // For now, we'll pass the query as is. If accountId is the primary search, it should be part of the query string.
    // Alternatively, a different endpoint/method might be needed for direct accountId lookup if `findUsers` is insufficient.
    // For simplicity, we assume `query` can contain the accountId if needed, or JIRA's search is smart enough.

    const users: Version3Models.User[] = await client.userSearch.findUsers(searchParams);

    // Simplify user data before returning
    const simplifiedUsers = users.map(user => ({
      accountId: user.accountId,
      displayName: user.displayName,
      emailAddress: user.emailAddress, // Subject to JIRA privacy settings
      avatarUrls: user.avatarUrls,
      active: user.active,
    }));

    return { success: true, data: simplifiedUsers };
  } catch (error: any) {
    return { success: false, error: `Failed to search JIRA users: ${error?.message || 'Unknown error'}` };
  }
};

export const assignJiraTicket = async (
  sessionId: string,
  companyId: string,
  params: {
    issueIdOrKey: string;
    accountId: string | null; // accountId of the user to assign, or null to unassign
  }
) => {
  try {
    // We will use the existing updateJiraTicket function.
    // The JIRA API expects the assignee to be set via the 'fields' object.
    // If accountId is null, the ticket will be unassigned.
    const fieldsToUpdate = {
      assignee: params.accountId ? { accountId: params.accountId } : null,
    };

    // Call the generic updateJiraTicket function
    const result = await updateJiraTicket(sessionId, companyId, {
      issueIdOrKey: params.issueIdOrKey,
      fields: fieldsToUpdate,
    });

    // The updateJiraTicket function already returns { success: boolean, data?: any, error?: string }
    return result;
  } catch (error: any) {
    // This catch block might be redundant if updateJiraTicket handles its own errors,
    // but it's here for safety.
    return { success: false, error: `Failed to assign JIRA ticket: ${error?.message || 'Unknown error'}` };
  }
};
