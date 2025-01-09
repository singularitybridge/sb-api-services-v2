import { LinearClient, Issue, IssueConnection, IssuePayload, User, UserConnection, Team, WorkflowStateConnection, WorkflowState, Comment, CommentPayload } from "@linear/sdk";
import { getApiKey } from '../../services/api.key.service';

const createLinearClient = async (companyId: string): Promise<LinearClient> => {
  const apiKey = await getApiKey(companyId, 'linear_api_key');
  if (!apiKey) {
    throw new Error('Linear API key not found');
  }
  return new LinearClient({ apiKey });
};

export const fetchIssues = async (companyId: string, first: number = 50): Promise<{ success: boolean; data?: Issue[]; error?: string }> => {
  try {
    const linearClient = await createLinearClient(companyId);
    const issues = await linearClient.issues({ first });
    if (!issues || !issues.nodes) {
      console.error('Unexpected response structure from Linear API');
      return { success: false, error: 'Unexpected response structure from Linear API' };
    }
    return { success: true, data: issues.nodes };
  } catch (error) {
    console.error('Error in fetchIssues:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error occurred' };
  }
};

export const createIssue = async (companyId: string, title: string, description: string, teamId: string): Promise<{ success: boolean; data?: IssuePayload; error?: string }> => {
  try {
    const linearClient = await createLinearClient(companyId);
    const issue = await linearClient.createIssue({ title, description, teamId });
    return { success: true, data: issue };
  } catch (error) {
    console.error('Error in createIssue:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error occurred' };
  }
};

export const updateIssue = async (companyId: string, issueId: string, updateData: { title?: string; description?: string; status?: string }): Promise<{ success: boolean; error?: string }> => {
  try {
    const linearClient = await createLinearClient(companyId);

    const issue = await linearClient.issue(issueId);
    if (!issue) {
      return { success: false, error: 'Issue not found' };
    }

    const updatePayload: any = {};

    if (updateData.title !== undefined) {
      updatePayload.title = updateData.title;
    }

    if (updateData.description !== undefined) {
      updatePayload.description = updateData.description;
    }

    if (updateData.status) {
      const states = await linearClient.workflowStates();
      const status = states.nodes.find(s => s.name.toLowerCase() === updateData.status!.toLowerCase());
      if (!status) {
        return { success: false, error: 'Invalid status' };
      }
      updatePayload.stateId = status.id;
    }

    await issue.update(updatePayload);
    return { success: true };
  } catch (error) {
    console.error('Error in updateIssue:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error occurred' };
  }
};

export const deleteIssue = async (companyId: string, issueId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const linearClient = await createLinearClient(companyId);
    await linearClient.deleteIssue(issueId);
    return { success: true };
  } catch (error) {
    console.error('Error in deleteIssue:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error occurred' };
  }
};

export const fetchAllIssues = async (companyId: string): Promise<{ success: boolean; data?: Issue[]; error?: string }> => {
  try {
    const linearClient = await createLinearClient(companyId);
    let hasNextPage = true;
    let endCursor: string | null = null;
    const allIssues: Issue[] = [];
    while (hasNextPage) {
      const result: IssueConnection = await linearClient.issues({ first: 100, after: endCursor });
      if (!result || !result.nodes) {
        console.error('Unexpected response structure from Linear API');
        return { success: false, error: 'Unexpected response structure from Linear API' };
      }
      allIssues.push(...result.nodes);
      hasNextPage = result.pageInfo.hasNextPage;
      endCursor = result.pageInfo.endCursor || null;
    }
    return { success: true, data: allIssues };
  } catch (error) {
    console.error('Error in fetchAllIssues:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error occurred' };
  }
};

export const fetchIssuesByUser = async (companyId: string, userId: string): Promise<{ success: boolean; data?: Issue[]; error?: string }> => {
  try {
    const linearClient = await createLinearClient(companyId);
    const result = await linearClient.issues({
      filter: {
        assignee: { id: { eq: userId } }
      }
    });
    return { success: true, data: result.nodes };
  } catch (error) {
    console.error('Error in fetchIssuesByUser:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error occurred' };
  }
};

export const fetchIssuesByDate = async (companyId: string, days: number): Promise<{ success: boolean; data?: Issue[]; error?: string }> => {
  try {
    const linearClient = await createLinearClient(companyId);
    const date = new Date();
    date.setDate(date.getDate() - days);

    const result = await linearClient.issues({
      filter: {
        or: [
          { createdAt: { gt: date } },
          { updatedAt: { gt: date } }
        ]
      }
    });
    return { success: true, data: result.nodes };
  } catch (error) {
    console.error('Error in fetchIssuesByDate:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error occurred' };
  }
};

export const fetchUserList = async (companyId: string): Promise<{ success: boolean; data?: User[]; error?: string }> => {
  try {
    const linearClient = await createLinearClient(companyId);
    const result: UserConnection = await linearClient.users();
    return { success: true, data: result.nodes };
  } catch (error) {
    console.error('Error in fetchUserList:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error occurred' };
  }
};

export const fetchTeams = async (companyId: string): Promise<{ success: boolean; data?: Team[]; error?: string }> => {
  try {
    const linearClient = await createLinearClient(companyId);
    const teams = await linearClient.teams();
    return { success: true, data: teams.nodes };
  } catch (error) {
    console.error('Error in fetchTeams:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error occurred' };
  }
};

export const fetchIssueStatuses = async (companyId: string): Promise<{ success: boolean; data?: WorkflowState[]; error?: string }> => {
  try {
    const linearClient = await createLinearClient(companyId);
    const states: WorkflowStateConnection = await linearClient.workflowStates();
    return { success: true, data: states.nodes };
  } catch (error) {
    console.error('Error in fetchIssueStatuses:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error occurred' };
  }
};

export const createComment = async (companyId: string, issueId: string, body: string): Promise<{ success: boolean; data?: CommentPayload; error?: string }> => {
  try {
    const linearClient = await createLinearClient(companyId);
    const commentPayload = await linearClient.createComment({
      issueId,
      body
    });
    return { success: true, data: commentPayload };
  } catch (error) {
    console.error('Error in createComment:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error occurred' };
  }
};
