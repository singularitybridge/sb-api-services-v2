/**
 * Jira Velocity Service
 * Handles velocity calculations and sprint progress tracking
 */

import { Result, VelocityData, SprintProgressData } from '../types';
import { getSprintsForBoard } from './sprints.service';
import { fetchTickets } from './tickets.service';
import { findStoryPointsFieldId } from './fields.service';

// ============================================================================
// Board Velocity
// ============================================================================

/**
 * Get velocity data for a board by analyzing completed story points in closed sprints
 */
export const getBoardVelocity = async (
  companyId: string,
  boardId: string,
  sprintCount: number = 3,
): Promise<Result<VelocityData>> => {
  try {
    // Get closed sprints for the board
    const sprintsResult = await getSprintsForBoard(
      companyId,
      boardId,
      'closed',
      0,
      sprintCount + 5, // Get extra in case some have no data
    );

    if (!sprintsResult.success || !sprintsResult.data) {
      return {
        success: false,
        error: sprintsResult.error || 'Failed to fetch closed sprints',
      };
    }

    // Filter and sort by completion date
    const closedSprints = sprintsResult.data.sprints
      .filter((s) => s.completeDate)
      .sort(
        (a, b) =>
          new Date(b.completeDate!).getTime() - new Date(a.completeDate!).getTime(),
      )
      .slice(0, sprintCount);

    if (closedSprints.length === 0) {
      return {
        success: true,
        data: {
          boardId: parseInt(boardId, 10),
          sprintCount: 0,
          averageVelocity: 0,
          sprints: [],
          trend: 'stable',
        },
      };
    }

    // Get story points field ID
    const storyPointsFieldId = await findStoryPointsFieldId(companyId);

    // Calculate velocity for each sprint
    const sprintVelocities: VelocityData['sprints'] = [];

    for (const sprint of closedSprints) {
      // Fetch completed issues in this sprint
      const fieldsToFetch = storyPointsFieldId
        ? ['key', 'summary', storyPointsFieldId]
        : ['key', 'summary'];

      const issuesResult = await fetchTickets(companyId, {
        jql: `sprint = ${sprint.id} AND status = Done`,
        fieldsToFetch,
        maxResults: 100,
      });

      let completedPoints = 0;
      let completedIssues = 0;

      if (issuesResult.success && issuesResult.data) {
        completedIssues = issuesResult.data.length;

        for (const issue of issuesResult.data) {
          const fields = (issue as any).fields || issue;
          const points = storyPointsFieldId
            ? fields[storyPointsFieldId]
            : fields.customfield_10016 || fields.storyPoints || 0;

          if (typeof points === 'number') {
            completedPoints += points;
          }
        }
      }

      sprintVelocities.push({
        id: sprint.id,
        name: sprint.name,
        completedPoints,
        completedIssues,
        startDate: sprint.startDate,
        endDate: sprint.endDate,
        completeDate: sprint.completeDate,
      });
    }

    // Calculate average velocity
    const totalPoints = sprintVelocities.reduce((sum, s) => sum + s.completedPoints, 0);
    const averageVelocity =
      sprintVelocities.length > 0
        ? Math.round((totalPoints / sprintVelocities.length) * 10) / 10
        : 0;

    // Determine trend (compare recent vs older)
    let trend: VelocityData['trend'] = 'stable';
    if (sprintVelocities.length >= 2) {
      const midpoint = Math.floor(sprintVelocities.length / 2);
      const recentAvg =
        sprintVelocities.slice(0, midpoint).reduce((sum, s) => sum + s.completedPoints, 0) /
        midpoint;
      const olderAvg =
        sprintVelocities.slice(midpoint).reduce((sum, s) => sum + s.completedPoints, 0) /
        (sprintVelocities.length - midpoint);

      const diff = recentAvg - olderAvg;
      if (diff > averageVelocity * 0.1) {
        trend = 'increasing';
      } else if (diff < -averageVelocity * 0.1) {
        trend = 'decreasing';
      }
    }

    return {
      success: true,
      data: {
        boardId: parseInt(boardId, 10),
        sprintCount: sprintVelocities.length,
        averageVelocity,
        sprints: sprintVelocities,
        trend,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to calculate velocity: ${error?.message || 'Unknown error'}`,
    };
  }
};

// ============================================================================
// Sprint Progress
// ============================================================================

/**
 * Get progress data for a sprint including completion stats and at-risk items
 */
export const getSprintProgress = async (
  companyId: string,
  sprintId: string,
): Promise<Result<SprintProgressData>> => {
  const sprintIdNumber = parseInt(sprintId, 10);
  if (isNaN(sprintIdNumber)) {
    return { success: false, error: 'Invalid sprintId. It must be a number.' };
  }

  try {
    // Get story points field ID
    const storyPointsFieldId = await findStoryPointsFieldId(companyId);

    // Fetch all issues in the sprint
    const fieldsToFetch = ['key', 'summary', 'status', 'assignee', 'updated'];
    if (storyPointsFieldId) {
      fieldsToFetch.push(storyPointsFieldId);
    }

    const issuesResult = await fetchTickets(companyId, {
      jql: `sprint = ${sprintId}`,
      fieldsToFetch,
      maxResults: 200,
    });

    if (!issuesResult.success || !issuesResult.data) {
      return {
        success: false,
        error: issuesResult.error || 'Failed to fetch sprint issues',
      };
    }

    const issues = issuesResult.data;
    const now = new Date();

    // Aggregate data
    let totalPoints = 0;
    let completedPoints = 0;
    let completedIssues = 0;
    const issuesByStatus: Record<string, number> = {};
    const atRiskIssues: SprintProgressData['atRiskIssues'] = [];

    for (const issue of issues) {
      const fields = (issue as any).fields || issue;
      const statusName = fields.status || 'Unknown';
      const isDone =
        statusName.toLowerCase() === 'done' ||
        statusName.toLowerCase() === 'closed' ||
        statusName.toLowerCase() === 'completed';

      // Count by status
      issuesByStatus[statusName] = (issuesByStatus[statusName] || 0) + 1;

      if (isDone) {
        completedIssues++;
      }

      // Sum story points
      const points = storyPointsFieldId
        ? fields[storyPointsFieldId]
        : fields.customfield_10016 || 0;

      if (typeof points === 'number') {
        totalPoints += points;
        if (isDone) {
          completedPoints += points;
        }
      }

      // Check for at-risk issues (not done and no update in 3+ days)
      const updatedField = fields.updated;
      if (!isDone && updatedField) {
        const updatedDate = new Date(updatedField);
        const daysSinceUpdate = Math.floor(
          (now.getTime() - updatedDate.getTime()) / (1000 * 60 * 60 * 24),
        );

        if (daysSinceUpdate >= 3) {
          atRiskIssues.push({
            key: issue.key,
            summary: fields.summary || issue.summary || '',
            status: statusName,
            assignee: fields.assignee,
            daysSinceUpdate,
          });
        }
      }
    }

    // Calculate progress percentages
    const progressPercent =
      issues.length > 0 ? Math.round((completedIssues / issues.length) * 100) : 0;
    const pointsProgressPercent =
      totalPoints > 0 ? Math.round((completedPoints / totalPoints) * 100) : 0;

    return {
      success: true,
      data: {
        sprintId: sprintIdNumber,
        sprintName: `Sprint ${sprintId}`,
        state: 'active',
        daysRemaining: 0,
        totalIssues: issues.length,
        completedIssues,
        totalPoints,
        completedPoints,
        progressPercent,
        pointsProgressPercent,
        issuesByStatus,
        atRiskIssues: atRiskIssues.sort((a, b) => b.daysSinceUpdate - a.daysSinceUpdate),
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to get sprint progress: ${error?.message || 'Unknown error'}`,
    };
  }
};
