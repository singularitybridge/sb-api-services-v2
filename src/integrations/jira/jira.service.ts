import { Version3Client, Version3Models } from 'jira.js';
import { getApiKey, ApiKeyType } from '../../services/api.key.service';

// --- BEGIN NEW TYPES ---
export interface Result<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string; // Optional: for non-error messages or additional context
}

export interface JiraBoard {
  id: number;
  self: string;
  name: string;
  type: string; // e.g., 'scrum', 'kanban'
  location?: {
    // Optional: If provided by API for project context
    projectId?: number;
    projectKey?: string;
    projectName?: string;
  };
}

export interface JiraSprint {
  id: number;
  self?: string;
  state: 'active' | 'future' | 'closed' | string; // Allow other states as string
  name: string;
  startDate?: string;
  endDate?: string;
  completeDate?: string;
  originBoardId?: number; // Typically the board this sprint belongs to
  goal?: string;
}
// --- END NEW TYPES ---

const client: Version3Client | null = null;
// --- BEGIN NEW CACHE VARIABLES ---
let sprintFieldIdCache: string | null = null;
// --- END NEW CACHE VARIABLES ---

const initializeClient = async (companyId: string): Promise<Version3Client> => {
  const apiToken = await getApiKey(companyId, 'jira_api_token');
  const domain = await getApiKey(companyId, 'jira_domain');
  const email = await getApiKey(companyId, 'jira_email');

  if (!apiToken || !domain || !email) {
    throw new Error(
      'Missing JIRA configuration. Please set JIRA_API_TOKEN, JIRA_DOMAIN, and JIRA_EMAIL.',
    );
  }

  const host = domain.endsWith('.atlassian.net')
    ? `https://${domain}/`
    : `https://${domain}.atlassian.net/`;

  const newClient = new Version3Client({
    host,
    authentication: {
      basic: {
        email,
        apiToken,
      },
    },
  });

  return newClient;
};

// --- BEGIN NEW SERVICE FUNCTIONS ---

export const getBoardsForProject = async (
  companyId: string,
  projectKey: string,
): Promise<Result<{ boards: JiraBoard[] }>> => {
  try {
    const jiraClient = await initializeClient(companyId);
    // Jira Agile API endpoint for getting all boards for a project
    // GET /rest/agile/1.0/board?projectKeyOrId={projectKeyOrId}
    // This endpoint supports pagination (startAt, maxResults), but for boards per project,
    // the number is usually small. We'll fetch up to a reasonable limit.
    const response: any = await new Promise((resolve, reject) => {
      jiraClient.sendRequest(
        {
          method: 'GET',
          url: `/rest/agile/1.0/board`,
          params: {
            projectKeyOrId: projectKey,
            maxResults: 50, // Fetch up to 50 boards, should be plenty for one project
          },
        },
        (error: any, data: any) => {
          if (error) {
            const jiraError = error?.error || error;
            let message = `Failed to get boards for project ${projectKey}.`;
            if (
              jiraError?.errorMessages &&
              jiraError.errorMessages.length > 0
            ) {
              message = jiraError.errorMessages.join(' ');
            } else if (jiraError?.message) {
              message = jiraError.message;
            }
            reject(new Error(message));
          } else {
            resolve(data);
          }
        },
      );
    });

    if (!response || !Array.isArray(response.values)) {
      return {
        success: false,
        error: `Error fetching boards for project ${projectKey}. Unexpected response format.`,
      };
    }

    const boards: JiraBoard[] = response.values.map((board: any) => ({
      id: board.id,
      self: board.self,
      name: board.name,
      type: board.type,
      location: board.location
        ? {
            // Map location if it exists
            projectId: board.location.projectId,
            projectKey: board.location.projectKey,
            projectName: board.location.projectName,
          }
        : undefined,
    }));

    return { success: true, data: { boards } };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to get boards for project ${projectKey}: ${
        error.message || 'Unknown error'
      }`,
    };
  }
};

export const resolveBoardForProject = async (
  companyId: string,
  projectKey: string,
): Promise<Result<{ board?: JiraBoard; ambiguousBoards?: JiraBoard[] }>> => {
  const boardsResult = await getBoardsForProject(companyId, projectKey);

  if (!boardsResult.success || !boardsResult.data) {
    return {
      success: false,
      error: boardsResult.error || 'Failed to retrieve boards for project.',
    };
  }

  const allBoards = boardsResult.data.boards;

  if (allBoards.length === 0) {
    return {
      success: false,
      error: `No agile boards found for project ${projectKey}.`,
    };
  }

  const scrumBoards = allBoards.filter(
    (b) => b.type?.toLowerCase() === 'scrum',
  );

  if (scrumBoards.length === 1) {
    return { success: true, data: { board: scrumBoards[0] } };
  }

  if (scrumBoards.length > 1) {
    return {
      success: true, // Still a success in terms of fetching, but ambiguous
      message: `Multiple Scrum boards found for project ${projectKey}.`,
      data: { ambiguousBoards: scrumBoards },
    };
  }

  // If no scrum boards, but other types of boards exist
  if (allBoards.length > 0) {
    if (allBoards.length === 1) {
      // If only one board exists and it's not scrum, return it but maybe with a note.
      return {
        success: true,
        data: { board: allBoards[0] },
        message: `Found one board of type '${allBoards[0].type}'. Using this board.`,
      };
    }
    // If multiple non-scrum boards exist
    return {
      success: true,
      message: `No Scrum boards found, but other types exist for project ${projectKey}.`,
      data: { ambiguousBoards: allBoards },
    };
  }

  // Should be covered by allBoards.length === 0, but as a fallback
  return {
    success: false,
    error: `Could not resolve a suitable board for project ${projectKey}.`,
  };
};

export const findSprintFieldId = async (
  companyId: string,
): Promise<Result<{ fieldId: string | null }>> => {
  if (sprintFieldIdCache) {
    return { success: true, data: { fieldId: sprintFieldIdCache } };
  }

  try {
    // Assuming getJiraTicketFields is already defined and exported in this file
    // It should use initializeClient(companyId)
    const fieldsResult = await getJiraTicketFieldsInternal(companyId); // Use an internal version or ensure getJiraTicketFields is suitable

    if (fieldsResult.success && Array.isArray(fieldsResult.data)) {
      const commonSprintFieldNames = ['Sprint', 'Target Sprint']; // Add more known names if necessary
      const sprintField = fieldsResult.data.find(
        (field: any) =>
          commonSprintFieldNames.some(
            (name) => field.name?.toLowerCase() === name.toLowerCase(),
          ) &&
          ((field.schema?.type === 'array' &&
            field.schema?.items === 'sprint') || // Standard Jira Cloud sprint field
            field.schema?.custom?.toLowerCase().includes('sprint') || // For some server versions or specific custom field types
            field.clauseNames?.includes('sprint')), // Another heuristic
      );

      if (sprintField && sprintField.id) {
        sprintFieldIdCache = sprintField.id;
        return { success: true, data: { fieldId: sprintField.id } };
      }
      // If not found, try the common default customfield_10020 as a fallback
      // This is less robust but can be a practical fallback.
      // However, relying on dynamic discovery is better.
      // For now, let's not hardcode a fallback here to encourage proper discovery.
      return {
        success: true,
        data: { fieldId: null },
        message: 'Sprint field ID not found by common names/schema.',
      };
    }
    return {
      success: false,
      error:
        fieldsResult.error ||
        'Failed to fetch Jira fields for sprint ID discovery.',
    };
  } catch (error: any) {
    console.error('Error finding sprint field ID:', error);
    return {
      success: false,
      error: `Error finding sprint field ID: ${error.message}`,
    };
  }
};

// Internal helper, assuming getJiraTicketFields is defined below and exported
// This is to avoid circular dependency issues if called from top-level.
const getJiraTicketFieldsInternal = async (
  companyId: string,
): Promise<Result<any[]>> => {
  try {
    const jiraClient = await initializeClient(companyId);
    const fields = await jiraClient.issueFields.getFields();
    return { success: true, data: fields };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to fetch JIRA fields: ${
        error?.message || 'Unknown error'
      }`,
    };
  }
};

