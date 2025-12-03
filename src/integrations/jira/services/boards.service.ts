/**
 * Jira Boards Service
 * Handles board discovery and resolution for projects
 */

import { initializeClient, executeJiraRequest } from '../client';
import { Result, JiraBoard, BoardResolutionResult } from '../types';

// ============================================================================
// Get Boards for Project
// ============================================================================

/**
 * Get all boards associated with a project
 * @param companyId - Company ID for credentials
 * @param projectKey - The project key (e.g., "PROJ")
 */
export const getBoardsForProject = async (
  companyId: string,
  projectKey: string,
): Promise<Result<{ boards: JiraBoard[] }>> => {
  try {
    const client = await initializeClient(companyId);

    const response = await executeJiraRequest<any>(
      client,
      {
        method: 'GET',
        url: '/rest/agile/1.0/board',
        params: {
          projectKeyOrId: projectKey,
          maxResults: 50,
        },
      },
      `Failed to get boards for project ${projectKey}`,
    );

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
      error: `Failed to get boards for project ${projectKey}: ${error.message || 'Unknown error'}`,
    };
  }
};

// ============================================================================
// Resolve Board for Project
// ============================================================================

/**
 * Resolve the most appropriate board for a project
 * Prefers Scrum boards; handles ambiguous cases by returning multiple options
 */
export const resolveBoardForProject = async (
  companyId: string,
  projectKey: string,
): Promise<Result<BoardResolutionResult>> => {
  const boardsResult = await getBoardsForProject(companyId, projectKey);

  if (!boardsResult.success || !boardsResult.data) {
    return {
      success: false,
      error: boardsResult.error || 'Failed to retrieve boards for project.',
    };
  }

  const allBoards = boardsResult.data.boards;

  // No boards found
  if (allBoards.length === 0) {
    return {
      success: false,
      error: `No agile boards found for project ${projectKey}.`,
    };
  }

  // Filter for Scrum boards
  const scrumBoards = allBoards.filter(
    (b) => b.type?.toLowerCase() === 'scrum',
  );

  // Single Scrum board - ideal case
  if (scrumBoards.length === 1) {
    return { success: true, data: { board: scrumBoards[0] } };
  }

  // Multiple Scrum boards - ambiguous, return all for user selection
  if (scrumBoards.length > 1) {
    return {
      success: true,
      message: `Multiple Scrum boards found for project ${projectKey}.`,
      data: { ambiguousBoards: scrumBoards },
    };
  }

  // No Scrum boards, but other board types exist
  if (allBoards.length === 1) {
    return {
      success: true,
      data: { board: allBoards[0] },
      message: `Found one board of type '${allBoards[0].type}'. Using this board.`,
    };
  }

  // Multiple non-Scrum boards - ambiguous
  return {
    success: true,
    message: `No Scrum boards found, but other types exist for project ${projectKey}.`,
    data: { ambiguousBoards: allBoards },
  };
};

// ============================================================================
// Board Utilities
// ============================================================================

/**
 * Create a minimal board object from an ID (for cases where full board data isn't needed)
 */
export const createBoardFromId = (boardId: string | number): JiraBoard => {
  const id = typeof boardId === 'string' ? parseInt(boardId, 10) : boardId;
  return {
    id,
    name: `Board ${boardId}`,
    type: 'unknown',
    self: '',
  };
};

/**
 * Validate that a board ID is numeric
 */
export const validateBoardId = (boardId: string): Result<number> => {
  const boardIdNumber = parseInt(boardId, 10);
  if (isNaN(boardIdNumber)) {
    return {
      success: false,
      error: `Invalid boardId: ${boardId}. It must be a number.`,
    };
  }
  return { success: true, data: boardIdNumber };
};
