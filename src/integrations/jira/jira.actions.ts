import { ActionContext, FunctionFactory, FunctionDefinition, StandardActionResult } from '../actions/types';
import { executeAction } from '../actions/executor'; // Import executeAction
import { 
  // Existing service imports
  createJiraTicket, 
  fetchJiraTickets, 
  getJiraTicketById,
  getJiraTicketFields,
  getJiraTicketComments,
  addCommentToJiraTicket,
  updateJiraTicket,
  addTicketToCurrentSprint as addTicketToCurrentSprintService,
  searchJiraUsers,
  assignJiraTicket,
  getActiveSprintForBoard as getActiveSprintForBoardService,
  getIssuesForSprint as getIssuesForSprintService,
  moveIssueToSprint as moveIssueToSprintService,
  moveIssueToBacklog as moveIssueToBacklogService,
  getAvailableTransitions as getAvailableTransitionsService,
  transitionIssue as transitionIssueService,
  setStoryPoints as setStoryPointsService,
  getSprintsForBoard as getSprintsForBoardService,

  // --- BEGIN NEW SERVICE IMPORTS ---
  resolveBoardForProject,
  getSprintsForResolvedBoard,
  // Types needed for new actions
  JiraBoard,
  JiraSprint,
  Result
  // --- END NEW SERVICE IMPORTS ---
} from './jira.service';

// --- BEGIN EXISTING INTERFACES (condensed for brevity) ---
interface CreateTicketArgs { summary: string; description: string; projectKey: string; issueType?: string; }
interface FetchTicketsArgs { projectKey: string; maxResults?: number; fields?: string[]; }
interface GetTicketArgs { issueIdOrKey: string; fields?: string[]; }
interface AddCommentArgs { issueIdOrKey: string; commentBody: string; }
interface UpdateTicketArgs { issueIdOrKey: string; summary?: string; description?: string; assigneeAccountId?: string | null; labels?: string[]; }
interface AddTicketToCurrentSprintArgs { boardId: string; issueKey: string; }
interface SearchUsersArgs { query?: string; startAt?: number; maxResults?: number; accountId?: string; }
interface AssignTicketArgs { issueIdOrKey: string; accountId: string | null; }
interface GetActiveSprintForBoardArgs { boardId: string; }
interface GetIssuesForSprintArgs { sprintId: string; projectKey?: string; maxResults?: number; startAt?: number; fields?: string[]; }
interface MoveIssueToSprintArgs { issueKey: string; targetSprintId: string; }
interface MoveIssueToBacklogArgs { issueKey: string; }
interface GetAvailableTransitionsArgs { issueIdOrKey: string; }
interface TransitionIssueArgs { issueIdOrKey: string; transitionId: string; comment?: string; fields?: Record<string, any>; }
interface JiraTransitionStatus { self: string; description: string; iconUrl: string; name: string; id: string; statusCategory: { self: string; id: number; key: string; colorName: string; name: string; }; }
interface JiraTransition { id: string; name: string; to: JiraTransitionStatus; hasScreen: boolean; isGlobal: boolean; isInitial: boolean; isAvailable: boolean; isConditional: boolean; isLooped?: boolean; }
interface SetStoryPointsArgs { issueIdOrKey: string; storyPoints: number | null; }
interface GetSprintsForBoardArgs { boardId: string; state?: string; startAt?: number; maxResults?: number; }
interface GetTicketCommentsArgs { issueIdOrKey: string; startAt?: number; maxResults?: number; orderBy?: string; expand?: string; }
// --- END EXISTING INTERFACES ---


// --- BEGIN NEW INTERFACES ---
interface GetProjectSprintsArgs {
  projectKey: string;
  sprintState?: 'active' | 'future' | 'closed' | string; // Allow common states or combined string
}

// Describes how the target sprint is specified
type TargetSprintDescriptor = 
  | 'active' 
  | 'next' 
  | { sprintId: string } 
  | { sprintName: string };

