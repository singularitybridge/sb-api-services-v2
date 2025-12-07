/**
 * Jira Service - Backwards Compatible Facade
 *
 * This module provides backwards compatibility by wrapping the new modular services.
 * New code should import directly from the services/* modules.
 *
 * Structure:
 * - types.ts - Type definitions
 * - client.ts - Client initialization
 * - utils/adf.ts - ADF conversion utilities
 * - services/boards.service.ts - Board operations
 * - services/sprints.service.ts - Sprint operations
 * - services/tickets.service.ts - Ticket operations
 * - services/users.service.ts - User operations
 * - services/fields.service.ts - Field discovery
 * - services/velocity.service.ts - Velocity and progress
 */

// Re-export types
export * from './types';

// Re-export utilities
export { markdownToAdf, adfToText } from './utils/adf';

// Re-export services (for direct access)
export * from './services';

// Import for wrapper functions
import {
  // Boards
  getBoardsForProject as _getBoardsForProject,
  resolveBoardForProject as _resolveBoardForProject,

  // Sprints
  getSprintsForBoard as _getSprintsForBoard,
  getSprintsForResolvedBoard as _getSprintsForResolvedBoard,
  getActiveSprintForBoard as _getActiveSprintForBoard,
  moveIssueToSprint as _moveIssueToSprint,
  moveIssueToBacklog as _moveIssueToBacklog,
  addIssueToCurrentSprint,

  // Tickets
  createTicket,
  fetchTickets as _fetchTickets,
  getTicketById,
  updateTicket as _updateTicket,
  deleteTicket as _deleteTicket,
  addComment,
  getComments,
  getAvailableTransitions as _getAvailableTransitions,
  transitionTicket,
  setStoryPoints as _setStoryPoints,
  getIssuesForSprint as _getIssuesForSprint,

  // Users
  searchUsers as _searchUsers,
  assignTicket,

  // Fields
  getJiraFields,
  findSprintFieldId as _findSprintFieldId,

  // Velocity
  getBoardVelocity as _getBoardVelocity,
  getSprintProgress as _getSprintProgress,
} from './services';

import {
  JiraBoard,
  Result,
  JiraSprint,
  VelocityData,
  SprintProgressData,
} from './types';

// ============================================================================
// Backwards Compatible Wrapper Functions
// These maintain the original signatures (sessionId, companyId, params)
// ============================================================================

// --- Tickets ---

export const createJiraTicket = async (
  sessionId: string,
  companyId: string,
  params: {
    summary: string;
    description: string;
    projectKey: string;
    issueType?: string;
  },
) => createTicket(companyId, params);

export const fetchJiraTickets = async (
  sessionId: string,
  companyId: string,
  params: {
    jql?: string;
    maxResults?: number;
    fieldsToFetch?: string[];
  },
) => _fetchTickets(companyId, { jql: params.jql || '', ...params });

export const getJiraTicketById = async (
  sessionId: string,
  companyId: string,
  params: {
    issueIdOrKey: string;
    fieldsToFetch?: string[];
  },
) => getTicketById(companyId, params.issueIdOrKey, params.fieldsToFetch);

export const updateJiraTicket = async (
  sessionId: string,
  companyId: string,
  params: {
    issueIdOrKey: string;
    fields: Record<string, any>;
  },
) => _updateTicket(companyId, params.issueIdOrKey, params.fields);

export const deleteJiraTicket = async (
  sessionId: string,
  companyId: string,
  params: {
    issueIdOrKey: string;
    deleteSubtasks?: boolean;
  },
) => _deleteTicket(companyId, params.issueIdOrKey, params.deleteSubtasks);

// --- Comments ---

export const addCommentToJiraTicket = async (
  sessionId: string,
  companyId: string,
  params: {
    issueIdOrKey: string;
    commentBody: string;
  },
) => addComment(companyId, params.issueIdOrKey, params.commentBody);

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
) =>
  getComments(companyId, params.issueIdOrKey, {
    startAt: params.startAt,
    maxResults: params.maxResults,
    orderBy: params.orderBy,
    expand: params.expand,
  });

// --- Fields ---

export const getJiraTicketFields = async (
  sessionId: string,
  companyId: string,
) => getJiraFields(companyId);

export const findSprintFieldId = async (companyId: string) =>
  _findSprintFieldId(companyId);

// --- Sprints ---

