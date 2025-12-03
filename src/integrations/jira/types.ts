/**
 * Jira Integration Types
 * Centralized type definitions for the Jira integration module
 */

import { Version3Models } from 'jira.js';

// ============================================================================
// Core Result Types
// ============================================================================

/**
 * Standard result wrapper for all Jira operations
 * Follows the Result pattern for consistent error handling
 */
export interface Result<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ============================================================================
// Board Types
// ============================================================================

export interface JiraBoard {
  id: number;
  self: string;
  name: string;
  type: string; // 'scrum', 'kanban', etc.
  location?: {
    projectId?: number;
    projectKey?: string;
    projectName?: string;
  };
}

export interface BoardResolutionResult {
  board?: JiraBoard;
  ambiguousBoards?: JiraBoard[];
}

// ============================================================================
// Sprint Types
// ============================================================================

export interface JiraSprint {
  id: number;
  self?: string;
  state: 'active' | 'future' | 'closed' | string;
  name: string;
  startDate?: string;
  endDate?: string;
  completeDate?: string;
  originBoardId?: number;
  goal?: string;
}

export interface SprintListResult {
  sprints: JiraSprint[];
  maxResults?: number;
  startAt?: number;
  isLast?: boolean;
  total?: number;
}

export type SprintState = 'active' | 'future' | 'closed' | string;

// ============================================================================
// Ticket/Issue Types
// ============================================================================

export interface SimplifiedIssue {
  id: string;
  key: string;
  self?: string;
  summary?: string;
  status?: string;
  sprintInfo?: SprintInfo | SprintInfo[] | null;
  descriptionText?: string;
  [key: string]: any; // For dynamic fields
}

export interface SprintInfo {
  id: number;
  name: string;
  state: string;
  boardId?: number;
  goal?: string;
  startDate?: string;
  endDate?: string;
}

export interface IssueFields {
  summary?: string;
  description?: any; // ADF format
  status?: { name: string; [key: string]: any };
  assignee?: { displayName?: string; accountId?: string; [key: string]: any };
  reporter?: { displayName?: string; accountId?: string; [key: string]: any };
  issuetype?: { name: string; [key: string]: any };
  priority?: { name: string; [key: string]: any };
  project?: { key: string; name: string; [key: string]: any };
  labels?: string[];
  resolution?: { name: string } | null;
  duedate?: string;
  created?: string;
  updated?: string;
  [key: string]: any; // For custom fields
}

// ============================================================================
// Transition Types
// ============================================================================

export interface JiraTransitionStatus {
  self: string;
  description: string;
  iconUrl: string;
  name: string;
  id: string;
  statusCategory: {
    self: string;
    id: number;
    key: string;
    colorName: string;
    name: string;
  };
}

export interface JiraTransition {
  id: string;
  name: string;
  to: JiraTransitionStatus;
  hasScreen: boolean;
  isGlobal: boolean;
  isInitial: boolean;
  isAvailable: boolean;
  isConditional: boolean;
  isLooped?: boolean;
}

// ============================================================================
// User Types
// ============================================================================

export interface SimplifiedUser {
  accountId: string;
  displayName?: string;
  emailAddress?: string;
}

// ============================================================================
// Velocity & Progress Types
// ============================================================================

export interface VelocityData {
  boardId: number;
  sprintCount: number;
  averageVelocity: number;
  sprints: Array<{
    id: number;
    name: string;
    completedPoints: number;
    completedIssues: number;
    startDate?: string;
    endDate?: string;
    completeDate?: string;
  }>;
  trend: 'increasing' | 'decreasing' | 'stable';
}

export interface SprintProgressData {
  sprintId: number;
  sprintName: string;
  state: string;
  startDate?: string;
  endDate?: string;
  daysRemaining: number;
  totalIssues: number;
  completedIssues: number;
  totalPoints: number;
  completedPoints: number;
  progressPercent: number;
  pointsProgressPercent: number;
  issuesByStatus: Record<string, number>;
  atRiskIssues: Array<{
    key: string;
    summary: string;
    status: string;
    assignee?: string;
    daysSinceUpdate: number;
  }>;
}

// ============================================================================
// Action Parameter Types (for jira.actions.ts)
// ============================================================================

export interface CreateTicketParams {
  summary: string;
  description: string;
  projectKey: string;
  issueType?: string;
}

export interface FetchTicketsParams {
  jql?: string;
  maxResults?: number;
  fieldsToFetch?: string[];
}

export interface GetTicketParams {
  issueIdOrKey: string;
  fieldsToFetch?: string[];
}

export interface AddCommentParams {
  issueIdOrKey: string;
  commentBody: string;
}

export interface UpdateTicketParams {
  issueIdOrKey: string;
  fields: Record<string, any>;
}

export interface DeleteTicketParams {
  issueIdOrKey: string;
  deleteSubtasks?: boolean;
}

export interface AssignTicketParams {
  issueIdOrKey: string;
  accountId: string | null;
}

export interface SearchUsersParams {
  query?: string;
  startAt?: number;
  maxResults?: number;
  accountId?: string;
}

export interface GetSprintsParams {
  boardId: string;
  state?: SprintState;
  startAt?: number;
  maxResults?: number;
}

export interface GetIssuesForSprintParams {
  sprintId: string;
  projectKey?: string;
  maxResults?: number;
  startAt?: number;
  fieldsToFetch?: string[];
  assigneeAccountId?: string;
}

export interface MoveIssueToSprintParams {
  issueKey: string;
  targetSprintId: string;
}

export interface TransitionIssueParams {
  issueIdOrKey: string;
  transitionId: string;
  comment?: string;
  fields?: Record<string, any>;
}

export interface SetStoryPointsParams {
  issueIdOrKey: string;
  storyPoints: number | null;
  boardId?: string;
}

export interface GetTicketCommentsParams {
  issueIdOrKey: string;
  startAt?: number;
  maxResults?: number;
  orderBy?: string;
  expand?: string;
}

// ============================================================================
// Target Sprint Descriptor (for moveIssuesToProjectSprint)
// ============================================================================

export type TargetSprintDescriptor =
  | { type: 'active' }
  | { type: 'next' }
  | { type: 'sprintId'; value: string }
  | { type: 'sprintName'; value: string };

export interface MoveIssuesToProjectSprintParams {
  projectKey?: string;
  boardId?: string;
  issueKeys?: string[];
  targetSprintDescriptor: TargetSprintDescriptor;
  jqlQueryForIssues?: string;
}

// ============================================================================
// Re-exports from jira.js for convenience
// ============================================================================

export type CreatedIssue = Version3Models.CreatedIssue;
export type Comment = Version3Models.Comment;
export type PageOfComments = Version3Models.PageOfComments;
export type User = Version3Models.User;
