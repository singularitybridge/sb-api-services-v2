/**
 * Jira Sprints Service
 * Handles sprint operations: listing, getting active sprint, moving issues to sprints
 */

import { initializeClient, executeJiraRequest } from '../client';
import {
  Result,
  JiraSprint,
  JiraBoard,
  SprintListResult,
  SprintState,
} from '../types';
import { validateBoardId } from './boards.service';

// ============================================================================
// Sprint Response Mapping
// ============================================================================

/**
 * Map raw sprint data from API to JiraSprint interface
 */
const mapSprintResponse = (
  sprint: any,
  fallbackBoardId?: number,
): JiraSprint => ({
  id: sprint.id,
  self: sprint.self,
  state: sprint.state,
  name: sprint.name,
  startDate: sprint.startDate,
  endDate: sprint.endDate,
  completeDate: sprint.completeDate,
  originBoardId: sprint.originBoardId || fallbackBoardId,
  goal: sprint.goal,
});

// ============================================================================
// Get Sprints for Board
// ============================================================================

/**
 * Get sprints for a specific board
 * @param companyId - Company ID for credentials
 * @param boardId - The board ID
 * @param state - Sprint state filter (e.g., 'active', 'future', 'closed', 'active,future')
 * @param startAt - Pagination start index
 * @param maxResults - Maximum results to return
 */
