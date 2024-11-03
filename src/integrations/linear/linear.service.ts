import { LinearClient, Issue, IssueConnection, IssuePayload, User, UserConnection, Team, WorkflowStateConnection, WorkflowState, Comment, CommentPayload } from "@linear/sdk";
import { getApiKey } from '../../services/api.key.service';

const createLinearClient = async (companyId: string): Promise<LinearClient> => {
  const apiKey = await getApiKey(companyId, 'linear_api_key');
  if (!apiKey) {
    throw new Error('Linear API key not found');
  }
  return new LinearClient({ apiKey });
};

export const fetchIssues = async (companyId: string, first: number = 50): Promise<Issue[]> => {
  try {
    const linearClient = await createLinearClient(companyId);
    const issues = await linearClient.issues({ first });
    return issues.nodes;
  } catch (error) {    
    throw error instanceof Error ? error : new Error(`Error fetching issues: ${error}`);
  }
};

export const createIssue = async (companyId: string, title: string, description: string, teamId: string): Promise<IssuePayload> => {
  try {
    const linearClient = await createLinearClient(companyId);
    return await linearClient.createIssue({ title, description, teamId });
  } catch (error) {    
    console.log(error);
    throw error instanceof Error ? error : new Error(`Error creating issue: ${error}`);
  }
};

export const updateIssue = async (companyId: string, issueId: string, updateData: { title?: string; description?: string; status?: string }): Promise<void> => {
  try {
    const linearClient = await createLinearClient(companyId);

    const issue = await linearClient.issue(issueId);
    if (!issue) {
      throw new Error('Issue not found');
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
        throw new Error('Invalid status');
      }
      updatePayload.stateId = status.id;
    }

    await issue.update(updatePayload);
  } catch (error) {    
    throw error instanceof Error ? error : new Error(`Error updating issue: ${error}`);
  }
};

export const deleteIssue = async (companyId: string, issueId: string): Promise<void> => {
  try {
    const linearClient = await createLinearClient(companyId);
    await linearClient.deleteIssue(issueId);
  } catch (error) {    
    throw error instanceof Error ? error : new Error(`Error deleting issue: ${error}`);
  }
};

export const fetchAllIssues = async (companyId: string): Promise<Issue[]> => {
  try {
    const linearClient = await createLinearClient(companyId);
    let hasNextPage = true;
    let endCursor: string | null = null;
    const allIssues: Issue[] = [];
    while (hasNextPage) {
      const result: IssueConnection = await linearClient.issues({ first: 100, after: endCursor });
      allIssues.push(...result.nodes);
      hasNextPage = result.pageInfo.hasNextPage;
      endCursor = result.pageInfo.endCursor || null;
    }
    return allIssues;
  } catch (error) {    
    throw error instanceof Error ? error : new Error(`Error fetching all issues: ${error}`);
  }
};

export const fetchIssuesByUser = async (companyId: string, userId: string): Promise<Issue[]> => {
  try {
    const linearClient = await createLinearClient(companyId);
    const result = await linearClient.issues({
      filter: {
        assignee: { id: { eq: userId } }
      }
    });
    return result.nodes;
  } catch (error) {    
    throw error instanceof Error ? error : new Error(`Error fetching issues by user: ${error}`);
  }
};

export const fetchIssuesByDate = async (companyId: string, days: number): Promise<Issue[]> => {
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
    return result.nodes;
  } catch (error) {    
    throw error instanceof Error ? error : new Error(`Error fetching issues by date: ${error}`);
  }
};

export const fetchUserList = async (companyId: string): Promise<User[]> => {
  try {
    const linearClient = await createLinearClient(companyId);
    const result: UserConnection = await linearClient.users();
    return result.nodes;
  } catch (error) {    
    throw error instanceof Error ? error : new Error(`Error fetching user list: ${error}`);
  }
};

export const fetchTeams = async (companyId: string): Promise<Team[]> => {
  try {
    const linearClient = await createLinearClient(companyId);
    const teams = await linearClient.teams();
    return teams.nodes;
  } catch (error) {
    console.error("Error fetching Linear teams:", error);
    throw error instanceof Error ? error : new Error(`Error fetching teams: ${error}`);
  }
};

export const fetchIssueStatuses = async (companyId: string): Promise<WorkflowState[]> => {
  try {
    const linearClient = await createLinearClient(companyId);
    const states: WorkflowStateConnection = await linearClient.workflowStates();
    return states.nodes;
  } catch (error) {
    throw error instanceof Error ? error : new Error(`Error fetching issue statuses: ${error}`);
  }
};

export const createComment = async (companyId: string, issueId: string, body: string): Promise<CommentPayload> => {
  try {
    const linearClient = await createLinearClient(companyId);
    const commentPayload = await linearClient.createComment({
      issueId,
      body
    });
    return commentPayload;
  } catch (error) {
    console.error("Error creating comment:", error);
    throw error instanceof Error ? error : new Error(`Error creating comment: ${error}`);
  }
};