export const getSprintsForResolvedBoard = async (
  companyId: string,
  board: JiraBoard,
  state?: string, // e.g., "active", "future", "closed", "active,future"
): Promise<Result<{ sprints: JiraSprint[]; rawResponse?: any }>> => {
  try {
    const jiraClient = await initializeClient(companyId);
    const boardIdNumber = board.id; // Already a number from JiraBoard type

    const requestParams: any = {
      state: state || 'active,future', // Default to active and future sprints
      // Add pagination params if needed, though getSprintsForBoard already handles this.
      // This function is a wrapper, so it might just pass through.
      // For simplicity, let's assume the underlying getSprintsForBoard handles pagination.
    };

    // Re-using the core logic of existing getSprintsForBoard by calling it
    // We need to ensure getSprintsForBoard is adapted or this function replicates its core API call
    // Let's replicate the core API call for clarity here:
    const sprintsResponse: any = await new Promise((resolve, reject) => {
      jiraClient.sendRequest(
        {
          method: 'GET',
          url: `/rest/agile/1.0/board/${boardIdNumber}/sprint`,
          params: {
            state: requestParams.state,
            startAt: 0, // Fetch all for this simplified version, or add pagination
            maxResults: 50, // Default limit
          },
        },
        (error: any, data: any) => {
          if (error) {
            const jiraError = error?.error || error;
            let message = `Failed to get sprints for board ${boardIdNumber}.`;
            if (jiraError?.errorMessages && jiraError.errorMessages.length > 0)
              message = jiraError.errorMessages.join(' ');
            else if (jiraError?.message) message = jiraError.message;
            reject(new Error(message));
          } else {
            resolve(data);
          }
        },
      );
    });

    if (!sprintsResponse || !Array.isArray(sprintsResponse.values)) {
      return {
        success: false,
        error: `Error fetching sprints for board ID ${board.id}. Unexpected response format.`,
      };
    }

    const sprints: JiraSprint[] = sprintsResponse.values.map((sprint: any) => ({
      id: sprint.id,
      self: sprint.self,
      state: sprint.state,
      name: sprint.name,
      startDate: sprint.startDate,
      endDate: sprint.endDate,
      completeDate: sprint.completeDate,
      originBoardId: sprint.originBoardId || board.id, // Use originBoardId if available, else the board.id passed in
      goal: sprint.goal,
    }));

    return {
      success: true,
      data: {
        sprints: sprints,
        rawResponse: {
          // Include pagination info from response if needed by caller
          maxResults: sprintsResponse.maxResults,
          startAt: sprintsResponse.startAt,
          isLast: sprintsResponse.isLast,
          total: sprintsResponse.total,
        },
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to get sprints for board ${board.name} (ID: ${
        board.id
      }): ${error.message || 'Unknown error'}`,
    };
  }
};

// --- END NEW SERVICE FUNCTIONS ---

export const createJiraTicket = async (
  sessionId: string, // sessionId might not be used if context is companyId based
  companyId: string,
  params: {
    summary: string;
    description: string;
    projectKey: string;
    issueType?: string;
  },
): Promise<Result<Version3Models.CreatedIssue>> => {
  try {
    const jiraClient = await initializeClient(companyId);

    const newIssue = await jiraClient.issues.createIssue({
      fields: {
        summary: params.summary,
        issuetype: {
          name: params.issueType || 'Task',
        },
        project: {
          key: params.projectKey,
        },
        description: markdownToAdf(params.description),
      },
    });

    return { success: true, data: newIssue };
  } catch (error: any) {
    // Extract more detailed error information
    const errorDetails = error?.response?.data || error?.response || error;
    const errorMessage =
      errorDetails?.errorMessages?.join(', ') || errorDetails?.errors
        ? JSON.stringify(errorDetails.errors)
        : error?.message || 'Unknown error';

    console.error('[createJiraTicket] Detailed error:', {
      status: error?.response?.status,
      statusText: error?.response?.statusText,
      data: errorDetails,
      params: params,
    });

    return {
      success: false,
      error: `Failed to create JIRA ticket: ${errorMessage}`,
    };
  }
};

export const fetchJiraTickets = async (
  sessionId: string,
  companyId: string,
  params: {
    jql?: string; // Add jql as an optional parameter
    maxResults?: number;
    fieldsToFetch?: string[];
  },
): Promise<Result<any[]>> => {
  try {
    const jiraClient = await initializeClient(companyId);
    const maxResults = params.maxResults || 50;

    // Attempt to use dynamically found sprint field ID, fallback to hardcoded if necessary
    let sprintFieldIdentifier = sprintFieldIdCache;
    if (!sprintFieldIdentifier) {
      const sprintIdResult = await findSprintFieldId(companyId);
      if (sprintIdResult.success && sprintIdResult.data?.fieldId) {
        sprintFieldIdentifier = sprintIdResult.data.fieldId;
      } else {
        console.warn(
          `Could not dynamically find sprint field ID, falling back to customfield_10020. Error: ${sprintIdResult.error}`,
        );
        sprintFieldIdentifier = 'customfield_10020'; // Fallback
      }
    }

    const defaultFieldsToFetch = [
      'summary',
      'status',
      'description',
      sprintFieldIdentifier,
    ];
    const fieldsToRequest =
      params.fieldsToFetch && params.fieldsToFetch.length > 0
        ? [...params.fieldsToFetch] // Create a mutable copy
        : [...defaultFieldsToFetch];

    // Dynamically replace 'storyPoints' with its actual field ID if present
    const storyPointsIndex = fieldsToRequest.findIndex(
      (f) => f.toLowerCase() === 'storypoints',
    );
    if (storyPointsIndex !== -1) {
      const storyPointsFieldId = await findStoryPointsFieldId(companyId);
      if (storyPointsFieldId) {
        fieldsToRequest.splice(storyPointsIndex, 1, storyPointsFieldId);
      } else {
        // If not found, remove it to prevent an API error, or log a warning
        console.warn(
          "Could not resolve 'storyPoints' to a field ID. It will be excluded from the request.",
        );
        fieldsToRequest.splice(storyPointsIndex, 1);
      }
    }

    if (params.fieldsToFetch && params.fieldsToFetch.length > 0) {
      if (!fieldsToRequest.includes('description'))
        fieldsToRequest.push('description');
      if (!fieldsToRequest.includes('status')) fieldsToRequest.push('status');
      if (
        !fieldsToRequest.includes(sprintFieldIdentifier) &&
        defaultFieldsToFetch.includes(sprintFieldIdentifier)
      ) {
        fieldsToRequest.push(sprintFieldIdentifier);
      }
    }

    let startAt = 0;
    let allSimplifiedTickets: any[] = [];

    while (true) {
      if (!params.jql) {
        return {
          success: false,
          error: 'JQL must be provided to fetch tickets.',
        };
      }

      // Use POST search endpoint instead of deprecated GET /rest/api/3/search
      const response = await jiraClient.issueSearch.searchForIssuesUsingJqlPost({
        jql: params.jql,
        fields: fieldsToRequest,
        startAt,
        maxResults,
      });

      const issues = response.issues || [];
      if (!issues.length) {
        break;
      }

      const simplifiedIssues = issues.map((issue) => {
        const descriptionText = issue.fields?.description
          ? adfToText(issue.fields.description)
          : undefined;
        let sprintInfo: any = null;
        const sprintFieldData = issue.fields
          ? issue.fields[sprintFieldIdentifier!]
          : null;

        if (
          sprintFieldData &&
          Array.isArray(sprintFieldData) &&
          sprintFieldData.length > 0
        ) {
          sprintInfo = sprintFieldData.map((sprint: any) => ({
            id: sprint.id,
            name: sprint.name,
            state: sprint.state,
            boardId: sprint.boardId || sprint.originBoardId, // Prefer boardId, fallback to originBoardId
            goal: sprint.goal,
            startDate: sprint.startDate,
            endDate: sprint.endDate,
          }));
        } else if (
          sprintFieldData &&
          typeof sprintFieldData === 'object' &&
          sprintFieldData.id
        ) {
          // Single sprint object
          sprintInfo = {
            id: sprintFieldData.id,
            name: sprintFieldData.name,
            state: sprintFieldData.state,
            boardId: sprintFieldData.boardId || sprintFieldData.originBoardId,
            goal: sprintFieldData.goal,
            startDate: sprintFieldData.startDate,
            endDate: sprintFieldData.endDate,
          };
        }

        const curatedFields: Record<string, any> = {};
        fieldsToRequest.forEach((fieldName: string) => {
          if (issue.fields && issue.fields.hasOwnProperty(fieldName)) {
            if (fieldName === 'description') {
              curatedFields.descriptionText = descriptionText;
            } else if (fieldName === 'status' && issue.fields.status?.name) {
              curatedFields.status = issue.fields.status.name;
            } else if (fieldName === sprintFieldIdentifier) {
              curatedFields.sprintInfo = sprintInfo;
            } else {
              curatedFields[fieldName] = issue.fields[fieldName];
            }
          }
        });

        return {
          id: issue.id, // Added id
          key: issue.key,
          self: issue.self, // Added self
          summary: curatedFields.summary || issue.fields?.summary,
          status: curatedFields.status,
          sprintInfo: curatedFields.sprintInfo,
          // Include other curated fields if they were requested and processed
          ...Object.fromEntries(
            Object.entries(curatedFields).filter(
              ([key]) =>
                ![
                  'summary',
                  'status',
                  'sprintInfo',
                  'descriptionText',
                ].includes(key),
            ),
          ),
          descriptionText: curatedFields.descriptionText, // ensure descriptionText is at top level
        };
      });

      allSimplifiedTickets = allSimplifiedTickets.concat(simplifiedIssues);
      startAt += maxResults;

      if (
        params.maxResults &&
        allSimplifiedTickets.length >= params.maxResults
      ) {
        allSimplifiedTickets = allSimplifiedTickets.slice(0, params.maxResults);
        break;
      }
    }

    return { success: true, data: allSimplifiedTickets };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to fetch JIRA tickets: ${
        error?.message || 'Unknown error'
      }`,
    };
  }
};

export const getJiraTicketById = async (
  sessionId: string,
  companyId: string,
  params: {
    issueIdOrKey: string;
    fieldsToFetch?: string[];
  },
): Promise<Result<any>> => {
  try {
    const jiraClient = await initializeClient(companyId);
    const sprintFieldIdentifier =
      sprintFieldIdCache ||
      (await findSprintFieldId(companyId)).data?.fieldId ||
      'customfield_10020';

    let fieldsParameter: string[];
    if (params.fieldsToFetch && params.fieldsToFetch.length > 0) {
      fieldsParameter = params.fieldsToFetch;
      if (
        !fieldsParameter.includes(sprintFieldIdentifier) &&
        sprintFieldIdentifier !== 'customfield_10020'
      ) {
        // Ensure dynamic sprint field is included if not default
        fieldsParameter.push(sprintFieldIdentifier);
      }
    } else {
      fieldsParameter = [
        'summary',
        'status',
        'issuetype',
        'assignee',
        'reporter',
        'priority',
        'created',
        'updated',
        'description',
        'labels',
        'project',
        'resolution',
        'duedate',
        sprintFieldIdentifier,
      ];
    }

    const issue = await jiraClient.issues.getIssue({
      issueIdOrKey: params.issueIdOrKey,
      fields: fieldsParameter,
    });

    const descriptionText = issue.fields?.description
      ? adfToText(issue.fields.description)
      : undefined;

    let sprintInfo: any = null;
    const sprintFieldData = issue.fields
      ? issue.fields[sprintFieldIdentifier]
      : null;
    if (
      sprintFieldData &&
      Array.isArray(sprintFieldData) &&
      sprintFieldData.length > 0
    ) {
      sprintInfo = sprintFieldData.map((sprint: any) => ({
        id: sprint.id,
        name: sprint.name,
        state: sprint.state,
        boardId: sprint.boardId || sprint.originBoardId,
        goal: sprint.goal,
        startDate: sprint.startDate,
        endDate: sprint.endDate,
      }));
    } else if (
      sprintFieldData &&
      typeof sprintFieldData === 'object' &&
      sprintFieldData.id
    ) {
      sprintInfo = {
        id: sprintFieldData.id,
        name: sprintFieldData.name,
        state: sprintFieldData.state,
        boardId: sprintFieldData.boardId || sprintFieldData.originBoardId,
        goal: sprintFieldData.goal,
        startDate: sprintFieldData.startDate,
        endDate: sprintFieldData.endDate,
      };
    }

    if (fieldsParameter.includes('*all')) {
      const responseData = {
        ...issue,
        fields: {
          ...issue.fields,
          descriptionText,
          sprintInfo, // Add processed sprintInfo
        },
      };
      return { success: true, data: responseData };
    } else {
      const curatedIssueData: Record<string, any> = {
        id: issue.id,
        key: issue.key,
        self: issue.self,
        fields: {},
      };

      if (issue.fields) {
        const isDefaultFieldRequest =
          !params.fieldsToFetch || params.fieldsToFetch.length === 0;

        for (const fieldName of fieldsParameter) {
          if (issue.fields.hasOwnProperty(fieldName)) {
            let fieldValue = issue.fields[fieldName];
            if (isDefaultFieldRequest) {
              if (fieldName === 'status' && fieldValue?.name)
                fieldValue = fieldValue.name;
              else if (fieldName === 'issuetype' && fieldValue?.name)
                fieldValue = fieldValue.name;
              else if (fieldName === 'assignee' && fieldValue?.displayName)
                fieldValue = fieldValue.displayName;
              else if (fieldName === 'reporter' && fieldValue?.displayName)
                fieldValue = fieldValue.displayName;
              else if (fieldName === 'priority' && fieldValue?.name)
                fieldValue = fieldValue.name;
              else if (fieldName === 'project' && fieldValue?.name)
                fieldValue = { key: fieldValue.key, name: fieldValue.name };
              else if (
                fieldName === 'labels' &&
                Array.isArray(fieldValue) &&
                fieldValue.length > 0 &&
                typeof fieldValue[0] === 'object'
              ) {
                fieldValue = fieldValue.map((label: any) =>
                  typeof label === 'object' ? label.name || label : label,
                );
              } else if (fieldName === sprintFieldIdentifier) {
                fieldValue = sprintInfo; // Use processed sprintInfo
              }
            } else if (fieldName === sprintFieldIdentifier) {
              fieldValue = sprintInfo; // Also use processed sprintInfo for specific requests
            }
            curatedIssueData.fields[fieldName] = fieldValue;
          }
        }

        if (
          fieldsParameter.includes('description') &&
          descriptionText !== undefined
        ) {
          curatedIssueData.fields.descriptionText = descriptionText;
          if (
            isDefaultFieldRequest &&
            curatedIssueData.fields.description &&
            curatedIssueData.fields.descriptionText
          ) {
            delete curatedIssueData.fields.description;
          } else if (issue.fields.description && !isDefaultFieldRequest) {
            curatedIssueData.fields.description = issue.fields.description;
          }
        }
        // Ensure sprintInfo is in fields if it was part of fieldsParameter
        if (
          fieldsParameter.includes(sprintFieldIdentifier) &&
          sprintInfo !== null
        ) {
          curatedIssueData.fields.sprintInfo = sprintInfo;
          // If the original sprint field (e.g. customfield_10020) was also requested and is different from 'sprintInfo', keep it.
          // Otherwise, if it's the same as sprintFieldIdentifier, it's already handled.
          if (
            sprintFieldIdentifier !== 'sprintInfo' &&
            curatedIssueData.fields[sprintFieldIdentifier]
          ) {
            // it's already set
          } else if (
            sprintFieldIdentifier === 'sprintInfo' &&
            issue.fields[sprintFieldIdentifier]
          ) {
            curatedIssueData.fields[sprintFieldIdentifier] =
              issue.fields[sprintFieldIdentifier]; // keep original if different
          }
        }
      }
      return { success: true, data: curatedIssueData };
    }
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to fetch JIRA ticket: ${
        error?.message || 'Unknown error'
      }`,
    };
  }
};

export const addCommentToJiraTicket = async (
  sessionId: string,
  companyId: string,
  params: {
    issueIdOrKey: string;
    commentBody: string;
  },
): Promise<Result<Version3Models.Comment>> => {
  try {
    const jiraClient = await initializeClient(companyId);

    const comment = await jiraClient.issueComments.addComment({
      issueIdOrKey: params.issueIdOrKey,
      comment: markdownToAdf(params.commentBody),
    });
    return { success: true, data: comment };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to add comment to JIRA ticket: ${
        error?.message || 'Unknown error'
      }`,
    };
  }
};