export const getSprintsForBoard = async (
  sessionId: string,
  companyId: string,
  params: {
    boardId: string;
    state?: string;
    startAt?: number;
    maxResults?: number;
  },
) =>
  _getSprintsForBoard(
    companyId,
    params.boardId,
    params.state,
    params.startAt,
    params.maxResults,
  );

export const getSprintsForResolvedBoard = async (
  companyId: string,
  board: JiraBoard,
  state?: string,
) => _getSprintsForResolvedBoard(companyId, board, state);

export const getActiveSprintForBoard = async (
  sessionId: string,
  companyId: string,
  params: { boardId: string },
) => _getActiveSprintForBoard(companyId, params.boardId);

export const addTicketToCurrentSprint = async (
  sessionId: string,
  companyId: string,
  params: {
    boardId: string;
    issueKey: string;
  },
) => addIssueToCurrentSprint(companyId, params.boardId, params.issueKey);

export const moveIssueToSprint = async (
  sessionId: string,
  companyId: string,
  params: {
    issueKey: string;
    targetSprintId: string;
  },
): Promise<Result<any>> => {
  const result = await _moveIssueToSprint(
    companyId,
    params.issueKey,
    params.targetSprintId,
  );

  if (!result.success) return result;

  // For backwards compatibility, try to get updated sprint list
  try {
    const sprintsResult = await _getSprintsForBoard(
      companyId,
      params.targetSprintId,
    );
    if (sprintsResult.success) {
      return {
        success: true,
        message: result.data?.message,
        data: {
          operationStatus: result.data?.message,
          sprintListData: sprintsResult.data,
        },
      };
    }
  } catch {
    // Ignore errors getting sprint list
  }

  return result;
};

export const moveIssueToBacklog = async (
  sessionId: string,
  companyId: string,
  params: { issueKey: string },
) => _moveIssueToBacklog(companyId, params.issueKey);

export const getIssuesForSprint = async (
  sessionId: string,
  companyId: string,
  params: {
    sprintId: string;
    projectKey?: string;
    maxResults?: number;
    startAt?: number;
    fieldsToFetch?: string[];
    assigneeAccountId?: string;
  },
) =>
  _getIssuesForSprint(companyId, params.sprintId, {
    projectKey: params.projectKey,
    assigneeAccountId: params.assigneeAccountId,
    maxResults: params.maxResults,
    startAt: params.startAt,
    fieldsToFetch: params.fieldsToFetch,
  });

// --- Boards ---

export { _getBoardsForProject as getBoardsForProject };
export { _resolveBoardForProject as resolveBoardForProject };

// --- Users ---

export const searchJiraUsers = async (
  sessionId: string,
  companyId: string,
  params: {
    query?: string;
    startAt?: number;
    maxResults?: number;
    accountId?: string;
  },
) => _searchUsers(companyId, params);

export const assignJiraTicket = async (
  sessionId: string,
  companyId: string,
  params: {
    issueIdOrKey: string;
    accountId: string | null;
  },
) => assignTicket(companyId, params.issueIdOrKey, params.accountId);

// --- Transitions ---

export const getAvailableTransitions = async (
  sessionId: string,
  companyId: string,
  params: { issueIdOrKey: string },
) => _getAvailableTransitions(companyId, params.issueIdOrKey);

export const transitionIssue = async (
  sessionId: string,
  companyId: string,
  params: {
    issueIdOrKey: string;
    transitionId: string;
    comment?: string;
    fields?: Record<string, any>;
  },
) =>
  transitionTicket(companyId, params.issueIdOrKey, params.transitionId, {
    comment: params.comment,
    fields: params.fields,
  });

// --- Story Points ---

export const setStoryPoints = async (
  sessionId: string,
  companyId: string,
  params: {
    issueIdOrKey: string;
    storyPoints: number | null;
    boardId?: string;
  },
) =>
  _setStoryPoints(
    companyId,
    params.issueIdOrKey,
    params.storyPoints,
    params.boardId,
  );

// --- Velocity & Progress ---

export const getBoardVelocity = async (
  sessionId: string,
  companyId: string,
  params: {
    boardId: string;
    sprintCount?: number;
  },
): Promise<Result<VelocityData>> =>
  _getBoardVelocity(companyId, params.boardId, params.sprintCount);

export const getSprintProgress = async (
  sessionId: string,
  companyId: string,
  params: { sprintId: string },
): Promise<Result<SprintProgressData>> =>
  _getSprintProgress(companyId, params.sprintId);

// Re-export VelocityData and SprintProgressData types explicitly for consumers
export type { VelocityData, SprintProgressData };
