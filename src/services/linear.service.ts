import { LinearClient, Issue, IssueConnection, IssuePayload, User, UserConnection } from "@linear/sdk";

export class LinearService {
  private linearClient: LinearClient;

  constructor(apiKey: string) {
    this.linearClient = new LinearClient({ apiKey });
  }

  async fetchIssues(first: number = 50): Promise<Issue[]> {
    try {
      const issues = await this.linearClient.issues({ first });
      return issues.nodes;
    } catch (error) {
      console.error('Error fetching issues:', error);
      throw new Error('Error fetching issues');
    }
  }

  async createIssue(title: string, description: string, teamId: string): Promise<IssuePayload> {
    try {
      const newIssue = await this.linearClient.createIssue({
        title,
        description,
        teamId
      });
      return newIssue;
    } catch (error) {
      console.error('Error creating issue:', error);
      throw new Error('Error creating issue');
    }
  }

  async updateIssue(issueId: string, updateData: { title?: string; state?: string }): Promise<void> {
    try {
      await this.linearClient.updateIssue(issueId, updateData);
    } catch (error) {
      console.error('Error updating issue:', error);
      throw new Error('Error updating issue');
    }
  }

  async deleteIssue(issueId: string): Promise<void> {
    try {
      await this.linearClient.deleteIssue(issueId);
    } catch (error) {
      console.error('Error deleting issue:', error);
      throw new Error('Error deleting issue');
    }
  }

  async fetchAllIssues(): Promise<Issue[]> {
    try {
      let hasNextPage = true;
      let endCursor: string | null = null;
      const allIssues: Issue[] = [];
      while (hasNextPage) {
        const result: IssueConnection = await this.linearClient.issues({ first: 100, after: endCursor });
        allIssues.push(...result.nodes);
        hasNextPage = result.pageInfo.hasNextPage;
        endCursor = result.pageInfo.endCursor || null;
      }
      return allIssues;
    } catch (error) {
      console.error('Error fetching all issues:', error);
      throw new Error('Error fetching all issues');
    }
  }

  async fetchIssuesByUser(userId: string): Promise<Issue[]> {
    try {
      const result = await this.linearClient.issues({
        filter: {
          assignee: { id: { eq: userId } }
        }
      });
      return result.nodes;
    } catch (error) {
      console.error('Error fetching issues by user:', error);
      throw new Error('Error fetching issues by user');
    }
  }

  async fetchIssuesByDate(days: number): Promise<Issue[]> {
    try {
      const date = new Date();
      date.setDate(date.getDate() - days);

      const result = await this.linearClient.issues({
        filter: {
          or: [
            { createdAt: { gt: date } },
            { updatedAt: { gt: date } }
          ]
        }
      });
      return result.nodes;
    } catch (error) {
      console.error('Error fetching issues by date:', error);
      throw new Error('Error fetching issues by date');
    }
  }

  async fetchUserList(): Promise<User[]> {
    try {
      const result: UserConnection = await this.linearClient.users();
      return result.nodes;
    } catch (error) {
      console.error('Error fetching user list:', error);
      throw new Error('Error fetching user list');
    }
  }
}