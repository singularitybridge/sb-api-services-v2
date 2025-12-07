/**
 * Jira Tickets Service
 * Handles ticket CRUD operations, transitions, and story points
 */

import { Version3Models } from 'jira.js';
import { initializeClient, executeJiraRequest } from '../client';
import {
  Result,
  SimplifiedIssue,
  SprintInfo,
  CreatedIssue,
  Comment,
  PageOfComments,
} from '../types';
import { markdownToAdf, adfToText } from '../utils/adf';
import {
  getSprintFieldId,
  findStoryPointsFieldId,
  resolveFieldAliases,
} from './fields.service';
import { getBoardsForProject } from './boards.service';

// ============================================================================
// Create Ticket
// ============================================================================

/**
 * Create a new Jira ticket
 */
export const createTicket = async (
  companyId: string,
  params: {
    summary: string;
    description: string;
    projectKey: string;
    issueType?: string;
  },
): Promise<Result<CreatedIssue>> => {
  try {
    const client = await initializeClient(companyId);

    const newIssue = await client.issues.createIssue({
      fields: {
        summary: params.summary,
        issuetype: { name: params.issueType || 'Task' },
        project: { key: params.projectKey },
        description: markdownToAdf(params.description) as any,
      },
    });

    return { success: true, data: newIssue as CreatedIssue };
  } catch (error: any) {
    const errorDetails = error?.response?.data || error?.response || error;
    const errorMessage =
      errorDetails?.errorMessages?.join(', ') ||
      (errorDetails?.errors ? JSON.stringify(errorDetails.errors) : null) ||
      error?.message ||
      'Unknown error';

    console.error('[createTicket] Error:', {
      status: error?.response?.status,
      data: errorDetails,
      params,
    });

    return {
      success: false,
      error: `Failed to create JIRA ticket: ${errorMessage}`,
    };
  }
};

// ============================================================================
// Fetch Tickets (JQL Search)
// ============================================================================

/**
 * Process sprint field data into SprintInfo format
 */
const processSprintField = (
  sprintFieldData: any,
): SprintInfo | SprintInfo[] | null => {
  if (!sprintFieldData) return null;

  if (Array.isArray(sprintFieldData) && sprintFieldData.length > 0) {
    return sprintFieldData.map((sprint: any) => ({
      id: sprint.id,
      name: sprint.name,
      state: sprint.state,
      boardId: sprint.boardId || sprint.originBoardId,
      goal: sprint.goal,
      startDate: sprint.startDate,
      endDate: sprint.endDate,
    }));
  }

  if (typeof sprintFieldData === 'object' && sprintFieldData.id) {
    return {
      id: sprintFieldData.id,
      name: sprintFieldData.name,
      state: sprintFieldData.state,
      boardId: sprintFieldData.boardId || sprintFieldData.originBoardId,
      goal: sprintFieldData.goal,
      startDate: sprintFieldData.startDate,
      endDate: sprintFieldData.endDate,
    };
  }

  return null;
};

/**
 * Fetch tickets using JQL query
 */
