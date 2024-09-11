import { LinearClient, Issue, IssueConnection, IssuePayload, User, UserConnection } from "@linear/sdk";
import { getApiKey } from './api.key.service';

const createLinearClient = async (companyId: string): Promise<LinearClient> => {
  const apiKey = await getApiKey(companyId, 'linear');
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
    throw new Error('Error fetching issues');
  }
};

export const createIssue = async (companyId: string, title: string, description: string, teamId: string): Promise<IssuePayload> => {
  try {
    const linearClient = await createLinearClient(companyId);
    return await linearClient.createIssue({ title, description, teamId });
  } catch (error) {    
    throw new Error('Error creating issue');
  }
};

export const updateIssue = async (companyId: string, issueId: string, updateData: { title?: string; state?: string }): Promise<void> => {
  try {
    const linearClient = await createLinearClient(companyId);
    await linearClient.updateIssue(issueId, updateData);
  } catch (error) {    
    throw new Error('Error updating issue');
  }
};

export const deleteIssue = async (companyId: string, issueId: string): Promise<void> => {
  try {
    const linearClient = await createLinearClient(companyId);
    await linearClient.deleteIssue(issueId);
  } catch (error) {    
    throw new Error('Error deleting issue');
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
    throw new Error('Error fetching all issues');
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
    throw new Error('Error fetching issues by user');
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
    throw new Error('Error fetching issues by date');
  }
};

export const fetchUserList = async (companyId: string): Promise<User[]> => {
  try {
    const linearClient = await createLinearClient(companyId);
    const result: UserConnection = await linearClient.users();
    return result.nodes;
  } catch (error) {    
    throw new Error('Error fetching user list');
  }
};