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
        description: markdownToAdf(params.description)
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
    fieldsToFetch?: string[]; // Added for specific fields
  }
) => {
  try {
    const client = await initializeClient(companyId);
    const maxResults = params.maxResults || 50;

    // Define default fields if not provided, including sprint (customfield_10020)
    const defaultFieldsToFetch = ['summary', 'status', 'description', 'customfield_10020'];
    let fieldsToRequest = (params.fieldsToFetch && params.fieldsToFetch.length > 0)
      ? params.fieldsToFetch
      : defaultFieldsToFetch;

    // Ensure essential base fields for processing are included if custom fields are requested
    // This is important if the user specifies fields but omits 'description' or 'status'
    // which are needed for simplified output.
    if (params.fieldsToFetch && params.fieldsToFetch.length > 0) {
        if (!fieldsToRequest.includes('description')) fieldsToRequest.push('description');
        if (!fieldsToRequest.includes('status')) fieldsToRequest.push('status');
        // customfield_10020 for sprint info might be explicitly requested or part of default
    }


    let startAt = 0;
    let allSimplifiedTickets: any[] = []; // Correctly define allSimplifiedTickets
    
    while (true) {
      const response = await client.issueSearch.searchForIssuesUsingJql({
        jql: `project = ${params.projectKey}`,
        fields: fieldsToRequest, // Use the determined fieldsToRequest
        startAt,
        maxResults,
      });
      
      const issues = response.issues || [];
      if (!issues.length) {
        break;
      }
      
      const simplifiedIssues = issues.map(issue => {
        const descriptionText = issue.fields?.description ? adfToText(issue.fields.description) : undefined;
        let sprintInfo: any = null;
        if (issue.fields?.customfield_10020 && Array.isArray(issue.fields.customfield_10020) && issue.fields.customfield_10020.length > 0) {
          sprintInfo = issue.fields.customfield_10020.map((sprint: any) => ({
            id: sprint.id,
            name: sprint.name,
            state: sprint.state,
            boardId: sprint.boardId,
            goal: sprint.goal,
            startDate: sprint.startDate,
            endDate: sprint.endDate,
          }));
        } else if (issue.fields?.customfield_10020) {
            sprintInfo = {
                id: issue.fields.customfield_10020.id,
                name: issue.fields.customfield_10020.name,
                state: issue.fields.customfield_10020.state,
                boardId: issue.fields.customfield_10020.boardId,
            };
        }

        const curatedFields: Record<string, any> = {};
        // Iterate over the fields that were actually requested for the JQL query
        fieldsToRequest.forEach((fieldName: string) => { // Explicitly type fieldName
          if (issue.fields && issue.fields.hasOwnProperty(fieldName)) {
            if (fieldName === 'description') {
              curatedFields.descriptionText = descriptionText; // Always use the text version
            } else if (fieldName === 'status' && issue.fields.status?.name) {
              curatedFields.status = issue.fields.status.name; // Simplified status
            } else if (fieldName === 'customfield_10020') {
              curatedFields.sprintInfo = sprintInfo; // Simplified sprint info
            } else {
              curatedFields[fieldName] = issue.fields[fieldName]; // Other fields as-is
            }
          }
        });
        
        // Return the simplified ticket structure directly
        return {
          key: issue.key,
          summary: curatedFields.summary || issue.fields?.summary, // Prefer curated summary if available
          status: curatedFields.status,    // Already simplified status name
          sprintInfo: curatedFields.sprintInfo // Already processed sprintInfo
        };
      });

      allSimplifiedTickets = allSimplifiedTickets.concat(simplifiedIssues);
      startAt += maxResults;

      if (params.maxResults && allSimplifiedTickets.length >= params.maxResults) {
        allSimplifiedTickets = allSimplifiedTickets.slice(0, params.maxResults);
        break;
      }
    }
    
    return { success: true, data: allSimplifiedTickets };
  } catch (error: any) {
    return { success: false, error: `Failed to fetch JIRA tickets: ${error?.message || 'Unknown error'}` };
  }
};