export const updateJiraTicket = async (
  sessionId: string,
  companyId: string,
  params: {
    issueIdOrKey: string;
    fields: { [key: string]: any };
  },
): Promise<Result<{ id: string; message: string }>> => {
  try {
    const jiraClient = await initializeClient(companyId);

    const fieldsToUpdate = { ...params.fields };

    if (
      fieldsToUpdate.description &&
      typeof fieldsToUpdate.description === 'string'
    ) {
      fieldsToUpdate.description = markdownToAdf(fieldsToUpdate.description);
    }

    // If sprint is being updated, ensure it uses the dynamically found field ID
    // This part assumes that if 'sprint' is a key in fieldsToUpdate, its value is the sprint ID.
    if (
      (fieldsToUpdate.sprint && typeof fieldsToUpdate.sprint === 'number') ||
      typeof fieldsToUpdate.sprint === 'string'
    ) {
      const sprintIdResult = await findSprintFieldId(companyId);
      if (sprintIdResult.success && sprintIdResult.data?.fieldId) {
        const dynamicSprintFieldId = sprintIdResult.data.fieldId;
        if (dynamicSprintFieldId !== 'sprint') {
          // Avoid replacing if 'sprint' is the actual field ID
          fieldsToUpdate[dynamicSprintFieldId] = fieldsToUpdate.sprint;
          delete fieldsToUpdate.sprint; // Remove the generic 'sprint' key
        }
      } else {
        // Fallback or error if dynamic sprint field ID not found
        console.warn(
          `Sprint field ID not found dynamically for update. Attempting with 'sprint' key or default customfield_10020 if that was intended.`,
        );
        // If the intention was to use a known custom field, it should be passed directly.
        // For now, if 'sprint' was passed, and we couldn't map it, it might fail or Jira might ignore it.
      }
    }

    await jiraClient.issues.editIssue({
      issueIdOrKey: params.issueIdOrKey,
      fields: fieldsToUpdate,
    });
    return {
      success: true,
      data: {
        id: params.issueIdOrKey,
        message: `Ticket ${params.issueIdOrKey} updated successfully.`,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to update JIRA ticket: ${
        error?.message || 'Unknown error'
      }`,
    };
  }
};

export const addTicketToCurrentSprint = async (
  sessionId: string,
  companyId: string,
  params: {
    boardId: string;
    issueKey: string;
  },
): Promise<Result<{ message: string }>> => {
  try {
    const jiraClient = await initializeClient(companyId);
    const boardIdNumber = parseInt(params.boardId, 10);
    if (isNaN(boardIdNumber)) {
      return { success: false, error: 'Invalid boardId. It must be a number.' };
    }

    const activeSprintsResponse: any = await new Promise((resolve, reject) => {
      jiraClient.sendRequest(
        {
          method: 'GET',
          url: `/rest/agile/1.0/board/${boardIdNumber}/sprint?state=active`,
        },
        (error: any, data: any) => {
          if (error) {
            const jiraError = error?.error || error;
            let message = 'Failed to get active sprints.';
            if (jiraError?.errorMessages && jiraError.errorMessages.length > 0)
              message = jiraError.errorMessages.join(' ');
            else if (jiraError?.message) message = jiraError.message;
            reject(new Error(message));
          } else {
            resolve(data);
          }
        },
      );
    });

    if (
      !activeSprintsResponse ||
      !activeSprintsResponse.values ||
      activeSprintsResponse.values.length === 0
    ) {
      return {
        success: false,
        error: `No active sprint found for board ID ${
          params.boardId
        }. Response: ${JSON.stringify(activeSprintsResponse)}`,
      };
    }

    const activeSprint = activeSprintsResponse.values[0];
    if (!activeSprint.id || !activeSprint.name) {
      return {
        success: false,
        error: `Active sprint found but it does not have a valid ID or name. Sprint data: ${JSON.stringify(
          activeSprint,
        )}`,
      };
    }

    await new Promise<void>((resolve, reject) => {
      jiraClient.sendRequest(
        {
          method: 'POST',
          url: `/rest/agile/1.0/sprint/${activeSprint.id}/issue`,
          data: {
            issues: [params.issueKey],
          },
        },
        (error: any, data: any) => {
          if (error) {
            const jiraError = error?.error || error;
            let message = `Failed to add issue ${params.issueKey} to sprint ${activeSprint.id}.`;
            if (jiraError?.errorMessages && jiraError.errorMessages.length > 0)
              message = jiraError.errorMessages.join(' ');
            else if (jiraError?.message) message = jiraError.message;
            reject(new Error(message));
          } else {
            resolve();
          }
        },
      );
    });

    return {
      success: true,
      data: {
        message: `Ticket ${params.issueKey} successfully added to sprint '${activeSprint.name}' (ID: ${activeSprint.id}).`,
      },
    };
  } catch (error: any) {
    const errorMessage =
      error.message ||
      (error.errorMessages && error.errorMessages.join(', ')) ||
      'Unknown error';
    return {
      success: false,
      error: `Failed to add ticket ${params.issueKey} to current sprint on board ${params.boardId}: ${errorMessage}`,
    };
  }
};

export const getSprintsForBoard = async (
  sessionId: string,
  companyId: string,
  params: {
    boardId: string;
    state?: string;
    startAt?: number;
    maxResults?: number;
  },
): Promise<
  Result<{
    sprints: JiraSprint[];
    maxResults?: number;
    startAt?: number;
    isLast?: boolean;
    total?: number;
  }>
> => {
  try {
    const jiraClient = await initializeClient(companyId);
    const boardIdNumber = parseInt(params.boardId, 10);
    if (isNaN(boardIdNumber)) {
      return { success: false, error: 'Invalid boardId. It must be a number.' };
    }

    const requestParams: any = {
      startAt: params.startAt || 0,
      maxResults: params.maxResults || 50,
      state: params.state || 'active,future',
    };

    const sprintsResponse: any = await new Promise((resolve, reject) => {
      jiraClient.sendRequest(
        {
          method: 'GET',
          url: `/rest/agile/1.0/board/${boardIdNumber}/sprint`,
          params: requestParams,
        },
        (error: any, data: any) => {
          if (error) {
            const jiraError = error?.error || error;
            let message = `Failed to get sprints for board ${boardIdNumber}.`;
            if (jiraError?.errorMessages && jiraError.errorMessages.length > 0)
              message = jiraError.errorMessages.join(' ');
            else if (jiraError?.message) message = jiraError.message;
            reject(new Error(message));
          } else {
            resolve(data);
          }
        },
      );
    });

    if (!sprintsResponse || !Array.isArray(sprintsResponse.values)) {
      return {
        success: false,
        error: `Error fetching sprints for board ID ${params.boardId}. Unexpected response format.`,
      };
    }

    const sprints: JiraSprint[] = sprintsResponse.values.map((sprint: any) => ({
      id: sprint.id,
      self: sprint.self,
      name: sprint.name,
      state: sprint.state,
      originBoardId: sprint.originBoardId,
      goal: sprint.goal,
      startDate: sprint.startDate,
      endDate: sprint.endDate,
      completeDate: sprint.completeDate,
    }));

    return {
      success: true,
      data: {
        sprints: sprints,
        maxResults: sprintsResponse.maxResults,
        startAt: sprintsResponse.startAt,
        isLast: sprintsResponse.isLast,
        total: sprintsResponse.total,
      },
    };
  } catch (error: any) {
    const errorMessage =
      error.message ||
      (error.errorMessages && error.errorMessages.join(', ')) ||
      `Unknown error fetching sprints for board ${params.boardId}`;
    return { success: false, error: errorMessage };
  }
};

export const getActiveSprintForBoard = async (
  sessionId: string,
  companyId: string,
  params: {
    boardId: string;
  },
): Promise<Result<JiraSprint>> => {
  try {
    const jiraClient = await initializeClient(companyId);
    const boardIdNumber = parseInt(params.boardId, 10);
    if (isNaN(boardIdNumber)) {
      return { success: false, error: 'Invalid boardId. It must be a number.' };
    }

    const activeSprintsResponse: any = await new Promise((resolve, reject) => {
      jiraClient.sendRequest(
        {
          method: 'GET',
          url: `/rest/agile/1.0/board/${boardIdNumber}/sprint?state=active`,
        },
        (error: any, data: any) => {
          if (error) {
            const jiraError = error?.error || error;
            let message = 'Failed to get active sprints.';
            if (jiraError?.errorMessages && jiraError.errorMessages.length > 0)
              message = jiraError.errorMessages.join(' ');
            else if (jiraError?.message) message = jiraError.message;
            reject(new Error(message));
          } else {
            resolve(data);
          }
        },
      );
    });

    if (
      !activeSprintsResponse ||
      !activeSprintsResponse.values ||
      activeSprintsResponse.values.length === 0
    ) {
      return {
        success: false,
        error: `No active sprint found for board ID ${params.boardId}.`,
      };
    }

    const activeSprintData = activeSprintsResponse.values[0];
    if (
      !activeSprintData.id ||
      !activeSprintData.name ||
      !activeSprintData.state ||
      activeSprintData.originBoardId === undefined
    ) {
      return {
        success: false,
        error: `Active sprint data is incomplete. Sprint data: ${JSON.stringify(
          activeSprintData,
        )}`,
      };
    }

    const activeSprint: JiraSprint = {
      id: activeSprintData.id,
      self: activeSprintData.self,
      name: activeSprintData.name,
      state: activeSprintData.state,
      originBoardId: activeSprintData.originBoardId,
      goal: activeSprintData.goal,
      startDate: activeSprintData.startDate,
      endDate: activeSprintData.endDate,
    };

    return { success: true, data: activeSprint };
  } catch (error: any) {
    const errorMessage =
      error.message ||
      (error.errorMessages && error.errorMessages.join(', ')) ||
      'Unknown error fetching active sprint';
    return {
      success: false,
      error: `Failed to get active sprint for board ${params.boardId}: ${errorMessage}`,
    };
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
    assigneeAccountId?: string; // <-- Add the new parameter here
  },
): Promise<
  Result<{
    issues: any[];
    total?: number;
    maxResults?: number;
    startAt?: number;
    message?: string;
  }>
> => {
  try {
    const jiraClient = await initializeClient(companyId);
    const sprintIdNumber = parseInt(params.sprintId, 10);
    if (isNaN(sprintIdNumber)) {
      return {
        success: false,
        error: 'Invalid sprintId. It must be a number.',
      };
    }

    const maxResults = params.maxResults || 50;
    const startAt = params.startAt || 0;

    const sprintFieldIdentifier =
      sprintFieldIdCache ||
      (await findSprintFieldId(companyId)).data?.fieldId ||
      'customfield_10020';

    const defaultFieldsToFetch = [
      'summary',
      'status',
      'description',
      'assignee',
      'issuetype',
      'priority',
      sprintFieldIdentifier,
    ];
    const fieldsToRequest =
      params.fieldsToFetch && params.fieldsToFetch.length > 0
        ? params.fieldsToFetch
        : defaultFieldsToFetch;

    if (params.fieldsToFetch && params.fieldsToFetch.length > 0) {
      if (!fieldsToRequest.includes('description'))
        fieldsToRequest.push('description');
      if (!fieldsToRequest.includes('status')) fieldsToRequest.push('status');
      if (
        !fieldsToRequest.includes(sprintFieldIdentifier) &&
        defaultFieldsToFetch.includes(sprintFieldIdentifier)
      ) {
        fieldsToRequest.push(sprintFieldIdentifier);
      }
    }

    const response: any = await new Promise((resolve, reject) => {
      jiraClient.sendRequest(
        {
          method: 'GET',
          url: `/rest/agile/1.0/sprint/${sprintIdNumber}/issue`,
          params: {
            startAt: startAt,
            maxResults: maxResults,
            fields: fieldsToRequest.join(','),
            jql:
              [
                params.projectKey ? `project = ${params.projectKey}` : '',
                params.assigneeAccountId
                  ? `assignee = "${params.assigneeAccountId}"`
                  : '',
              ]
                .filter(Boolean)
                .join(' AND ') || undefined,
          },
        },
        (error: any, data: any) => {
          if (error) {
            const jiraError = error?.error || error;
            let message = `Failed to get issues for sprint ${sprintIdNumber}.`;
            if (jiraError?.errorMessages && jiraError.errorMessages.length > 0)
              message = jiraError.errorMessages.join(' ');
            else if (jiraError?.message) message = jiraError.message;
            reject(new Error(message));
          } else {
            resolve(data);
          }
        },
      );
    });

    const issuesFromResponse = response.issues || [];
    if (!issuesFromResponse.length && response.total === 0) {
      return {
        success: true,
        data: { issues: [] },
        message: `No issues found for sprint ID ${params.sprintId}.`,
      };
    }

    const simplifiedIssues = issuesFromResponse.map((issue: any) => {
      const descriptionText = issue.fields?.description
        ? adfToText(issue.fields.description)
        : undefined;

      const curatedFields: Record<string, any> = {};
      fieldsToRequest.forEach((fieldName: string) => {
        if (issue.fields && issue.fields.hasOwnProperty(fieldName)) {
          if (fieldName === 'description') {
            curatedFields.descriptionText = descriptionText;
          } else if (fieldName === 'status' && issue.fields.status?.name) {
            curatedFields.status = issue.fields.status.name;
          } else if (
            fieldName === 'assignee' &&
            issue.fields.assignee?.displayName
          ) {
            curatedFields.assignee = issue.fields.assignee.displayName;
            curatedFields.assigneeAccountId = issue.fields.assignee.accountId;
          } else if (
            fieldName === 'issuetype' &&
            issue.fields.issuetype?.name
          ) {
            curatedFields.issuetype = issue.fields.issuetype.name;
          } else if (fieldName === 'priority' && issue.fields.priority?.name) {
            curatedFields.priority = issue.fields.priority.name;
          } else if (fieldName === sprintFieldIdentifier) {
            // Sprint info for issues fetched via sprint/issue endpoint might be simpler or absent
            // We might need to re-fetch sprint details if not present or rely on context
            curatedFields.sprintInfo = issue.fields[sprintFieldIdentifier]; // Take raw for now
          } else {
            curatedFields[fieldName] = issue.fields[fieldName];
          }
        }
      });

      return {
        id: issue.id,
        key: issue.key,
        summary: issue.fields?.summary,
        ...curatedFields,
      };
    });

    return {
      success: true,
      data: {
        issues: simplifiedIssues,
        total: response.total,
        maxResults: response.maxResults,
        startAt: response.startAt,
      },
    };
  } catch (error: any) {
    const errorMessage =
      error.message ||
      (error.errorMessages && error.errorMessages.join(', ')) ||
      'Unknown error fetching issues for sprint';
    return {
      success: false,
      error: `Failed to get issues for sprint ${params.sprintId}: ${errorMessage}`,
    };
  }
};

export const moveIssueToSprint = async (
  sessionId: string,
  companyId: string,
  params: {
    issueKey: string;
    targetSprintId: string;
  },
): Promise<Result<any>> => {
  // Simplified return type's generic part
  try {
    const jiraClient = await initializeClient(companyId);
    const targetSprintIdNumber = parseInt(params.targetSprintId, 10);

    if (isNaN(targetSprintIdNumber)) {
      return {
        success: false,
        error: 'Invalid targetSprintId. It must be a number.',
      };
    }

    await new Promise<void>((resolve, reject) => {
      jiraClient.sendRequest(
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
            if (jiraError?.errorMessages && jiraError.errorMessages.length > 0)
              message = jiraError.errorMessages.join(' ');
            else if (
              jiraError?.errors &&
              Object.keys(jiraError.errors).length > 0
            )
              message = Object.values(jiraError.errors).join(' ');
            else if (jiraError?.message) message = jiraError.message;
            reject(new Error(message));
          } else {
            resolve();
          }
        },
      );
    });

    let boardIdToFetchSprints: number | undefined;
    try {
      const sprintDetailsResponse: any = await new Promise(
        (resolve, reject) => {
          jiraClient.sendRequest(
            {
              method: 'GET',
              url: `/rest/agile/1.0/sprint/${targetSprintIdNumber}`,
            },
            (err: any, sprintData: any) => {
              if (err)
                reject(
                  new Error(
                    `Failed to fetch details for target sprint ${targetSprintIdNumber}: ${
                      err.message || JSON.stringify(err)
                    }`,
                  ),
                );
              else resolve(sprintData);
            },
          );
        },
      );

      if (sprintDetailsResponse && sprintDetailsResponse.originBoardId) {
        boardIdToFetchSprints = sprintDetailsResponse.originBoardId;
      } else {
        console.warn(
          `Could not determine boardId for sprint ${targetSprintIdNumber}. Sprint details: ${JSON.stringify(
            sprintDetailsResponse,
          )}`,
        );
        return {
          success: true,
          message: `Ticket ${params.issueKey} successfully moved to sprint ID ${targetSprintIdNumber}. Could not fetch updated sprint list as board ID was not found for the target sprint.`,
        };
      }
    } catch (sprintFetchError: any) {
      console.error(
        `Error fetching target sprint details: ${sprintFetchError.message}`,
      );
      return {
        success: true,
        message: `Ticket ${params.issueKey} successfully moved to sprint ID ${targetSprintIdNumber}. Error fetching updated sprint list: ${sprintFetchError.message}`,
      };
    }

    if (boardIdToFetchSprints) {
      // Use the existing getSprintsForBoard which returns Result<...>
      const sprintsDataResult = await getSprintsForBoard(sessionId, companyId, {
        boardId: boardIdToFetchSprints.toString(),
      });
      if (sprintsDataResult.success && sprintsDataResult.data) {
        return {
          success: true,
          message: `Ticket ${params.issueKey} successfully moved to sprint ID ${targetSprintIdNumber}. Sprint list retrieved.`,
          data: {
            // Outer data for Result<any>
            operationStatus: `Moved issue ${params.issueKey} to sprint ${targetSprintIdNumber}.`,
            sprintListMessage: 'Updated sprint list.',
            sprintListData: sprintsDataResult.data,
          },
        };
      } else {
        return {
          success: true, // Move itself was successful, but sprint list fetch failed
          message: `Ticket ${
            params.issueKey
          } successfully moved to sprint ID ${targetSprintIdNumber}. Failed to fetch updated sprint list: ${
            sprintsDataResult.error || 'Unknown reason'
          }.`,
          data: {
            operationStatus: `Moved issue ${params.issueKey} to sprint ${targetSprintIdNumber}.`,
            sprintListMessage: `Failed to fetch updated sprint list: ${
              sprintsDataResult.error || 'Unknown reason'
            }.`,
          },
        };
      }
    } else {
      // This case means boardIdToFetchSprints was undefined
      return {
        success: true,
        message: `Ticket ${params.issueKey} successfully moved to sprint ID ${targetSprintIdNumber}, but could not retrieve updated sprint list as board ID was not determined.`,
        data: {
          operationStatus: `Moved issue ${params.issueKey} to sprint ${targetSprintIdNumber}.`,
          sprintListMessage:
            'Could not retrieve updated sprint list as board ID was not determined for the target sprint.',
        },
      };
    }
  } catch (error: any) {
    const errorMessage =
      error.message ||
      (error.errorMessages && error.errorMessages.join(', ')) ||
      `Unknown error moving issue ${params.issueKey} to sprint ${params.targetSprintId}`;
    return { success: false, error: errorMessage };
  }
};

export const moveIssueToBacklog = async (
  sessionId: string,
  companyId: string,
  params: {
    issueKey: string;
  },
): Promise<Result<{ message: string }>> => {
  try {
    const jiraClient = await initializeClient(companyId);
    await new Promise<void>((resolve, reject) => {
      jiraClient.sendRequest(
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
            if (jiraError?.errorMessages && jiraError.errorMessages.length > 0)
              message = jiraError.errorMessages.join(' ');
            else if (
              jiraError?.errors &&
              Object.keys(jiraError.errors).length > 0
            )
              message = Object.values(jiraError.errors).join(' ');
            else if (jiraError?.message) message = jiraError.message;
            reject(new Error(message));
          } else {
            resolve();
          }
        },
      );
    });

    const successMessage = `Ticket ${params.issueKey} successfully moved to backlog.`;
    return {
      success: true,
      data: { message: successMessage },
    };
  } catch (error: any) {
    const errorMessage =
      error.message ||
      (error.errorMessages && error.errorMessages.join(', ')) ||
      `Unknown error moving issue ${params.issueKey} to backlog`;
    return { success: false, error: errorMessage };
  }
};

export const getAvailableTransitions = async (
  sessionId: string,
  companyId: string,
  params: {
    issueIdOrKey: string;
  },
): Promise<Result<any[]>> => {
  // Changed Version3Models.Transition[] to any[]
  try {
    const jiraClient = await initializeClient(companyId);
    const transitionsResponse = await jiraClient.issues.getTransitions({
      issueIdOrKey: params.issueIdOrKey,
    });

    if (!transitionsResponse || !transitionsResponse.transitions) {
      return {
        success: false,
        error: `No transitions found or error fetching transitions for issue ${params.issueIdOrKey}.`,
      };
    }

    return { success: true, data: transitionsResponse.transitions };
  } catch (error: any) {
    const errorMessage =
      error.message ||
      (error.errorMessages && error.errorMessages.join(', ')) ||
      `Unknown error fetching transitions for issue ${params.issueIdOrKey}`;
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
    fields?: Record<string, any>;
  },
): Promise<Result<any[]>> => {
  // Changed Version3Models.Transition[] to any[]
  try {
    const jiraClient = await initializeClient(companyId);
    const payload: any = { transition: { id: params.transitionId } };
    if (params.comment)
      payload.update = { comment: [{ add: markdownToAdf(params.comment) }] };
    if (params.fields) payload.fields = params.fields;

    await jiraClient.issues.doTransition({
      issueIdOrKey: params.issueIdOrKey,
      transition: payload.transition,
      fields: payload.fields,
      update: payload.update,
    });

    const newTransitionsResult = await getAvailableTransitions(
      sessionId,
      companyId,
      { issueIdOrKey: params.issueIdOrKey },
    );

    if (newTransitionsResult.success && newTransitionsResult.data) {
      return {
        success: true,
        message: `Issue ${params.issueIdOrKey} successfully transitioned using transition ID ${params.transitionId}.`,
        data: newTransitionsResult.data,
      };
    } else {
      return {
        success: true,
        message: `Issue ${
          params.issueIdOrKey
        } successfully transitioned. However, failed to fetch updated available transitions: ${
          newTransitionsResult.error || 'Unknown error'
        }`,
        data: [],
      };
    }
  } catch (error: any) {
    let detailedError = '';
    if (
      error.response &&
      error.response.data &&
      error.response.data.errorMessages
    )
      detailedError = error.response.data.errorMessages.join('; ');
    else if (
      error.response &&
      error.response.data &&
      error.response.data.errors
    )
      detailedError = Object.entries(error.response.data.errors)
        .map(([key, value]) => `${key}: ${value}`)
        .join('; ');
    const errorMessage =
      detailedError ||
      error.message ||
      `Unknown error transitioning issue ${params.issueIdOrKey}`;
    return {
      success: false,
      error: `Failed to transition issue: ${errorMessage}`,
    };
  }
};

let storyPointsFieldIdCache: string | null = null;

const findStoryPointsFieldId = async (
  companyId: string,
): Promise<string | null> => {
  // Removed sessionId as it's not used
  if (storyPointsFieldIdCache) {
    return storyPointsFieldIdCache;
  }
  try {
    // Use the internal helper to avoid direct export/import cycle if getJiraTicketFields was also modified
    const fieldsResult = await getJiraTicketFieldsInternal(companyId);
    if (fieldsResult.success && Array.isArray(fieldsResult.data)) {
      const commonStoryPointsFieldNames = [
        'Story Points',
        'Story Point Estimate',
        'Σ Story Points',
      ];
      const storyPointField = fieldsResult.data.find(
        (field: any) =>
          commonStoryPointsFieldNames.some(
            (name) => field.name?.toLowerCase() === name.toLowerCase(),
          ) &&
          (field.schema?.type === 'number' ||
            field.schema?.custom ===
              'com.atlassian.jira.plugin.system.customfieldtypes:float'),
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
    storyPoints: number | null;
  },
): Promise<Result<{ id: string; message: string }>> => {
  try {
    const storyPointsFieldId = await findStoryPointsFieldId(companyId); // Pass companyId
    if (!storyPointsFieldId) {
      return {
        success: false,
        error:
          'Could not automatically determine the Story Points field ID. Please ensure it is configured or check field names.',
      };
    }
    const fieldsToUpdate = { [storyPointsFieldId]: params.storyPoints };
    return await updateJiraTicket(sessionId, companyId, {
      issueIdOrKey: params.issueIdOrKey,
      fields: fieldsToUpdate,
    });
  } catch (error: any) {
    const errorMessage =
      error.message ||
      `Unknown error setting story points for issue ${params.issueIdOrKey}`;
    return {
      success: false,
      error: `Failed to set story points: ${errorMessage}`,
    };
  }
};

const adfToText = (adfNode: any): string => {
  if (!adfNode) return '';
  let resultText = '';
  function processNode(node: any) {
    if (!node) return;
    switch (node.type) {
      case 'text':
        resultText += node.text || '';
        break;
      case 'paragraph':
      case 'heading':
        if (node.content) node.content.forEach(processNode);
        resultText += '\n';
        break;
      case 'bulletList':
      case 'orderedList':
        if (node.content)
          node.content.forEach((listItem: any, index: number) => {
            if (node.type === 'orderedList') resultText += `${index + 1}. `;
            else resultText += '- ';
            if (listItem.content) listItem.content.forEach(processNode);
          });
        break;
      case 'listItem':
        if (node.content) node.content.forEach(processNode);
        break;
      case 'codeBlock':
        if (node.content)
          node.content.forEach((textNode: any) => {
            if (textNode.type === 'text') resultText += textNode.text + '\n';
          });
        break;
      case 'blockquote':
        if (node.content)
          node.content.forEach((pNode: any) => {
            resultText += '> ';
            processNode(pNode);
          });
        break;
      case 'panel':
        if (node.content) node.content.forEach(processNode);
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
      case 'table':
        if (node.content)
          node.content.forEach((row: any) => {
            if (row.content)
              row.content.forEach((cell: any) => {
                if (cell.content) cell.content.forEach(processNode);
                resultText += '\t';
              });
            resultText += '\n';
          });
        break;
      default:
        if (node.content && Array.isArray(node.content))
          node.content.forEach(processNode);
        break;
    }
  }
  if (adfNode.type === 'doc' && adfNode.content)
    adfNode.content.forEach(processNode);
  else processNode(adfNode);
  return resultText.replace(/\n\s*\n/g, '\n').trim();
};

export const markdownToAdf = (markdown: string): any => {
  if (!markdown || typeof markdown !== 'string')
    return { type: 'doc', version: 1, content: [] };
  const adfContent: any[] = [];
  const lines = markdown.split('\n');
  let inList = false;
  let listType: 'bulletList' | 'orderedList' | null = null;
  let listItems: any[] = [];
  let inCodeBlock = false;
  let codeBlockContent = '';
  const processInlineFormatting = (text: string): any[] => {
    if (!text.trim()) return [];
    const segments: any[] = [];
    const currentText = text;
    const boldParts = currentText.split(/\*\*|__/);
    boldParts.forEach((part, i) => {
      if (i % 2 === 1)
        segments.push({
          type: 'text',
          text: part,
          marks: [{ type: 'strong' }],
        });
      else {
        const italicParts = part.split(/\*|_/);
        italicParts.forEach((italicPart, j) => {
          if (j % 2 === 1)
            segments.push({
              type: 'text',
              text: italicPart,
              marks: [{ type: 'em' }],
            });
          else if (italicPart)
            segments.push({ type: 'text', text: italicPart });
        });
      }
    });
    return segments.filter((s) => s.text && s.text.length > 0);
  };
  const flushList = () => {
    if (inList && listType && listItems.length > 0)
      adfContent.push({ type: listType, content: listItems });
    inList = false;
    listType = null;
    listItems = [];
  };
  const flushCodeBlock = () => {
    if (inCodeBlock && codeBlockContent.length > 0)
      adfContent.push({
        type: 'codeBlock',
        content: [{ type: 'text', text: codeBlockContent.trimEnd() }],
      });
    inCodeBlock = false;
    codeBlockContent = '';
  };
  for (const line of lines) {
    if (line.startsWith('```')) {
      if (inCodeBlock) flushCodeBlock();
      else {
        flushList();
        inCodeBlock = true;
      }
      continue;
    }
    if (inCodeBlock) {
      codeBlockContent += line + '\n';
      continue;
    }
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
    const ulMatch = line.match(/^(\s*)([\-\*\+])\s+(.*)/);
    if (ulMatch) {
      if (!inList || listType !== 'bulletList') {
        flushList();
        inList = true;
        listType = 'bulletList';
      }
      listItems.push({
        type: 'listItem',
        content: [
          { type: 'paragraph', content: processInlineFormatting(ulMatch[3]) },
        ],
      });
      continue;
    }
    const olMatch = line.match(/^(\s*)(\d+)\.\s+(.*)/);
    if (olMatch) {
      if (!inList || listType !== 'orderedList') {
        flushList();
        inList = true;
        listType = 'orderedList';
      }
      listItems.push({
        type: 'listItem',
        content: [
          { type: 'paragraph', content: processInlineFormatting(olMatch[3]) },
        ],
      });
      continue;
    }
    if (inList && !ulMatch && !olMatch) flushList();
    if (line.trim() === '') flushList();
    else {
      flushList();
      adfContent.push({
        type: 'paragraph',
        content: processInlineFormatting(line),
      });
    }
  }
  flushList();
  flushCodeBlock();
  const finalContent = adfContent.filter(
    (node) =>
      !(
        node.type === 'paragraph' &&
        (!node.content || node.content.length === 0)
      ),
  );
  return {
    type: 'doc',
    version: 1,
    content:
      finalContent.length > 0
        ? finalContent
        : [{ type: 'paragraph', content: [] }],
  };
};

export const getJiraTicketFields = async (
  sessionId: string,
  companyId: string,
): Promise<Result<any[]>> => {
  // This is the public version, ensure it calls the internal one or has the same logic
  return getJiraTicketFieldsInternal(companyId);
};

export const getJiraTicketComments = async (
  sessionId: string,
  companyId: string,
  params: {
    issueIdOrKey: string;
    startAt?: number;
    maxResults?: number;
    orderBy?: string;
    expand?: string;
  },
): Promise<Result<Version3Models.PageOfComments>> => {
  try {
    const jiraClient = await initializeClient(companyId);
    const comments = await jiraClient.issueComments.getComments({
      issueIdOrKey: params.issueIdOrKey,
      startAt: params.startAt,
      maxResults: params.maxResults,
      orderBy: params.orderBy,
      expand: params.expand,
    });
    if (comments.comments) {
      comments.comments.forEach((comment) => {
        if (comment.body && typeof comment.body === 'object') {
          // Ensure body is ADF object
          // @ts-expect-error bodyText is an augmentation we add for downstream consumers when Atlassian returns ADF content.
          comment.bodyText = adfToText(comment.body);
        }
      });
    }
    return { success: true, data: comments };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to fetch JIRA ticket comments: ${
        error?.message || 'Unknown error'
      }`,
    };
  }
};

export const searchJiraUsers = async (
  sessionId: string,
  companyId: string,
  params: {
    query?: string;
    startAt?: number;
    maxResults?: number;
    accountId?: string;
  },
): Promise<Result<Partial<Version3Models.User>[]>> => {
  // Return type simplified
  try {
    const jiraClient = await initializeClient(companyId);
    const searchParams: any = {
      query: params.query || '',
      startAt: params.startAt || 0,
      maxResults: params.maxResults || 50,
    };
    const users: Version3Models.User[] =
      await jiraClient.userSearch.findUsers(searchParams);
    const simplifiedUsers = users.map((user) => ({
      accountId: user.accountId,
      displayName: user.displayName,
      emailAddress: user.emailAddress,
      avatarUrls: user.avatarUrls,
      active: user.active,
    }));
    return { success: true, data: simplifiedUsers };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to search JIRA users: ${
        error?.message || 'Unknown error'
      }`,
    };
  }
};

export const assignJiraTicket = async (
  sessionId: string,
  companyId: string,
  params: {
    issueIdOrKey: string;
    accountId: string | null;
  },
): Promise<Result<{ id: string; message: string }>> => {
  try {
    const fieldsToUpdate = {
      assignee: params.accountId ? { accountId: params.accountId } : null,
    };
    return await updateJiraTicket(sessionId, companyId, {
      issueIdOrKey: params.issueIdOrKey,
      fields: fieldsToUpdate,
    });
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to assign JIRA ticket: ${
        error?.message || 'Unknown error'
      }`,
    };
  }
};