interface MoveIssuesToProjectSprintArgs {
  projectKey?: string; // Optional if boardId is provided
  boardId?: string;    // Optional if projectKey is provided
  issueKeys: string[];
  targetSprintDescriptor: TargetSprintDescriptor;
  jqlQueryForIssues?: string; // Optional: if issues are to be fetched by JQL instead of explicit keys
}
// --- END NEW INTERFACES ---


const projectKeyParamDefinition = {
  type: 'string' as const,
  description: 'JIRA project key (e.g., "PROJ"). This is essential for targeting the correct project.'
};

export const createJiraActions = (context: ActionContext): FunctionFactory => ({
  // --- BEGIN EXISTING ACTIONS (condensed for brevity, ensure they remain) ---
  createTicket: { /* ... existing definition ... */ 
    description: 'Creates a new JIRA ticket',
    parameters: { type: 'object', properties: { summary: { type: 'string' }, description: { type: 'string' }, projectKey: projectKeyParamDefinition, issueType: { type: 'string' } }, required: ['summary', 'description', 'projectKey'] },
    function: async (params: CreateTicketArgs): Promise<StandardActionResult<any>> => {
      const result = await createJiraTicket(context.sessionId, context.companyId, params);
      if (result.success) return { success: true, data: result.data, message: result.message };
      throw new Error(result.error || 'Failed to create JIRA ticket');
    },
  },
  fetchTickets: { /* ... existing definition ... */ 
    description: 'Fetches JIRA tickets from a project',
    parameters: { type: 'object', properties: { projectKey: projectKeyParamDefinition, maxResults: { type: 'number' }, fields: { type: 'array', items: { type: 'string' } } }, required: ['projectKey'] },
    function: async (params: FetchTicketsArgs): Promise<StandardActionResult<any[]>> => { // Assuming data is an array of tickets
      // Define R_FetchTicketsData (data payload for StandardActionResult)
      // For now, let's assume it's any[] as per original Promise<StandardActionResult<any>>
      // Define S_FetchTicketsServiceResponse (expected return from serviceCallLambda)
      interface S_FetchTicketsServiceResponse {
        success: boolean;
        data?: any[]; // Should match R_FetchTicketsData
        description?: string;
      }

      return executeAction<any[], S_FetchTicketsServiceResponse>(
        'jira.fetchTickets', // Full action name
        async (): Promise<S_FetchTicketsServiceResponse> => {
          const serviceResult = await fetchJiraTickets(context.sessionId, context.companyId, { 
            projectKey: params.projectKey, 
            jql: undefined, 
            maxResults: params.maxResults, 
            fieldsToFetch: params.fields 
          });

          if (serviceResult.success) {
            return {
              success: true,
              data: serviceResult.data as any[] // Cast if necessary
            };
          } else {
            return {
              success: false,
              description: serviceResult.error || 'Failed to fetch JIRA tickets from service.'
            };
          }
        },
        { 
          serviceName: 'JiraService'
          // actionTitle and actionDescription are part of the main action definition,
          // not ExecuteActionOptions
        }
      );
    },
  },
  getTicket: { /* ... existing definition ... */ 
    description: 'Gets a specific JIRA ticket by ID or key.',
    parameters: { type: 'object', properties: { issueIdOrKey: { type: 'string' }, fields: { type: 'array', items: { type: 'string' } } }, required: ['issueIdOrKey'] },
    function: async (params: GetTicketArgs): Promise<StandardActionResult<any>> => {
      const result = await getJiraTicketById(context.sessionId, context.companyId, { issueIdOrKey: params.issueIdOrKey, fieldsToFetch: params.fields });
      if (result.success) return { success: true, data: result.data, message: result.message };
      throw new Error(result.error || 'Failed to get JIRA ticket');
    },
  },
  addComment: { /* ... existing definition ... */ 
    description: 'Adds a comment to a specific JIRA ticket',
    parameters: { type: 'object', properties: { issueIdOrKey: { type: 'string' }, commentBody: { type: 'string' } }, required: ['issueIdOrKey', 'commentBody'] },
    function: async (params: AddCommentArgs): Promise<StandardActionResult<any>> => {
      const result = await addCommentToJiraTicket(context.sessionId, context.companyId, params);
      if (result.success) return { success: true, data: result.data, message: result.message };
      throw new Error(result.error || 'Failed to add comment');
    },
  },
  updateTicket: { /* ... existing definition ... */ 
    description: 'Updates an existing JIRA ticket.',
    parameters: { type: 'object', properties: { issueIdOrKey: { type: 'string' }, summary: { type: 'string' }, description: { type: 'string' }, assigneeAccountId: { type: ['string', 'null'] }, labels: { type: 'array', items: { type: 'string' } } }, required: ['issueIdOrKey'] },
    function: async (params: UpdateTicketArgs): Promise<StandardActionResult<any>> => {
      const fieldsToUpdate: Record<string, any> = {};
      if (params.summary !== undefined) fieldsToUpdate.summary = params.summary;
      if (params.description !== undefined) fieldsToUpdate.description = params.description;
      if (params.assigneeAccountId !== undefined) fieldsToUpdate.assignee = params.assigneeAccountId === null ? null : { accountId: params.assigneeAccountId };
      if (params.labels !== undefined) {
        if (Array.isArray(params.labels)) {
          fieldsToUpdate.labels = params.labels;
        } else if (typeof params.labels === 'object' && params.labels !== null) {
          // Attempt to convert object values to an array for labels
          fieldsToUpdate.labels = Object.values(params.labels);
        } else {
          // If it's some other unexpected type, assign as is or log a warning
          fieldsToUpdate.labels = params.labels;
        }
      }
      const result = await updateJiraTicket(context.sessionId, context.companyId, { issueIdOrKey: params.issueIdOrKey, fields: fieldsToUpdate });
      if (result.success) return { success: true, data: result.data, message: result.message };
      throw new Error(result.error || 'Failed to update ticket');
    },
  },
  addTicketToCurrentSprint: { /* ... existing definition ... */ 
    description: 'Adds a JIRA ticket to the current active sprint on a specified board.',
    parameters: { type: 'object', properties: { boardId: { type: 'string' }, issueKey: { type: 'string' } }, required: ['boardId', 'issueKey'] },
    function: async (params: AddTicketToCurrentSprintArgs): Promise<StandardActionResult<any>> => {
      const result = await addTicketToCurrentSprintService(context.sessionId, context.companyId, params);
      if (result.success) return { success: true, data: result.data, message: result.message };
      throw new Error(result.error || 'Failed to add ticket to current sprint');
    },
  },
  searchUsers: { /* ... existing definition ... */ 
    description: 'Searches for JIRA users.',
    parameters: { type: 'object', properties: { query: { type: 'string' }, startAt: { type: 'number' }, maxResults: { type: 'number' }, accountId: { type: 'string' } }, required: [] },
    function: async (params: SearchUsersArgs): Promise<StandardActionResult<any>> => {
      const result = await searchJiraUsers(context.sessionId, context.companyId, params);
      if (result.success) return { success: true, data: result.data, message: result.message };
      throw new Error(result.error || 'Failed to search users');
    },
  },
  assignTicket: { /* ... existing definition ... */ 
    description: 'Assigns a JIRA ticket to a user.',
    parameters: { type: 'object', properties: { issueIdOrKey: { type: 'string' }, accountId: { type: ['string', 'null'] } }, required: ['issueIdOrKey', 'accountId'] },
    function: async (params: AssignTicketArgs): Promise<StandardActionResult<any>> => {
      const result = await assignJiraTicket(context.sessionId, context.companyId, params);
      if (result.success) return { success: true, data: result.data, message: result.message };
      throw new Error(result.error || 'Failed to assign ticket');
    },
  },
  getActiveSprintForBoard: { /* ... existing definition ... */ 
    description: 'Gets the active sprint for a specific JIRA board.',
    parameters: { type: 'object', properties: { boardId: { type: 'string' } }, required: ['boardId'] },
    function: async (params: GetActiveSprintForBoardArgs): Promise<StandardActionResult<any>> => {
      const result = await getActiveSprintForBoardService(context.sessionId, context.companyId, params);
      if (result.success) return { success: true, data: result.data, message: result.message };
      throw new Error(result.error || 'Failed to get active sprint');
    },
  },
  getIssuesForSprint: { /* ... existing definition ... */ 
    description: 'Gets issues for a specific JIRA sprint.',
    parameters: { type: 'object', properties: { sprintId: { type: 'string' }, projectKey: { type: 'string' }, maxResults: { type: 'number' }, startAt: { type: 'number' }, fields: { type: 'array', items: { type: 'string' } } }, required: ['sprintId'] },
    function: async (params: GetIssuesForSprintArgs): Promise<StandardActionResult<any>> => {
      const result = await getIssuesForSprintService(context.sessionId, context.companyId, { sprintId: params.sprintId, projectKey: params.projectKey, maxResults: params.maxResults, startAt: params.startAt, fieldsToFetch: params.fields });
      if (result.success) return { success: true, data: result.data, message: result.message };
      throw new Error(result.error || 'Failed to get issues for sprint');
    },
  },
  moveIssueToSprint: { /* ... existing definition ... */ 
    description: 'Moves a JIRA issue to a specified sprint.',
    parameters: { type: 'object', properties: { issueKey: { type: 'string' }, targetSprintId: { type: 'string' } }, required: ['issueKey', 'targetSprintId'] },
    function: async (params: MoveIssueToSprintArgs): Promise<StandardActionResult<any>> => {
      const result = await moveIssueToSprintService(context.sessionId, context.companyId, params);
      if (result.success) return { success: true, data: result.data, message: result.message };
      throw new Error(result.error || 'Failed to move issue to sprint');
    },
  },
  moveIssueToBacklog: { /* ... existing definition ... */ 
    description: 'Moves a JIRA issue to the backlog.',
    parameters: { type: 'object', properties: { issueKey: { type: 'string' } }, required: ['issueKey'] },
    function: async (params: MoveIssueToBacklogArgs): Promise<StandardActionResult<any>> => {
      const result = await moveIssueToBacklogService(context.sessionId, context.companyId, params);
      if (result.success) return { success: true, data: result.data, message: result.message };
      throw new Error(result.error || 'Failed to move issue to backlog');
    },
  },
  getAvailableTransitions: { /* ... existing definition ... */ 
    description: 'Gets available workflow transitions for a JIRA issue.',
    parameters: { type: 'object', properties: { issueIdOrKey: { type: 'string' } }, required: ['issueIdOrKey'] },
    function: async (params: GetAvailableTransitionsArgs): Promise<StandardActionResult<any>> => {
      const result = await getAvailableTransitionsService(context.sessionId, context.companyId, params);
      if (result.success) return { success: true, data: result.data, message: result.message };
      throw new Error(result.error || 'Failed to get available transitions');
    },
  },
  transitionIssue: { /* ... existing definition ... */ 
    description: 'Transitions a JIRA issue to a new status.',
    parameters: { type: 'object', properties: { issueIdOrKey: { type: 'string' }, transitionId: { type: 'string' }, comment: { type: 'string' }, fields: { type: 'object' } }, required: ['issueIdOrKey', 'transitionId'] },
    function: async (params: TransitionIssueArgs): Promise<StandardActionResult<any[]>> => {
      const result = await transitionIssueService(context.sessionId, context.companyId, params);
      if (result.success) return { success: true, data: result.data, message: result.message };
      throw new Error(result.error || 'Failed to transition issue');
    },
  },
  setStoryPoints: { /* ... existing definition ... */ 
    description: 'Sets or clears story points for a JIRA issue.',
    parameters: { type: 'object', properties: { issueIdOrKey: { type: 'string' }, storyPoints: { type: ['number', 'null'] } }, required: ['issueIdOrKey', 'storyPoints'] },
    function: async (params: SetStoryPointsArgs): Promise<StandardActionResult<any>> => {
      const result = await setStoryPointsService(context.sessionId, context.companyId, params);
      if (result.success) return { success: true, data: result.data, message: result.message };
      throw new Error(result.error || 'Failed to set story points');
    },
  },
  getSprintsForBoard: { /* ... existing definition ... */ 
    description: 'Gets sprints for a specific JIRA board.',
    parameters: { type: 'object', properties: { boardId: { type: 'string' }, state: { type: 'string' }, startAt: { type: 'number' }, maxResults: { type: 'number' } }, required: ['boardId'] },
    function: async (params: GetSprintsForBoardArgs): Promise<StandardActionResult<any>> => {
      const result = await getSprintsForBoardService(context.sessionId, context.companyId, params);
      if (result.success) return { success: true, data: result.data, message: result.message };
      throw new Error(result.error || 'Failed to get sprints for board');
    },
  },
  getTicketFields: { /* ... existing definition ... */ 
    description: 'Gets all available fields in JIRA.',
    parameters: { type: 'object', properties: {}, required: [] },
    function: async (): Promise<StandardActionResult<any>> => {
      const result = await getJiraTicketFields(context.sessionId, context.companyId);
      if (result.success) return { success: true, data: result.data, message: result.message };
      throw new Error(result.error || 'Failed to get ticket fields');
    },
  },
  getTicketComments: { /* ... existing definition ... */ 
    description: 'Gets comments for a specific JIRA ticket.',
    parameters: { type: 'object', properties: { issueIdOrKey: { type: 'string' }, startAt: { type: 'number' }, maxResults: { type: 'number' }, orderBy: { type: 'string' }, expand: { type: 'string' } }, required: ['issueIdOrKey'] },
    function: async (params: GetTicketCommentsArgs): Promise<StandardActionResult<any>> => {
      const result = await getJiraTicketComments(context.sessionId, context.companyId, params);
      if (result.success) return { success: true, data: result.data, message: result.message };
      throw new Error(result.error || 'Failed to get ticket comments');
    },
  },
  // --- END EXISTING ACTIONS ---

  // --- BEGIN NEW ACTIONS ---
  getProjectSprints: {
    description: 'Gets sprints for a JIRA project, resolving board ID automatically. May prompt for board selection if ambiguous.',
    parameters: {
      type: 'object',
      properties: {
        projectKey: projectKeyParamDefinition,
        sprintState: { 
          type: 'string', 
          description: 'Optional: Filter sprints by state (e.g., "active", "future", "closed", or "active,future"). Defaults to "active,future".',
          enum: ['active', 'future', 'closed', 'active,future'] 
        }
      },
      required: ['projectKey'],
      additionalProperties: false,
    },
    function: async (params: GetProjectSprintsArgs): Promise<StandardActionResult<any>> => {
      const boardResolutionResult = await resolveBoardForProject(context.companyId, params.projectKey);

      if (!boardResolutionResult.success && boardResolutionResult.error) { // If error in resolving board
        throw new Error(boardResolutionResult.error);
      }

      // If ambiguous boards, this is a "successful" service call, data contains ambiguousBoards
      if (boardResolutionResult.success && boardResolutionResult.data?.ambiguousBoards) {
        return { 
          success: true, 
          message: boardResolutionResult.message || `Multiple boards found for project ${params.projectKey}. Please specify one.`,
          data: { ambiguousBoards: boardResolutionResult.data.ambiguousBoards } // Data for AI to prompt user
        };
      }

      if (boardResolutionResult.success && boardResolutionResult.data?.board) {
        const board = boardResolutionResult.data.board;
        const sprintsResult = await getSprintsForResolvedBoard(context.companyId, board, params.sprintState);
        if (sprintsResult.success && sprintsResult.data) {
          return { success: true, data: { sprints: sprintsResult.data.sprints }, message: sprintsResult.message };
        } else { // Error fetching sprints for the resolved board
          throw new Error(sprintsResult.error || `Failed to get sprints for board ${board.name}`);
        }
      }
      // Fallback error if board could not be resolved for other reasons
      throw new Error(boardResolutionResult.error || 'Could not resolve a board for the project or an unknown error occurred.');
    },
  },

  moveIssuesToProjectSprint: {
    description: 'Moves specified JIRA issues to a target sprint within a project. Board and sprint are resolved automatically.',
    parameters: {
      type: 'object',
      properties: {
        projectKey: { ...projectKeyParamDefinition, description: projectKeyParamDefinition.description + ' Optional if boardId is provided.' },
        boardId: { type: 'string', description: 'Optional: Direct JIRA board ID. If provided, projectKey is ignored for board resolution.' },
        issueKeys: { type: 'array', items: { type: 'string' }, description: 'Array of issue keys to move (e.g., ["PROJ-123", "PROJ-124"]).' },
        targetSprintDescriptor: {
          type: 'object', 
          description: 'Describes the target sprint. Use one of: "active", "next", {sprintId: "ID"}, or {sprintName: "Name"}.',
          properties: {
            type: { type: 'string', enum: ['active', 'next', 'sprintId', 'sprintName'], description: 'Type of descriptor.' },
            value: { type: 'string', description: 'Value for sprintId or sprintName if type is "sprintId" or "sprintName".' }
          },
          required: ['type']
        },
        jqlQueryForIssues: { type: 'string', description: 'Optional: JQL query to find issues to move. If provided, issueKeys array is ignored.'}
      },
      // Either issueKeys or jqlQueryForIssues must be present. This is validated in the function logic.
      // targetSprintDescriptor is required.
      required: ['targetSprintDescriptor'], 
      additionalProperties: false,
    },
    function: async (params: MoveIssuesToProjectSprintArgs): Promise<StandardActionResult<any>> => {
      let boardToUse: JiraBoard | undefined;

      if (!params.projectKey && !params.boardId) {
        throw new Error('Either projectKey or boardId must be provided.');
      }
      if (!params.issueKeys?.length && !params.jqlQueryForIssues) {
          throw new Error('Either issueKeys array or jqlQueryForIssues must be provided.');
      }

      // 1. Determine Board
      if (params.boardId) {
        const boardIdNum = parseInt(params.boardId, 10);
        if (isNaN(boardIdNum)) throw new Error(`Invalid boardId: ${params.boardId}`);
        // In a full implementation, one might call a getBoardById service here.
        // For now, create a partial board object.
        boardToUse = { id: boardIdNum, name: `Board ${params.boardId}`, type: 'unknown', self: '' }; 
      } else if (params.projectKey) { // projectKey is asserted to exist if boardId doesn't by the check above
        const boardResolutionResult = await resolveBoardForProject(context.companyId, params.projectKey);
        if (!boardResolutionResult.success && boardResolutionResult.error) {
          throw new Error(boardResolutionResult.error);
        }
        if (boardResolutionResult.success && boardResolutionResult.data?.ambiguousBoards) {
          return { 
            success: true, // Successful service call, but requires user clarification
            message: boardResolutionResult.message || `Multiple boards found. Please specify.`,
            data: { ambiguousBoards: boardResolutionResult.data.ambiguousBoards }
          };
        }
        if (!boardResolutionResult.data?.board) {
            throw new Error(`Could not resolve a board for project ${params.projectKey}.`);
        }
        boardToUse = boardResolutionResult.data.board;
      }

      if (!boardToUse) { // Should not be reached if logic above is correct
        throw new Error('Board could not be determined.');
      }

      // 2. Determine Target Sprint ID
      let targetSprintId: number | undefined;
      const descriptor = params.targetSprintDescriptor as any; 

      if (descriptor.type === 'active') {
        const activeSprintResult = await getSprintsForResolvedBoard(context.companyId, boardToUse, 'active');
        if (activeSprintResult.success && activeSprintResult.data?.sprints?.length) {
          targetSprintId = activeSprintResult.data.sprints[0].id;
        } else {
          throw new Error(activeSprintResult.error || `No active sprint found for board ${boardToUse.name}.`);
        }
      } else if (descriptor.type === 'next') {
        const futureSprintsResult = await getSprintsForResolvedBoard(context.companyId, boardToUse, 'future');
        if (futureSprintsResult.success && futureSprintsResult.data?.sprints?.length) {
          const sortedSprints = [...futureSprintsResult.data.sprints].sort((a, b) => 
            new Date(a.startDate || 0).getTime() - new Date(b.startDate || 0).getTime()
          );
          if (sortedSprints.length > 0) {
            targetSprintId = sortedSprints[0].id;
          } else {
            throw new Error(`No future sprints found for board ${boardToUse.name}.`);
          }
        } else {
          throw new Error(futureSprintsResult.error || `No future sprints found for board ${boardToUse.name}.`);
        }
      } else if (descriptor.type === 'sprintId' && descriptor.value) {
        targetSprintId = parseInt(descriptor.value, 10);
        if (isNaN(targetSprintId)) throw new Error(`Invalid sprintId provided: ${descriptor.value}`);
      } else if (descriptor.type === 'sprintName' && descriptor.value) {
        const allSprintsResult = await getSprintsForResolvedBoard(context.companyId, boardToUse, 'active,future,closed');
        if (allSprintsResult.success && allSprintsResult.data?.sprints) {
          const foundSprint = allSprintsResult.data.sprints.find(s => s.name.toLowerCase() === descriptor.value.toLowerCase());
          if (foundSprint) {
            targetSprintId = foundSprint.id;
          } else {
            throw new Error(`Sprint with name "${descriptor.value}" not found on board ${boardToUse.name}.`);
          }
        } else {
          throw new Error(allSprintsResult.error || `Could not fetch sprints to find by name for board ${boardToUse.name}.`);
        }
      } else {
        throw new Error('Invalid targetSprintDescriptor.');
      }

      if (targetSprintId === undefined) { // Should be caught by specific errors above
        throw new Error('Target sprint could not be determined.');
      }

      // 3. Determine Issue Keys
      let issuesToMoveKeys = params.issueKeys || [];
      if (params.jqlQueryForIssues) {
          const projectForJQL = params.projectKey || boardToUse.location?.projectKey;
          if (!projectForJQL && !params.jqlQueryForIssues.toLowerCase().includes('project =')) {
              throw new Error('Project key is required for JQL unless JQL specifies the project.');
          }
          const jqlResult = await fetchJiraTickets(context.sessionId, context.companyId, { projectKey: projectForJQL, jql: params.jqlQueryForIssues, fieldsToFetch: ['key'] });
          if (!jqlResult.success || !jqlResult.data) {
              throw new Error(`Failed to fetch issues with JQL: ${params.jqlQueryForIssues}. ${jqlResult.error || ''}`);
          }
          issuesToMoveKeys = jqlResult.data.map((issue: any) => issue.key);
          if (!issuesToMoveKeys.length) {
              return { success: true, message: `No issues found matching JQL: ${params.jqlQueryForIssues}. No issues moved.` };
          }
      }
      
      if (!issuesToMoveKeys.length) { // Check again after potential JQL fetch
        return { success: true, message: "No issue keys provided or found via JQL to move." };
      }

      // 4. Move Issues
      const moveResultsPromises = issuesToMoveKeys.map(issueKey => 
        moveIssueToSprintService(context.sessionId, context.companyId, {
          issueKey,
          targetSprintId: targetSprintId!.toString(), // targetSprintId is confirmed to be defined here
        }).then(res => ({ issueKey, ...res })) // Add issueKey to result for context
      );
      
      const settledMoveResults = await Promise.allSettled(moveResultsPromises);
      
      const finalResults: any[] = [];
      let allSuccessful = true;
      settledMoveResults.forEach(settledResult => {
          if (settledResult.status === 'fulfilled') {
              finalResults.push(settledResult.value);
              if (!settledResult.value.success) allSuccessful = false;
          } else {
              // Handle rejected promise (should not happen if service returns Result object)
              finalResults.push({ issueKey: 'unknown', success: false, error: settledResult.reason?.message || 'Move operation failed unexpectedly.' });
              allSuccessful = false;
          }
      });

      const successfulMovesCount = finalResults.filter(r => r.success).length;
      const failedMovesCount = finalResults.length - successfulMovesCount;

      return {
        success: allSuccessful, // Overall success if all individual moves were successful
        message: `Move operation summary: ${successfulMovesCount} issues moved successfully. ${failedMovesCount > 0 ? `${failedMovesCount} issues failed to move.` : ''}`.trim(),
        data: {
          targetSprintId,
          boardId: boardToUse.id,
          results: finalResults // Array of individual move results
        }
      };
    },
  },
  // --- END NEW ACTIONS ---
});