export const fetchTickets = async (
  companyId: string,
  params: {
    jql: string;
    maxResults?: number;
    fieldsToFetch?: string[];
  },
): Promise<Result<SimplifiedIssue[]>> => {
  if (!params.jql) {
    return { success: false, error: 'JQL must be provided to fetch tickets.' };
  }

  try {
    const client = await initializeClient(companyId);
    const maxResults = params.maxResults || 50;
    const sprintFieldId = await getSprintFieldId(companyId);

    // Build fields list
    const defaultFields = ['summary', 'status', 'description', sprintFieldId];
    const fieldsToRequest = params.fieldsToFetch?.length
      ? await resolveFieldAliases(companyId, params.fieldsToFetch)
      : [...defaultFields];

    // Ensure essential fields are included
    if (!fieldsToRequest.includes('description'))
      fieldsToRequest.push('description');
    if (!fieldsToRequest.includes('status')) fieldsToRequest.push('status');
    if (!fieldsToRequest.includes(sprintFieldId))
      fieldsToRequest.push(sprintFieldId);

    let allTickets: SimplifiedIssue[] = [];
    let nextPageToken: string | undefined;

    // Paginate through results
    while (true) {
      const response =
        await client.issueSearch.searchForIssuesUsingJqlEnhancedSearch({
          jql: params.jql,
          fields: fieldsToRequest,
          nextPageToken,
          maxResults,
        });

      const issues = response.issues || [];
      if (!issues.length) break;

      const simplifiedIssues = issues.map((issue) =>
        simplifyIssue(issue, sprintFieldId, fieldsToRequest),
      );

      allTickets = allTickets.concat(simplifiedIssues);

      // Check pagination
      if (params.maxResults && allTickets.length >= params.maxResults) {
        allTickets = allTickets.slice(0, params.maxResults);
        break;
      }

      if (!response.nextPageToken) break;
      nextPageToken = response.nextPageToken;
    }

    return { success: true, data: allTickets };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to fetch JIRA tickets: ${error?.message || 'Unknown error'}`,
    };
  }
};

/**
 * Simplify a raw Jira issue response
 */
const simplifyIssue = (
  issue: any,
  sprintFieldId: string,
  fieldsRequested: string[],
): SimplifiedIssue => {
  const fields = issue.fields || {};
  const descriptionText = fields.description
    ? adfToText(fields.description)
    : undefined;
  const sprintInfo = processSprintField(fields[sprintFieldId]);

  const curated: Record<string, any> = {};
  fieldsRequested.forEach((fieldName) => {
    if (!fields.hasOwnProperty(fieldName)) return;

    if (fieldName === 'description') {
      curated.descriptionText = descriptionText;
    } else if (fieldName === 'status' && fields.status?.name) {
      curated.status = fields.status.name;
    } else if (fieldName === sprintFieldId) {
      curated.sprintInfo = sprintInfo;
    } else {
      curated[fieldName] = fields[fieldName];
    }
  });

  return {
    id: issue.id,
    key: issue.key,
    self: issue.self,
    summary: curated.summary || fields.summary,
    status: curated.status,
    sprintInfo: curated.sprintInfo,
    descriptionText: curated.descriptionText,
    ...Object.fromEntries(
      Object.entries(curated).filter(
        ([key]) =>
          !['summary', 'status', 'sprintInfo', 'descriptionText'].includes(key),
      ),
    ),
  };
};

// ============================================================================
// Get Ticket by ID/Key
// ============================================================================

/**
 * Get a specific ticket by ID or key
 */
export const getTicketById = async (
  companyId: string,
  issueIdOrKey: string,
  fieldsToFetch?: string[],
): Promise<Result<any>> => {
  try {
    const client = await initializeClient(companyId);
    const sprintFieldId = await getSprintFieldId(companyId);

    // Build fields list
    let fieldsParameter: string[];
    if (fieldsToFetch?.length) {
      fieldsParameter = fieldsToFetch;
      if (!fieldsParameter.includes(sprintFieldId)) {
        fieldsParameter.push(sprintFieldId);
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
        sprintFieldId,
      ];
    }

    const issue = await client.issues.getIssue({
      issueIdOrKey,
      fields: fieldsParameter,
    });

    const descriptionText = issue.fields?.description
      ? adfToText(issue.fields.description)
      : undefined;
    const sprintInfo = processSprintField(issue.fields?.[sprintFieldId]);

    // Simplify field values for common fields
    const isDefaultRequest = !fieldsToFetch?.length;
    const curatedFields: Record<string, any> = {};

    if (issue.fields) {
      for (const fieldName of fieldsParameter) {
        if (!issue.fields.hasOwnProperty(fieldName)) continue;

        let fieldValue = issue.fields[fieldName];

        if (isDefaultRequest) {
          // Simplify nested objects for common fields
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
          else if (fieldName === 'project' && fieldValue?.name) {
            fieldValue = { key: fieldValue.key, name: fieldValue.name };
          } else if (fieldName === 'labels' && Array.isArray(fieldValue)) {
            fieldValue = fieldValue.map((label: any) =>
              typeof label === 'object' ? label.name || label : label,
            );
          } else if (fieldName === sprintFieldId) {
            fieldValue = sprintInfo;
          }
        } else if (fieldName === sprintFieldId) {
          fieldValue = sprintInfo;
        }

        curatedFields[fieldName] = fieldValue;
      }

      // Add description text
      if (
        fieldsParameter.includes('description') &&
        descriptionText !== undefined
      ) {
        curatedFields.descriptionText = descriptionText;
        if (isDefaultRequest) delete curatedFields.description;
      }

      // Ensure sprint info is accessible
      if (fieldsParameter.includes(sprintFieldId) && sprintInfo !== null) {
        curatedFields.sprintInfo = sprintInfo;
      }
    }

    return {
      success: true,
      data: {
        id: issue.id,
        key: issue.key,
        self: issue.self,
        fields: curatedFields,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to fetch JIRA ticket: ${error?.message || 'Unknown error'}`,
    };
  }
};