export const getSprintsForBoard = async (
  companyId: string,
  boardId: string,
  state: SprintState = 'active,future',
  startAt: number = 0,
  maxResults: number = 50,
): Promise<Result<SprintListResult>> => {
  // Validate board ID
  const validation = validateBoardId(boardId);
  if (!validation.success) {
    return { success: false, error: validation.error };
  }

  try {
    const client = await initializeClient(companyId);

    const response = await executeJiraRequest<any>(
      client,
      {
        method: 'GET',
        url: `/rest/agile/1.0/board/${validation.data}/sprint`,
        params: { state, startAt, maxResults },
      },
      `Failed to get sprints for board ${boardId}`,
    );

    if (!response || !Array.isArray(response.values)) {
      return {
        success: false,
        error: `Error fetching sprints for board ID ${boardId}. Unexpected response format.`,
      };
    }

    const sprints = response.values.map((s: any) =>
      mapSprintResponse(s, validation.data),
    );

    return {
      success: true,
      data: {
        sprints,
        maxResults: response.maxResults,
        startAt: response.startAt,
        isLast: response.isLast,
        total: response.total,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to get sprints for board ${boardId}: ${error.message || 'Unknown error'}`,
    };
  }
};

/**
 * Get sprints for a resolved board object
 * Convenience method when you already have a JiraBoard
 */
export const getSprintsForResolvedBoard = async (
  companyId: string,
  board: JiraBoard,
  state: SprintState = 'active,future',
): Promise<Result<SprintListResult>> => {
  return getSprintsForBoard(companyId, board.id.toString(), state);
};

// ============================================================================
// Get Active Sprint
// ============================================================================

/**
 * Get the active sprint for a board
 * @returns The active sprint, or error if none found
 */
export const getActiveSprintForBoard = async (
  companyId: string,
  boardId: string,
): Promise<Result<JiraSprint>> => {
  const validation = validateBoardId(boardId);
  if (!validation.success) {
    return { success: false, error: validation.error };
  }

  try {
    const client = await initializeClient(companyId);

    const response = await executeJiraRequest<any>(
      client,
      {
        method: 'GET',
        url: `/rest/agile/1.0/board/${validation.data}/sprint`,
        params: { state: 'active' },
      },
      `Failed to get active sprint for board ${boardId}`,
    );

    if (!response?.values?.length) {
      return {
        success: false,
        error: `No active sprint found for board ID ${boardId}.`,
      };
    }

    const activeSprintData = response.values[0];
    if (!activeSprintData.id || !activeSprintData.name) {
      return {
        success: false,
        error: `Active sprint data is incomplete: ${JSON.stringify(activeSprintData)}`,
      };
    }

    return {
      success: true,
      data: mapSprintResponse(activeSprintData, validation.data),
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to get active sprint for board ${boardId}: ${error.message || 'Unknown error'}`,
    };
  }
};

// ============================================================================
// Move Issues to Sprint
// ============================================================================

/**
 * Move a single issue to a sprint
 */
export const moveIssueToSprint = async (
  companyId: string,
  issueKey: string,
  targetSprintId: string,
): Promise<Result<{ message: string }>> => {
  const sprintIdNumber = parseInt(targetSprintId, 10);
  if (isNaN(sprintIdNumber)) {
    return {
      success: false,
      error: `Invalid targetSprintId: ${targetSprintId}. It must be a number.`,
    };
  }

  try {
    const client = await initializeClient(companyId);

    await executeJiraRequest(
      client,
      {
        method: 'POST',
        url: `/rest/agile/1.0/sprint/${sprintIdNumber}/issue`,
        data: { issues: [issueKey] },
      },
      `Failed to move issue ${issueKey} to sprint ${sprintIdNumber}`,
    );

    return {
      success: true,
      data: {
        message: `Issue ${issueKey} successfully moved to sprint ${targetSprintId}.`,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error:
        error.message ||
        `Failed to move issue ${issueKey} to sprint ${targetSprintId}`,
    };
  }
};

/**
 * Move multiple issues to a sprint
 */
export const moveIssuesToSprint = async (
  companyId: string,
  issueKeys: string[],
  targetSprintId: string,
): Promise<
  Result<{
    successful: string[];
    failed: Array<{ key: string; error: string }>;
  }>
> => {
  const results = await Promise.allSettled(
    issueKeys.map((key) => moveIssueToSprint(companyId, key, targetSprintId)),
  );

  const successful: string[] = [];
  const failed: Array<{ key: string; error: string }> = [];

  results.forEach((result, index) => {
    const issueKey = issueKeys[index];
    if (result.status === 'fulfilled' && result.value.success) {
      successful.push(issueKey);
    } else {
      const error =
        result.status === 'rejected'
          ? result.reason?.message || 'Unknown error'
          : result.value.error || 'Unknown error';
      failed.push({ key: issueKey, error });
    }
  });

  return {
    success: failed.length === 0,
    data: { successful, failed },
    message:
      failed.length === 0
        ? `All ${successful.length} issues moved successfully.`
        : `${successful.length} issues moved, ${failed.length} failed.`,
  };
};

// ============================================================================
// Move Issue to Backlog
// ============================================================================

/**
 * Move an issue to the backlog
 */
export const moveIssueToBacklog = async (
  companyId: string,
  issueKey: string,
): Promise<Result<{ message: string }>> => {
  try {
    const client = await initializeClient(companyId);

    await executeJiraRequest(
      client,
      {
        method: 'POST',
        url: '/rest/agile/1.0/backlog/issue',
        data: { issues: [issueKey] },
      },
      `Failed to move issue ${issueKey} to backlog`,
    );

    return {
      success: true,
      data: { message: `Issue ${issueKey} successfully moved to backlog.` },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || `Failed to move issue ${issueKey} to backlog`,
    };
  }
};

// ============================================================================
// Add Issue to Current Sprint
// ============================================================================

/**
 * Add an issue to the currently active sprint on a board
 */
export const addIssueToCurrentSprint = async (
  companyId: string,
  boardId: string,
  issueKey: string,
): Promise<
  Result<{ message: string; sprintId: number; sprintName: string }>
> => {
  // Get active sprint
  const activeSprintResult = await getActiveSprintForBoard(companyId, boardId);

  if (!activeSprintResult.success || !activeSprintResult.data) {
    return {
      success: false,
      error:
        activeSprintResult.error ||
        `No active sprint found for board ${boardId}`,
    };
  }

  const activeSprint = activeSprintResult.data;

  // Move issue to the active sprint
  const moveResult = await moveIssueToSprint(
    companyId,
    issueKey,
    activeSprint.id.toString(),
  );

  if (!moveResult.success) {
    return { success: false, error: moveResult.error };
  }

  return {
    success: true,
    data: {
      message: `Issue ${issueKey} added to sprint '${activeSprint.name}' (ID: ${activeSprint.id}).`,
      sprintId: activeSprint.id,
      sprintName: activeSprint.name,
    },
  };
};

// ============================================================================
// Get Sprint Details
// ============================================================================

/**
 * Get details for a specific sprint by ID
 */
export const getSprintById = async (
  companyId: string,
  sprintId: string,
): Promise<Result<JiraSprint>> => {
  const sprintIdNumber = parseInt(sprintId, 10);
  if (isNaN(sprintIdNumber)) {
    return {
      success: false,
      error: `Invalid sprintId: ${sprintId}. It must be a number.`,
    };
  }

  try {
    const client = await initializeClient(companyId);

    const response = await executeJiraRequest<any>(
      client,
      {
        method: 'GET',
        url: `/rest/agile/1.0/sprint/${sprintIdNumber}`,
      },
      `Failed to get sprint ${sprintId}`,
    );

    return {
      success: true,
      data: mapSprintResponse(response),
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || `Failed to get sprint ${sprintId}`,
    };
  }
};
