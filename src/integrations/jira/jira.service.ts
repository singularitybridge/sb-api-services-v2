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
  const client = await initializeClient(companyId);

  try {
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
    throw new Error(`Failed to create JIRA ticket: ${error?.message || 'Unknown error'}`);
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
  const client = await initializeClient(companyId);
  const maxResults = params.maxResults || 50;

  try {
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
    throw new Error(`Failed to fetch JIRA tickets: ${error?.message || 'Unknown error'}`);
  }
};

export const getJiraTicketById = async (
  sessionId: string,
  companyId: string,
  params: {
    issueIdOrKey: string;
  }
) => {
  const client = await initializeClient(companyId);

  try {
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
    throw new Error(`Failed to fetch JIRA ticket: ${error?.message || 'Unknown error'}`);
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
  const client = await initializeClient(companyId);

  try {
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
    throw new Error(`Failed to add comment to JIRA ticket: ${error?.message || 'Unknown error'}`);
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
  const client = await initializeClient(companyId);

  try {
    // The jira.js library expects no response for editIssue, so we don't assign it.
    // A successful call implies the update worked.
    await client.issues.editIssue({
      issueIdOrKey: params.issueIdOrKey,
      fields: params.fields
    });
    // Refetch the issue to return its updated state
    const updatedIssue = await client.issues.getIssue({
      issueIdOrKey: params.issueIdOrKey
    });
    return { success: true, data: updatedIssue };
  } catch (error: any) {
    throw new Error(`Failed to update JIRA ticket: ${error?.message || 'Unknown error'}`);
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
  const client = await initializeClient(companyId);

  try {
    // 1. Get active sprints for the board
    // jira.js expects boardId to be a number.
    const boardIdNumber = parseInt(params.boardId, 10);
    if (isNaN(boardIdNumber)) {
      throw new Error('Invalid boardId. It must be a number.');
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
      throw new Error(`No active sprint found for board ID ${params.boardId}. Response: ${JSON.stringify(activeSprintsResponse)}`);
    }

    const activeSprint = activeSprintsResponse.values[0];
    if (!activeSprint.id || !activeSprint.name) {
      throw new Error(`Active sprint found but it does not have a valid ID or name. Sprint data: ${JSON.stringify(activeSprint)}`);
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
    throw new Error(`Failed to add ticket ${params.issueKey} to current sprint on board ${params.boardId}: ${errorMessage}`);
  }
};