// ============================================================================
// Update Ticket
// ============================================================================

/**
 * Update a ticket's fields
 */
export const updateTicket = async (
  companyId: string,
  issueIdOrKey: string,
  fields: Record<string, any>,
): Promise<Result<{ id: string; message: string }>> => {
  try {
    const client = await initializeClient(companyId);
    const fieldsToUpdate = { ...fields };

    // Convert markdown description to ADF
    if (
      fieldsToUpdate.description &&
      typeof fieldsToUpdate.description === 'string'
    ) {
      fieldsToUpdate.description = markdownToAdf(fieldsToUpdate.description);
    }

    // Handle sprint field mapping
    if (fieldsToUpdate.sprint !== undefined) {
      const sprintFieldId = await getSprintFieldId(companyId);
      if (sprintFieldId !== 'sprint') {
        fieldsToUpdate[sprintFieldId] = fieldsToUpdate.sprint;
        delete fieldsToUpdate.sprint;
      }
    }

    await client.issues.editIssue({
      issueIdOrKey,
      fields: fieldsToUpdate,
    });

    return {
      success: true,
      data: {
        id: issueIdOrKey,
        message: `Ticket ${issueIdOrKey} updated successfully.`,
      },
    };
  } catch (error: any) {
    const errorDetails = error?.response?.data || error?.response || error;
    const errorMessages = errorDetails?.errorMessages || [];
    const fieldErrors = errorDetails?.errors || {};

    let errorMessage = error?.message || 'Unknown error';
    if (errorMessages.length > 0) {
      errorMessage = errorMessages.join(', ');
    }
    if (Object.keys(fieldErrors).length > 0) {
      errorMessage = Object.entries(fieldErrors)
        .map(([field, msg]) => `${field}: ${msg}`)
        .join('; ');
    }

    return {
      success: false,
      error: `Failed to update JIRA ticket: ${errorMessage}`,
    };
  }
};

// ============================================================================
// Delete Ticket
// ============================================================================

/**
 * Delete a ticket permanently
 */
export const deleteTicket = async (
  companyId: string,
  issueIdOrKey: string,
  deleteSubtasks: boolean = false,
): Promise<Result<{ message: string }>> => {
  try {
    const client = await initializeClient(companyId);

    await client.issues.deleteIssue({
      issueIdOrKey,
      deleteSubtasks,
    });

    return {
      success: true,
      data: { message: `Ticket ${issueIdOrKey} has been permanently deleted.` },
    };
  } catch (error: any) {
    const errorDetails = error?.response?.data || error?.response || error;
    const errorMessage =
      errorDetails?.errorMessages?.join(', ') ||
      (errorDetails?.errors ? JSON.stringify(errorDetails.errors) : null) ||
      error?.message ||
      'Unknown error';

    return {
      success: false,
      error: `Failed to delete JIRA ticket ${issueIdOrKey}: ${errorMessage}`,
    };
  }
};

// ============================================================================
// Comments
// ============================================================================

/**
 * Add a comment to a ticket
 */
export const addComment = async (
  companyId: string,
  issueIdOrKey: string,
  commentBody: string,
): Promise<Result<Comment>> => {
  try {
    const client = await initializeClient(companyId);

    const comment = await client.issueComments.addComment({
      issueIdOrKey,
      comment: markdownToAdf(commentBody) as any,
    });

    return { success: true, data: comment as Comment };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to add comment: ${error?.message || 'Unknown error'}`,
    };
  }
};

/**
 * Get comments for a ticket
 */
export const getComments = async (
  companyId: string,
  issueIdOrKey: string,
  options?: {
    startAt?: number;
    maxResults?: number;
    orderBy?: string;
    expand?: string;
  },
): Promise<Result<PageOfComments>> => {
  try {
    const client = await initializeClient(companyId);

    const comments = await client.issueComments.getComments({
      issueIdOrKey,
      startAt: options?.startAt,
      maxResults: options?.maxResults,
      orderBy: options?.orderBy,
      expand: options?.expand,
    });

    // Add plaintext body to each comment
    if (comments.comments) {
      comments.comments.forEach((comment: any) => {
        if (comment.body && typeof comment.body === 'object') {
          comment.bodyText = adfToText(comment.body);
        }
      });
    }

    return { success: true, data: comments };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to fetch comments: ${error?.message || 'Unknown error'}`,
    };
  }
};

// ============================================================================
// Transitions
// ============================================================================