export const getJiraTicketById = async (
  sessionId: string,
  companyId: string,
  params: {
    issueIdOrKey: string;
    fieldsToFetch?: string[]; // Optional parameter for specific fields
  }
) => {
  try {
    const client = await initializeClient(companyId);

    let fieldsParameter: string[];
    if (params.fieldsToFetch && params.fieldsToFetch.length > 0) {
      // If specific fields are requested (e.g., ['*all'] or ['summary', 'status'])
      fieldsParameter = params.fieldsToFetch;
    } else {
      // Default to a curated list of essential fields
      fieldsParameter = [
        'summary',
        'status',
        'issuetype',
        'assignee',
        'reporter',
        'priority',
        'created',
        'updated',
        'description', // Still needed for descriptionText
        'labels',
        'project',
        'resolution',
        'duedate',
        // Add other commonly needed fields here
      ];
    }

    const issue = await client.issues.getIssue({
      issueIdOrKey: params.issueIdOrKey,
      fields: fieldsParameter,
      // expand: '', // Keep expand minimal unless specifically requested
    });

    // Convert ADF description to plain text if description was fetched
    const descriptionText = issue.fields?.description ? adfToText(issue.fields.description) : undefined;

    // If '*all' was requested, return the full structure as before, plus descriptionText
    if (fieldsParameter.includes('*all')) {
       const responseData = {
        ...issue, 
        fields: {
          ...issue.fields,
          descriptionText, 
        },
      };
      return { success: true, data: responseData };
    } else {
      // Construct a curated response object based on specifically requested or default fields
      const curatedIssueData: Record<string, any> = {
        id: issue.id,
        key: issue.key,
        self: issue.self,
        fields: {},
      };

      if (issue.fields) {
        const isDefaultFieldRequest = !params.fieldsToFetch || params.fieldsToFetch.length === 0;

        for (const fieldName of fieldsParameter) {
          if (issue.fields.hasOwnProperty(fieldName)) {
            let fieldValue = issue.fields[fieldName];
            // Simplify common nested objects for default requests
            if (isDefaultFieldRequest) {
              if (fieldName === 'status' && fieldValue?.name) fieldValue = fieldValue.name;
              else if (fieldName === 'issuetype' && fieldValue?.name) fieldValue = fieldValue.name;
              else if (fieldName === 'assignee' && fieldValue?.displayName) fieldValue = fieldValue.displayName;
              else if (fieldName === 'reporter' && fieldValue?.displayName) fieldValue = fieldValue.displayName;
              else if (fieldName === 'priority' && fieldValue?.name) fieldValue = fieldValue.name;
              else if (fieldName === 'project' && fieldValue?.name) fieldValue = { key: fieldValue.key, name: fieldValue.name }; // Keep key and name for project
              // For labels, if it's an array of strings, it's already simple. If it's an array of objects, simplify.
              else if (fieldName === 'labels' && Array.isArray(fieldValue) && fieldValue.length > 0 && typeof fieldValue[0] === 'object') {
                fieldValue = fieldValue.map((label: any) => (typeof label === 'object' ? label.name || label : label));
              }
            }
            curatedIssueData.fields[fieldName] = fieldValue;
          }
        }
        
        if (fieldsParameter.includes('description') && descriptionText !== undefined) {
          curatedIssueData.fields.descriptionText = descriptionText;
          // If it's a default request, we might not want the full ADF description object
          // unless 'description' was specifically requested in a non-default scenario.
          // The current logic includes 'description' in defaultFields, so ADF will be there.
          // If we want to remove ADF for default, we'd adjust defaultFields or the logic here.
          if (isDefaultFieldRequest && curatedIssueData.fields.description && curatedIssueData.fields.descriptionText) {
             // For default view, prioritize descriptionText and remove the verbose ADF object
             delete curatedIssueData.fields.description;
          } else if (issue.fields.description) { // Ensure original ADF is present if requested and available
             curatedIssueData.fields.description = issue.fields.description;
          }
        }
      }
      return { success: true, data: curatedIssueData };
    }
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
      comment: markdownToAdf(params.commentBody) // Reverted to 'comment' key as per jira.js type expectation
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
    
    const fieldsToUpdate = { ...params.fields };

    // If description is being updated, convert it from Markdown to ADF
    if (fieldsToUpdate.description && typeof fieldsToUpdate.description === 'string') {
      fieldsToUpdate.description = markdownToAdf(fieldsToUpdate.description);
    }

    // The jira.js library expects no response for editIssue, so we don't assign it.
    // A successful call implies the update worked.
    await client.issues.editIssue({
      issueIdOrKey: params.issueIdOrKey,
      fields: fieldsToUpdate // Use the potentially modified fieldsToUpdate
    });
    // Return a concise success message instead of the full ticket to avoid Pusher payload limits
    return { 
      success: true, 
      data: { 
        id: params.issueIdOrKey, 
        message: `Ticket ${params.issueIdOrKey} updated successfully.` 
      } 
    };
  } catch (error: any) {
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

export const getSprintsForBoard = async (
  sessionId: string,
  companyId: string,
  params: {
    boardId: string;
    state?: string; // e.g., "active", "future", "closed", "active,future"
    startAt?: number;
    maxResults?: number;
  }
) => {
  try {
    const client = await initializeClient(companyId);
    const boardIdNumber = parseInt(params.boardId, 10);
    if (isNaN(boardIdNumber)) {
      return { success: false, error: 'Invalid boardId. It must be a number.' };
    }

    const requestParams: any = {
      startAt: params.startAt || 0,
      maxResults: params.maxResults || 50,
      state: params.state || 'active,future', // Default to active and future sprints
    };

    const sprintsResponse: any = await new Promise((resolve, reject) => {
      client.sendRequest(
        {
          method: 'GET',
          url: `/rest/agile/1.0/board/${boardIdNumber}/sprint`,
          params: requestParams,
        },
        (error: any, data: any) => {
          if (error) {
            const jiraError = error?.error || error;
            let message = `Failed to get sprints for board ${boardIdNumber}.`;
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

    if (!sprintsResponse || !Array.isArray(sprintsResponse.values)) {
      return { success: false, error: `Error fetching sprints for board ID ${params.boardId}. Unexpected response format.` };
    }
    
    const sprints = sprintsResponse.values.map((sprint: any) => ({
      id: sprint.id,
      name: sprint.name,
      state: sprint.state,
      boardId: sprint.originBoardId, // Use originBoardId
      goal: sprint.goal,
      startDate: sprint.startDate,
      endDate: sprint.endDate,
      completeDate: sprint.completeDate, // Include completeDate if available
    }));

    return { 
      success: true, 
      data: {
        sprints: sprints,
        maxResults: sprintsResponse.maxResults,
        startAt: sprintsResponse.startAt,
        isLast: sprintsResponse.isLast, // Useful for pagination
        total: sprintsResponse.total // If available in response, else undefined
      }
    };
  } catch (error: any) {
    const errorMessage = error.message || (error.errorMessages && error.errorMessages.join(', ')) || `Unknown error fetching sprints for board ${params.boardId}`;
    return { success: false, error: errorMessage };
  }
};

export const getActiveSprintForBoard = async (
  sessionId: string,
  companyId: string,
  params: {
    boardId: string;
  }
) => {
  try {
    const client = await initializeClient(companyId);
    const boardIdNumber = parseInt(params.boardId, 10);
    if (isNaN(boardIdNumber)) {
      return { success: false, error: 'Invalid boardId. It must be a number.' };
    }

    const activeSprintsResponse: any = await new Promise((resolve, reject) => {
      client.sendRequest(
        {
          method: 'GET',
          url: `/rest/agile/1.0/board/${boardIdNumber}/sprint?state=active`,
        },
        (error: any, data: any) => {
          if (error) {
            const jiraError = error?.error || error;
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
      return { success: false, error: `No active sprint found for board ID ${params.boardId}.` };
    }

    const activeSprint = activeSprintsResponse.values[0];
    // Use originBoardId as returned by the Jira API for sprints fetched via board
    if (!activeSprint.id || !activeSprint.name || !activeSprint.state || activeSprint.originBoardId === undefined) {
      return { success: false, error: `Active sprint data is incomplete. Sprint data: ${JSON.stringify(activeSprint)}` };
    }

    return { 
      success: true, 
      data: {
        id: activeSprint.id,
        name: activeSprint.name,
        state: activeSprint.state,
        boardId: activeSprint.originBoardId, // Changed to originBoardId
        goal: activeSprint.goal, // goal can be null or empty
        startDate: activeSprint.startDate,
        endDate: activeSprint.endDate,
      } 
    };
  } catch (error: any) {
    const errorMessage = error.message || (error.errorMessages && error.errorMessages.join(', ')) || 'Unknown error fetching active sprint';
    return { success: false, error: `Failed to get active sprint for board ${params.boardId}: ${errorMessage}` };
  }
};

export const getIssuesForSprint = async (
  sessionId: string,
  companyId: string,
  params: {
    sprintId: string;
    projectKey?: string; 
    maxResults?: number;
    startAt?: number;
    fieldsToFetch?: string[];
  }
) => {
  try {
    const client = await initializeClient(companyId);
    const sprintIdNumber = parseInt(params.sprintId, 10);
    if (isNaN(sprintIdNumber)) {
      return { success: false, error: 'Invalid sprintId. It must be a number.' };
    }

    const maxResults = params.maxResults || 50;
    const startAt = params.startAt || 0;
    
    const defaultFieldsToFetch = ['summary', 'status', 'description', 'assignee', 'issuetype', 'priority'];
    let fieldsToRequest = (params.fieldsToFetch && params.fieldsToFetch.length > 0)
      ? params.fieldsToFetch
      : defaultFieldsToFetch;

    if (params.fieldsToFetch && params.fieldsToFetch.length > 0) {
        if (!fieldsToRequest.includes('description')) fieldsToRequest.push('description');
        if (!fieldsToRequest.includes('status')) fieldsToRequest.push('status');
    }
    
    const response: any = await new Promise((resolve, reject) => {
      client.sendRequest(
        {
          method: 'GET',
          url: `/rest/agile/1.0/sprint/${sprintIdNumber}/issue`,
          params: { 
            startAt: startAt,
            maxResults: maxResults,
            fields: fieldsToRequest.join(','),
          },
        },
        (error: any, data: any) => {
          if (error) {
            const jiraError = error?.error || error;
            let message = `Failed to get issues for sprint ${sprintIdNumber}.`;
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

    const issues = response.issues || [];
    if (!issues.length && response.total === 0) {
        return { success: true, data: [], message: `No issues found for sprint ID ${params.sprintId}.` };
    }
    
    const simplifiedIssues = issues.map((issue: any) => {
      const descriptionText = issue.fields?.description ? adfToText(issue.fields.description) : undefined;
      
      const curatedFields: Record<string, any> = {};
      fieldsToRequest.forEach((fieldName: string) => {
        if (issue.fields && issue.fields.hasOwnProperty(fieldName)) {
          if (fieldName === 'description') {
            curatedFields.descriptionText = descriptionText;
          } else if (fieldName === 'status' && issue.fields.status?.name) {
            curatedFields.status = issue.fields.status.name;
          } else if (fieldName === 'assignee' && issue.fields.assignee?.displayName) {
            curatedFields.assignee = issue.fields.assignee.displayName;
             curatedFields.assigneeAccountId = issue.fields.assignee.accountId;
          } else if (fieldName === 'issuetype' && issue.fields.issuetype?.name) {
            curatedFields.issuetype = issue.fields.issuetype.name;
          } else if (fieldName === 'priority' && issue.fields.priority?.name) {
            curatedFields.priority = issue.fields.priority.name;
          }
           else {
            curatedFields[fieldName] = issue.fields[fieldName];
          }
        }
      });

      return {
        id: issue.id,
        key: issue.key,
        summary: issue.fields?.summary,
        ...curatedFields 
      };
    });

    return { 
        success: true, 
        data: simplifiedIssues, 
        total: response.total, 
        maxResults: response.maxResults,
        startAt: response.startAt 
    };

  } catch (error: any) {
    const errorMessage = error.message || (error.errorMessages && error.errorMessages.join(', ')) || 'Unknown error fetching issues for sprint';
    return { success: false, error: `Failed to get issues for sprint ${params.sprintId}: ${errorMessage}` };
  }
};

export const moveIssueToSprint = async (
  sessionId: string,
  companyId: string,
  params: {
    issueKey: string;
    targetSprintId: string;
  }
) => {
  try {
    const client = await initializeClient(companyId);
    const targetSprintIdNumber = parseInt(params.targetSprintId, 10);

    if (isNaN(targetSprintIdNumber)) {
      return { success: false, error: 'Invalid targetSprintId. It must be a number.' };
    }

    await new Promise<void>((resolve, reject) => {
      client.sendRequest(
        {
          method: 'POST',
          url: `/rest/agile/1.0/sprint/${targetSprintIdNumber}/issue`,
          data: {
            issues: [params.issueKey],
          },
        },
        (error: any, data: any) => {
          if (error) {
            const jiraError = error?.error || error;
            let message = `Failed to move issue ${params.issueKey} to sprint ${targetSprintIdNumber}.`;
            if (jiraError?.errorMessages && jiraError.errorMessages.length > 0) {
              message = jiraError.errorMessages.join(' ');
            } else if (jiraError?.errors && Object.keys(jiraError.errors).length > 0) {
              message = Object.values(jiraError.errors).join(' ');
            }
            else if (jiraError?.message) {
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

    // After successfully moving the issue, fetch the board details for the target sprint
    // to then fetch all sprints for that board.
    let boardIdToFetchSprints: number | undefined;
    try {
      const sprintDetailsResponse: any = await new Promise((resolve, reject) => {
        client.sendRequest(
          {
            method: 'GET',
            url: `/rest/agile/1.0/sprint/${targetSprintIdNumber}`,
          },
          (err: any, sprintData: any) => {
            if (err) {
              reject(new Error(`Failed to fetch details for target sprint ${targetSprintIdNumber}: ${err.message || JSON.stringify(err)}`));
            } else {
              resolve(sprintData);
            }
          }
        );
      });

      if (sprintDetailsResponse && sprintDetailsResponse.originBoardId) {
        boardIdToFetchSprints = sprintDetailsResponse.originBoardId;
      } else {
        // Fallback or error if boardId cannot be determined
        console.warn(`Could not determine boardId for sprint ${targetSprintIdNumber}. Sprint details: ${JSON.stringify(sprintDetailsResponse)}`);
        // Proceed without sprint list if boardId is missing, but log it.
        // Or, could return an error/partial success here.
        // For now, let's return success for the move, but data will be just a message.
         return { 
          success: true, 
          message: `Ticket ${params.issueKey} successfully moved to sprint ID ${targetSprintIdNumber}. Could not fetch updated sprint list as board ID was not found for the target sprint.`
        };
      }
    } catch (sprintFetchError: any) {
      console.error(`Error fetching target sprint details: ${sprintFetchError.message}`);
       return { 
        success: true, 
        message: `Ticket ${params.issueKey} successfully moved to sprint ID ${targetSprintIdNumber}. Error fetching updated sprint list: ${sprintFetchError.message}`
      };
    }

    if (boardIdToFetchSprints) {
      const sprintsDataResult = await getSprintsForBoard(sessionId, companyId, { boardId: boardIdToFetchSprints.toString() });
      if (sprintsDataResult.success) {
        return { 
          success: true, 
          message: `Ticket ${params.issueKey} successfully moved to sprint ID ${targetSprintIdNumber}.`,
          data: sprintsDataResult.data // This should match the user's expected output structure
        };
      } else {
        // If fetching sprints fails, still indicate the move was successful but sprints couldn't be fetched.
        return { 
          success: true, 
          message: `Ticket ${params.issueKey} successfully moved to sprint ID ${targetSprintIdNumber}. Failed to fetch updated sprint list: ${sprintsDataResult.error}`,
          data: null // Or some indicator that sprint list is unavailable
        };
      }
    } else {
      // This case should ideally be handled by the checks above, but as a fallback:
      return { 
        success: true, 
        message: `Ticket ${params.issueKey} successfully moved to sprint ID ${targetSprintIdNumber}, but could not retrieve updated sprint list.` 
      };
    }

  } catch (error: any) {
    const errorMessage = error.message || (error.errorMessages && error.errorMessages.join(', ')) || `Unknown error moving issue ${params.issueKey} to sprint ${params.targetSprintId}`;
    return { success: false, error: errorMessage };
  }
};

export const moveIssueToBacklog = async (
  sessionId: string,
  companyId: string,
  params: {
    issueKey: string;
    // boardId?: string; // Consider if board context is needed by API or for logic
  }
) => {
  try {
    const client = await initializeClient(companyId);

    // Use the Agile API to move issues to the backlog
    // POST /rest/agile/1.0/backlog/issue
    // Body: { "issues": ["ISSUE-KEY-1", "ISSUE-KEY-2"] }
    // This endpoint might also implicitly remove the issue from its current sprint.
    await new Promise<void>((resolve, reject) => {
      client.sendRequest(
        {
          method: 'POST',
          url: `/rest/agile/1.0/backlog/issue`,
          data: {
            issues: [params.issueKey],
          },
        },
        (error: any, data: any) => {
          if (error) {
            const jiraError = error?.error || error;
            let message = `Failed to move issue ${params.issueKey} to backlog.`;
            if (jiraError?.errorMessages && jiraError.errorMessages.length > 0) {
              message = jiraError.errorMessages.join(' ');
            } else if (jiraError?.errors && Object.keys(jiraError.errors).length > 0) {
              message = Object.values(jiraError.errors).join(' ');
            } else if (jiraError?.message) {
              message = jiraError.message;
            } else if (typeof jiraError === 'string') {
              message = jiraError;
            }
            reject(new Error(message));
          } else {
            // A 204 No Content is typical for successful POSTs.
            resolve();
          }
        }
      );
    });

    return { success: true, message: `Ticket ${params.issueKey} successfully moved to backlog.` };

  } catch (error: any) {
    const errorMessage = error.message || (error.errorMessages && error.errorMessages.join(', ')) || `Unknown error moving issue ${params.issueKey} to backlog`;
    return { success: false, error: errorMessage };
  }
};

export const getAvailableTransitions = async (
  sessionId: string,
  companyId: string,
  params: {
    issueIdOrKey: string;
  }
) => {
  try {
    const client = await initializeClient(companyId);
    
    // Use the jira.js client method to get transitions
    // GET /rest/api/2/issue/{issueIdOrKey}/transitions
    const transitionsResponse = await client.issues.getTransitions({
      issueIdOrKey: params.issueIdOrKey,
    });

    // The response typically includes an array of transition objects.
    // Each transition object has id, name, and a 'to' status object.
    // We can return this directly or simplify if needed. For now, return as is.
    if (!transitionsResponse || !transitionsResponse.transitions) {
      return { success: false, error: `No transitions found or error fetching transitions for issue ${params.issueIdOrKey}.` };
    }

    return { success: true, data: transitionsResponse.transitions };

  } catch (error: any) {
    const errorMessage = error.message || (error.errorMessages && error.errorMessages.join(', ')) || `Unknown error fetching transitions for issue ${params.issueIdOrKey}`;
    return { success: false, error: errorMessage };
  }
};

export const transitionIssue = async (
  sessionId: string,
  companyId: string,
  params: {
    issueIdOrKey: string;
    transitionId: string;
    comment?: string;
    fields?: Record<string, any>; // For fields like resolution
  }
) => {
  try {
    const client = await initializeClient(companyId);

    const payload: any = {
      transition: {
        id: params.transitionId,
      },
    };

    if (params.comment) {
      payload.update = {
        comment: [
          {
            add: markdownToAdf(params.comment),
          },
        ],
      };
    }

    if (params.fields) {
      payload.fields = params.fields;
      // Example: if resolution needs to be set:
      // params.fields = { resolution: { name: "Done" } }
    }
    
    // Use the jira.js client method to perform the transition
    // POST /rest/api/2/issue/{issueIdOrKey}/transitions
    await client.issues.doTransition({
      issueIdOrKey: params.issueIdOrKey,
      transition: payload.transition, // Pass only the transition part of the payload here
      fields: payload.fields, // Pass fields if any
      update: payload.update, // Pass update (for comment) if any
    });
    
    // Successful transition usually returns a 204 No Content.
    return { success: true, message: `Issue ${params.issueIdOrKey} successfully transitioned using transition ID ${params.transitionId}.` };

  } catch (error: any) {
    // Attempt to parse Jira's specific error messages if available
    let detailedError = '';
    if (error.response && error.response.data && error.response.data.errorMessages) {
      detailedError = error.response.data.errorMessages.join('; ');
    } else if (error.response && error.response.data && error.response.data.errors) {
      detailedError = Object.entries(error.response.data.errors)
        .map(([key, value]) => `${key}: ${value}`)
        .join('; ');
    }
    const errorMessage = detailedError || error.message || `Unknown error transitioning issue ${params.issueIdOrKey}`;
    return { success: false, error: `Failed to transition issue: ${errorMessage}` };
  }
};

// Cache for story points field ID
let storyPointsFieldIdCache: string | null = null;

const findStoryPointsFieldId = async (sessionId: string, companyId: string): Promise<string | null> => {
  if (storyPointsFieldIdCache) {
    return storyPointsFieldIdCache;
  }

  try {
    const fieldsResult = await getJiraTicketFields(sessionId, companyId);
    if (fieldsResult.success && Array.isArray(fieldsResult.data)) {
      // Common names for Story Points field. This list can be expanded.
      const commonStoryPointsFieldNames = ['Story Points', 'Story Point Estimate', 'Σ Story Points'];
      const storyPointField = fieldsResult.data.find(field => 
        commonStoryPointsFieldNames.some(name => field.name?.toLowerCase() === name.toLowerCase()) &&
        (field.schema?.type === 'number' || field.schema?.custom === 'com.atlassian.jira.plugin.system.customfieldtypes:float') // Check schema type
      );
      
      if (storyPointField && storyPointField.id) {
        storyPointsFieldIdCache = storyPointField.id;
        return storyPointField.id;
      }
    }
    return null;
  } catch (error) {
    console.error('Error finding story points field ID:', error);
    return null;
  }
};

export const setStoryPoints = async (
  sessionId: string,
  companyId: string,
  params: {
    issueIdOrKey: string;
    storyPoints: number | null; // Allow null to clear story points
  }
) => {
  try {
    const storyPointsFieldId = await findStoryPointsFieldId(sessionId, companyId);

    if (!storyPointsFieldId) {
      return { 
        success: false, 
        error: 'Could not automatically determine the Story Points field ID. Please ensure it is configured or check field names.' 
      };
    }

    const fieldsToUpdate = {
      [storyPointsFieldId]: params.storyPoints,
    };

    // Call the generic updateJiraTicket function
    return await updateJiraTicket(sessionId, companyId, {
      issueIdOrKey: params.issueIdOrKey,
      fields: fieldsToUpdate,
    });

  } catch (error: any) {
    const errorMessage = error.message || `Unknown error setting story points for issue ${params.issueIdOrKey}`;
    return { success: false, error: `Failed to set story points: ${errorMessage}` };
  }
};


// Helper function to convert Atlassian Document Format (ADF) to plain text
const adfToText = (adfNode: any): string => {
  if (!adfNode) {
    return '';
  }

  let resultText = '';

  function processNode(node: any) {
    if (!node) return;

    switch (node.type) {
      case 'text':
        resultText += node.text || '';
        break;
      case 'paragraph':
        if (node.content) {
          node.content.forEach(processNode);
        }
        resultText += '\n'; // Add a newline after each paragraph
        break;
      case 'heading':
        if (node.content) {
          node.content.forEach(processNode);
        }
        resultText += '\n';
        break;
      case 'bulletList':
      case 'orderedList':
        if (node.content) {
          node.content.forEach((listItem: any, index: number) => {
            if (node.type === 'orderedList') {
              resultText += `${index + 1}. `;
            } else {
              resultText += '- ';
            }
            if (listItem.content) {
              listItem.content.forEach(processNode); // listItem usually contains paragraphs
            }
            // processNode already adds a newline for paragraphs within list items
          });
        }
        break;
      case 'listItem': // Should be handled by bulletList/orderedList, but good to have
        if (node.content) {
          node.content.forEach(processNode);
        }
        break;
      case 'codeBlock':
        if (node.content) {
          node.content.forEach((textNode: any) => {
            if (textNode.type === 'text') {
              resultText += textNode.text + '\n';
            }
          });
        }
        break;
      case 'blockquote':
        if (node.content) {
          node.content.forEach((pNode: any) => { // blockquote usually contains paragraphs
            resultText += '> ';
            processNode(pNode); // processNode will add newline for paragraph
          });
        }
        break;
      case 'panel':
        if (node.content) {
          node.content.forEach(processNode);
        }
        resultText += '\n';
        break;
      case 'hardBreak':
        resultText += '\n';
        break;
      case 'mention':
        resultText += node.attrs?.text || '[mention]';
        break;
      case 'emoji':
        resultText += node.attrs?.shortName || '[emoji]';
        break;
      case 'inlineCard':
      case 'blockCard':
        resultText += node.attrs?.url || '[card link]';
        break;
      // Tables are complex, basic text extraction for now
      case 'table':
        if (node.content) {
          node.content.forEach((row: any) => { // tableRow
            if (row.content) {
              row.content.forEach((cell: any) => { // tableCell
                if (cell.content) cell.content.forEach(processNode);
                resultText += '\t'; // Tab between cells
              });
              resultText += '\n'; // Newline after row
            }
          });
        }
        break;
      default:
        if (node.content && Array.isArray(node.content)) {
          node.content.forEach(processNode);
        }
        break;
    }
  }

  if (adfNode.type === 'doc' && adfNode.content) {
    adfNode.content.forEach(processNode);
  } else {
    // If it's not a full doc, try processing it directly (e.g. if a single node is passed)
    processNode(adfNode);
  }
  
  // Clean up multiple newlines
  return resultText.replace(/\n\s*\n/g, '\n').trim();
};

// Helper function to convert Markdown to Atlassian Document Format (ADF)
export const markdownToAdf = (markdown: string): any => {
  if (!markdown || typeof markdown !== 'string') {
    return {
      type: 'doc',
      version: 1,
      content: [],
    };
  }

  const adfContent: any[] = [];
  const lines = markdown.split('\n');

  let inList = false;
  let listType: 'bulletList' | 'orderedList' | null = null;
  let listItems: any[] = [];
  let inCodeBlock = false;
  let codeBlockContent = '';

  const processInlineFormatting = (text: string): any[] => {
    const inlineElements: any[] = [];
    let remainingText = text;

    // Regex for bold, italic, and bold+italic
    // Order matters: bold+italic, then bold, then italic
    const formattingRules = [
      { type: 'strong', regex: /\*\*\*([^\*]+)\*\*\*/g, markType: 'strong', innerMarkType: 'em' }, // ***bolditalic***
      { type: 'strong', regex: /\*\*([^\*]+)\*\*/g, markType: 'strong' }, // **bold**
      { type: '__', regex: /__([^_]+)__/g, markType: 'strong' }, // __bold__
      { type: 'em', regex: /\*([^\*]+)\*/g, markType: 'em' }, // *italic*
      { type: '_', regex: /_([^_]+)_/g, markType: 'em' }, // _italic_
    ];
    
    // Simplified inline processing: iterate and segment text
    // This is a basic approach and might not handle complex nesting perfectly
    // A more robust parser would build an AST.

    let lastIndex = 0;
    // Placeholder for a more sophisticated inline parser
    // For now, we'll just handle simple cases or pass text through.
    // A full markdown inline parser is complex.
    // This basic version will look for the first match of any rule.

    // For simplicity in this step, we'll just create a text node.
    // A proper implementation would parse inline elements.
    if (text.trim().length > 0) {
        // Basic bold and italic handling (non-nested)
        let currentText = text;
        const segments: any[] = [];
        
        // Process bold and italic (simple, non-nested)
        // This is a very simplified inline parser.
        // It splits by ** and * and then reassembles.
        
        // Split by bold markers first
        const boldParts = currentText.split(/\*\*|__/);
        boldParts.forEach((part, i) => {
            if (i % 2 === 1) { // This part was between **...** or __...__
                segments.push({ type: 'text', text: part, marks: [{ type: 'strong' }] });
            } else {
                // Split by italic markers
                const italicParts = part.split(/\*|_/);
                italicParts.forEach((italicPart, j) => {
                    if (j % 2 === 1) { // This part was between *...* or _..._
                        segments.push({ type: 'text', text: italicPart, marks: [{ type: 'em' }] });
                    } else if (italicPart) {
                        segments.push({ type: 'text', text: italicPart });
                    }
                });
            }
        });
        
        // Filter out empty text nodes that might result from splitting
        return segments.filter(s => s.text && s.text.length > 0);

    }
    return [];
  };
  
  const flushList = () => {
    if (inList && listType && listItems.length > 0) {
      adfContent.push({
        type: listType,
        content: listItems,
      });
    }
    inList = false;
    listType = null;
    listItems = [];
  };

  const flushCodeBlock = () => {
    if (inCodeBlock && codeBlockContent.length > 0) {
      adfContent.push({
        type: 'codeBlock',
        content: [{ type: 'text', text: codeBlockContent.trimEnd() }], // Trim trailing newline
      });
    }
    inCodeBlock = false;
    codeBlockContent = '';
  };


  for (const line of lines) {
    // Code Blocks (```)
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        flushCodeBlock();
      } else {
        flushList(); // End any open list
        inCodeBlock = true;
        // language can be extracted here if needed: line.substring(3)
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent += line + '\n';
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.*)/);
    if (headingMatch) {
      flushList();
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      adfContent.push({
        type: 'heading',
        attrs: { level },
        content: processInlineFormatting(text),
      });
      continue;
    }

    // Unordered Lists
    const ulMatch = line.match(/^(\s*)([\-\*\+])\s+(.*)/);
    if (ulMatch) {
      if (!inList || listType !== 'bulletList') {
        flushList();
        inList = true;
        listType = 'bulletList';
      }
      listItems.push({
        type: 'listItem',
        content: [{ type: 'paragraph', content: processInlineFormatting(ulMatch[3]) }],
      });
      continue;
    }

    // Ordered Lists
    const olMatch = line.match(/^(\s*)(\d+)\.\s+(.*)/);
    if (olMatch) {
      if (!inList || listType !== 'orderedList') {
        flushList();
        inList = true;
        listType = 'orderedList';
      }
      listItems.push({
        type: 'listItem',
        content: [{ type: 'paragraph', content: processInlineFormatting(olMatch[3]) }],
      });
      continue;
    }
    
    // If it's not a list item, and we were in a list, flush it.
    if (inList && !ulMatch && !olMatch) {
        flushList();
    }

    // Paragraphs (or empty lines which might break paragraphs)
    if (line.trim() === '') {
      flushList(); // End list if an empty line is encountered
      // ADF doesn't typically represent multiple empty lines as separate paragraphs.
      // We can choose to add an empty paragraph or just let it be a break.
      // For simplicity, we'll treat consecutive empty lines as a single break.
      // If the last element was not a paragraph, this might start a new one.
      // Or, if ADF handles this naturally, we might not need special handling.
      // Let's assume for now that non-list, non-heading, non-codeblock lines become paragraphs.
    } else {
      flushList(); // Ensure list is flushed before a new paragraph
      adfContent.push({
        type: 'paragraph',
        content: processInlineFormatting(line),
      });
    }
  }

  flushList(); // Ensure any trailing list is flushed
  flushCodeBlock(); // Ensure any trailing code block is flushed
  
  // Filter out empty paragraphs that might have been created by inline processing returning empty
  const finalContent = adfContent.filter(node => !(node.type === 'paragraph' && (!node.content || node.content.length === 0)));

  return {
    type: 'doc',
    version: 1,
    content: finalContent.length > 0 ? finalContent : [{ type: 'paragraph', content: [] }], // Ensure content is never empty
  };
};


export const getJiraTicketFields = async (sessionId: string, companyId: string) => {
  try {
    const client = await initializeClient(companyId);
    // Corrected: getFields is typically under issueFields or a similar namespace
    const fields = await client.issueFields.getFields(); 
    return { success: true, data: fields };
  } catch (error: any) {
    return { success: false, error: `Failed to fetch JIRA fields: ${error?.message || 'Unknown error'}` };
  }
};

export const getJiraTicketComments = async (
  sessionId: string,
  companyId: string,
  params: {
    issueIdOrKey: string;
    startAt?: number;
    maxResults?: number;
    orderBy?: string; // e.g., '-created' for newest first
    expand?: string; // e.g., 'renderedBody'
  }
) => {
  try {
    const client = await initializeClient(companyId);
    const comments = await client.issueComments.getComments({
      issueIdOrKey: params.issueIdOrKey,
      startAt: params.startAt,
      maxResults: params.maxResults,
      orderBy: params.orderBy,
      expand: params.expand,
    });

    // Optionally, convert ADF in comment bodies to plain text
    if (comments.comments) {
      comments.comments.forEach(comment => {
        if (comment.body) {
          // @ts-ignore
          comment.bodyText = adfToText(comment.body);
        }
      });
    }
    return { success: true, data: comments };
  } catch (error: any) {
    return { success: false, error: `Failed to fetch JIRA ticket comments: ${error?.message || 'Unknown error'}` };
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