/**
 * Get available transitions for a ticket
 */
export const getAvailableTransitions = async (
  companyId: string,
  issueIdOrKey: string,
): Promise<Result<any[]>> => {
  try {
    const client = await initializeClient(companyId);

    const response = await client.issues.getTransitions({ issueIdOrKey });

    if (!response?.transitions) {
      return {
        success: false,
        error: `No transitions found for issue ${issueIdOrKey}.`,
      };
    }

    return { success: true, data: response.transitions };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to get transitions: ${error?.message || 'Unknown error'}`,
    };
  }
};

/**
 * Transition a ticket to a new status
 */
export const transitionTicket = async (
  companyId: string,
  issueIdOrKey: string,
  transitionId: string,
  options?: {
    comment?: string;
    fields?: Record<string, any>;
  },
): Promise<Result<any[]>> => {
  try {
    const client = await initializeClient(companyId);

    const payload: any = { transition: { id: transitionId } };

    if (options?.comment) {
      payload.update = { comment: [{ add: markdownToAdf(options.comment) }] };
    }
    if (options?.fields) {
      payload.fields = options.fields;
    }

    await client.issues.doTransition({
      issueIdOrKey,
      transition: payload.transition,
      fields: payload.fields,
      update: payload.update,
    });

    // Get updated transitions
    const newTransitions = await getAvailableTransitions(
      companyId,
      issueIdOrKey,
    );

    return {
      success: true,
      message: `Issue ${issueIdOrKey} transitioned successfully.`,
      data: newTransitions.data || [],
    };
  } catch (error: any) {
    let detailedError = '';
    if (error.response?.data?.errorMessages) {
      detailedError = error.response.data.errorMessages.join('; ');
    } else if (error.response?.data?.errors) {
      detailedError = Object.entries(error.response.data.errors)
        .map(([key, value]) => `${key}: ${value}`)
        .join('; ');
    }

    return {
      success: false,
      error: `Failed to transition issue: ${detailedError || error?.message || 'Unknown error'}`,
    };
  }
};

// ============================================================================
// Story Points
// ============================================================================

/**
 * Set story points for a ticket
 */
export const setStoryPoints = async (
  companyId: string,
  issueIdOrKey: string,
  storyPoints: number | null,
  boardId?: string,
): Promise<Result<{ id: string; message: string }>> => {
  const storyPointsFieldId = await findStoryPointsFieldId(companyId);

  if (!storyPointsFieldId) {
    return {
      success: false,
      error:
        'Could not determine the Story Points field ID. Please ensure the field exists.',
    };
  }

  // Try standard update first
  const result = await updateTicket(companyId, issueIdOrKey, {
    [storyPointsFieldId]: storyPoints,
  });

  if (result.success) {
    return {
      success: true,
      data: result.data,
      message: `Story points for ${issueIdOrKey} set to ${storyPoints === null ? 'cleared' : storyPoints}.`,
    };
  }

  // If standard update fails with screen error, try Agile API
  if (
    result.error?.includes('not on the appropriate screen') ||
    result.error?.includes('cannot be set')
  ) {
    const agileResult = await setStoryPointsViaAgileApi(
      companyId,
      issueIdOrKey,
      storyPoints,
      boardId,
    );

    if (agileResult.success) {
      return agileResult;
    }

    return {
      success: false,
      error: `Failed to set story points. Standard API: ${result.error}. Agile API: ${agileResult.error}`,
    };
  }

  return result;
};

/**
 * Set story points via the Jira Agile API (for boards where standard update doesn't work)
 */
const setStoryPointsViaAgileApi = async (
  companyId: string,
  issueIdOrKey: string,
  storyPoints: number | null,
  boardId?: string,
): Promise<Result<{ id: string; message: string }>> => {
  try {
    const client = await initializeClient(companyId);
    let resolvedBoardId = boardId;

    // Try to find board from issue's project
    if (!resolvedBoardId) {
      const issueResponse = await client.issues.getIssue({
        issueIdOrKey,
        fields: ['project'],
      });
      const projectKey = issueResponse.fields?.project?.key;

      if (projectKey) {
        const boardsResult = await getBoardsForProject(companyId, projectKey);
        if (boardsResult.success && boardsResult.data?.boards?.length) {
          const scrumBoard = boardsResult.data.boards.find(
            (b) => b.type === 'scrum',
          );
          resolvedBoardId = (
            scrumBoard?.id || boardsResult.data.boards[0].id
          ).toString();
        }
      }
    }

    if (!resolvedBoardId) {
      return {
        success: false,
        error: 'Could not determine board ID for Agile API.',
      };
    }

    await executeJiraRequest(
      client,
      {
        method: 'PUT',
        url: `/rest/agile/1.0/issue/${issueIdOrKey}/estimation`,
        params: { boardId: resolvedBoardId },
        data: { value: storyPoints === null ? null : storyPoints.toString() },
      },
      `Failed to set estimation for ${issueIdOrKey}`,
    );

    return {
      success: true,
      data: {
        id: issueIdOrKey,
        message: `Story points set to ${storyPoints === null ? 'cleared' : storyPoints} (via Agile API).`,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Unknown error using Agile API',
    };
  }
};

// ============================================================================
// Get Issues for Sprint
// ============================================================================

/**
 * Get issues assigned to a specific sprint
 */
export const getIssuesForSprint = async (
  companyId: string,
  sprintId: string,
  options?: {
    projectKey?: string;
    assigneeAccountId?: string;
    maxResults?: number;
    startAt?: number;
    fieldsToFetch?: string[];
  },
): Promise<Result<{ issues: SimplifiedIssue[]; total?: number }>> => {
  const sprintIdNumber = parseInt(sprintId, 10);
  if (isNaN(sprintIdNumber)) {
    return { success: false, error: 'Invalid sprintId. It must be a number.' };
  }

  try {
    const client = await initializeClient(companyId);
    const maxResults = options?.maxResults || 50;
    const startAt = options?.startAt || 0;
    const sprintFieldId = await getSprintFieldId(companyId);

    const defaultFields = [
      'summary',
      'status',
      'description',
      'assignee',
      'issuetype',
      'priority',
      sprintFieldId,
    ];
    const fieldsToRequest = options?.fieldsToFetch?.length
      ? options.fieldsToFetch
      : defaultFields;

    // Build JQL filter
    const jqlParts: string[] = [];
    if (options?.projectKey) jqlParts.push(`project = ${options.projectKey}`);
    if (options?.assigneeAccountId)
      jqlParts.push(`assignee = "${options.assigneeAccountId}"`);
    const jql = jqlParts.length > 0 ? jqlParts.join(' AND ') : undefined;

    const response = await executeJiraRequest<any>(
      client,
      {
        method: 'GET',
        url: `/rest/agile/1.0/sprint/${sprintIdNumber}/issue`,
        params: {
          startAt,
          maxResults,
          fields: fieldsToRequest.join(','),
          jql,
        },
      },
      `Failed to get issues for sprint ${sprintId}`,
    );

    const issues = response.issues || [];

    if (!issues.length && response.total === 0) {
      return {
        success: true,
        data: { issues: [] },
        message: `No issues found for sprint ${sprintId}.`,
      };
    }

    const simplifiedIssues = issues.map((issue: any) =>
      simplifySprintIssue(issue, sprintFieldId, fieldsToRequest),
    );

    return {
      success: true,
      data: {
        issues: simplifiedIssues,
        total: response.total,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to get issues for sprint ${sprintId}: ${error.message || 'Unknown error'}`,
    };
  }
};

/**
 * Simplify sprint issue response
 */
const simplifySprintIssue = (
  issue: any,
  sprintFieldId: string,
  fieldsRequested: string[],
): SimplifiedIssue => {
  const fields = issue.fields || {};
  const descriptionText = fields.description
    ? adfToText(fields.description)
    : undefined;

  const curated: Record<string, any> = {};
  fieldsRequested.forEach((fieldName) => {
    if (!fields.hasOwnProperty(fieldName)) return;

    if (fieldName === 'description') {
      curated.descriptionText = descriptionText;
    } else if (fieldName === 'status' && fields.status?.name) {
      curated.status = fields.status.name;
    } else if (fieldName === 'assignee' && fields.assignee) {
      curated.assignee = fields.assignee.displayName;
      curated.assigneeAccountId = fields.assignee.accountId;
    } else if (fieldName === 'issuetype' && fields.issuetype?.name) {
      curated.issuetype = fields.issuetype.name;
    } else if (fieldName === 'priority' && fields.priority?.name) {
      curated.priority = fields.priority.name;
    } else if (fieldName === sprintFieldId) {
      curated.sprintInfo = fields[sprintFieldId];
    } else {
      curated[fieldName] = fields[fieldName];
    }
  });

  return {
    id: issue.id,
    key: issue.key,
    summary: fields.summary,
    ...curated,
  };
};
