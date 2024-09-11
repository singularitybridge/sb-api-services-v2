import { LinearClient, Issue, IssueConnection, IssuePayload, User, UserConnection, Team } from "@linear/sdk";
import * as apiKeyService from '../../../src/services/api.key.service';
import * as linearService from '../../../src/services/linear.service';

jest.mock('@linear/sdk');
jest.mock('../../../src/services/api.key.service');

describe('Linear Service', () => {
  let mockLinearClient: jest.Mocked<LinearClient>;
  const mockCompanyId = 'mock-company-id';
  const mockApiKey = 'mock-api-key';

  beforeEach(() => {
    mockLinearClient = {
      issues: jest.fn(),
      createIssue: jest.fn(),
      updateIssue: jest.fn(),
      deleteIssue: jest.fn(),
      users: jest.fn(),
    } as unknown as jest.Mocked<LinearClient>;

    (LinearClient as jest.Mock).mockImplementation(() => mockLinearClient);
    (apiKeyService.getApiKey as jest.Mock).mockResolvedValue(mockApiKey);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchIssues', () => {
    it('should fetch issues successfully', async () => {
      const mockIssues: Partial<Issue>[] = [{ id: '1', title: 'Test Issue' }];
      mockLinearClient.issues.mockResolvedValue({ nodes: mockIssues as Issue[] } as IssueConnection);

      const result = await linearService.fetchIssues(mockCompanyId);

      expect(result).toEqual(mockIssues);
      expect(mockLinearClient.issues).toHaveBeenCalledWith({ first: 50 });
    });

    it('should handle errors when fetching issues', async () => {
      mockLinearClient.issues.mockRejectedValue(new Error('API Error'));

      await expect(linearService.fetchIssues(mockCompanyId)).rejects.toThrow('Error fetching issues');
    });
  });

  describe('createIssue', () => {
    it('should create an issue successfully', async () => {
      const mockTeam: Partial<Team> = { 
        id: 'team-id',
        name: 'Mock Team',
        key: 'MT',
      };
      
      const mockIssue: Partial<Issue> = {
        id: '1',
        title: 'New Issue',
        description: 'Description',
        team: Promise.resolve(mockTeam as Team),
      };

      const mockIssuePayload: Partial<IssuePayload> = {
        success: true,
        issue: Promise.resolve(mockIssue as Issue),
        lastSyncId: 12345,
      };

      mockLinearClient.createIssue.mockResolvedValue(mockIssuePayload as IssuePayload);

      const result = await linearService.createIssue(mockCompanyId, 'New Issue', 'Description', 'team-id');

      expect(result).toEqual(mockIssuePayload);
      expect(mockLinearClient.createIssue).toHaveBeenCalledWith({
        title: 'New Issue',
        description: 'Description',
        teamId: 'team-id'
      });
    });

    it('should handle errors when creating an issue', async () => {
      mockLinearClient.createIssue.mockRejectedValue(new Error('API Error'));

      await expect(linearService.createIssue(mockCompanyId, 'New Issue', 'Description', 'team-id')).rejects.toThrow('Error creating issue');
    });
  });

  describe('updateIssue', () => {
    it('should update an issue successfully', async () => {
      await linearService.updateIssue(mockCompanyId, 'issue-id', { title: 'Updated Issue', state: 'In Progress' });

      expect(mockLinearClient.updateIssue).toHaveBeenCalledWith('issue-id', { title: 'Updated Issue', state: 'In Progress' });
    });

    it('should handle errors when updating an issue', async () => {
      mockLinearClient.updateIssue.mockRejectedValue(new Error('API Error'));

      await expect(linearService.updateIssue(mockCompanyId, 'issue-id', { title: 'Updated Issue' })).rejects.toThrow('Error updating issue');
    });
  });

  describe('deleteIssue', () => {
    it('should delete an issue successfully', async () => {
      await linearService.deleteIssue(mockCompanyId, 'issue-id');

      expect(mockLinearClient.deleteIssue).toHaveBeenCalledWith('issue-id');
    });

    it('should handle errors when deleting an issue', async () => {
      mockLinearClient.deleteIssue.mockRejectedValue(new Error('API Error'));

      await expect(linearService.deleteIssue(mockCompanyId, 'issue-id')).rejects.toThrow('Error deleting issue');
    });
  });

  describe('fetchAllIssues', () => {
    it('should fetch all issues successfully', async () => {
      const mockIssues: Partial<Issue>[] = [{ id: '1', title: 'Test Issue 1' }, { id: '2', title: 'Test Issue 2' }];
      mockLinearClient.issues
        .mockResolvedValueOnce({ nodes: mockIssues.slice(0, 1) as Issue[], pageInfo: { hasNextPage: true, endCursor: 'cursor' } } as IssueConnection)
        .mockResolvedValueOnce({ nodes: mockIssues.slice(1) as Issue[], pageInfo: { hasNextPage: false } } as IssueConnection);

      const result = await linearService.fetchAllIssues(mockCompanyId);

      expect(result).toEqual(mockIssues);
      expect(mockLinearClient.issues).toHaveBeenCalledTimes(2);
      expect(mockLinearClient.issues).toHaveBeenCalledWith({ first: 100, after: null });
      expect(mockLinearClient.issues).toHaveBeenCalledWith({ first: 100, after: 'cursor' });
    });

    it('should handle errors when fetching all issues', async () => {
      mockLinearClient.issues.mockRejectedValue(new Error('API Error'));

      await expect(linearService.fetchAllIssues(mockCompanyId)).rejects.toThrow('Error fetching all issues');
    });
  });

  describe('fetchIssuesByUser', () => {
    it('should fetch issues by user successfully', async () => {
      const mockIssues: Partial<Issue>[] = [{ id: '1', title: 'User Issue' }];
      mockLinearClient.issues.mockResolvedValue({ nodes: mockIssues as Issue[] } as IssueConnection);

      const result = await linearService.fetchIssuesByUser(mockCompanyId, 'user-id');

      expect(result).toEqual(mockIssues);
      expect(mockLinearClient.issues).toHaveBeenCalledWith({
        filter: {
          assignee: { id: { eq: 'user-id' } }
        }
      });
    });

    it('should handle errors when fetching issues by user', async () => {
      mockLinearClient.issues.mockRejectedValue(new Error('API Error'));

      await expect(linearService.fetchIssuesByUser(mockCompanyId, 'user-id')).rejects.toThrow('Error fetching issues by user');
    });
  });

  describe('fetchIssuesByDate', () => {
    it('should fetch issues by date successfully', async () => {
      const mockIssues: Partial<Issue>[] = [{ id: '1', title: 'Recent Issue' }];
      mockLinearClient.issues.mockResolvedValue({ nodes: mockIssues as Issue[] } as IssueConnection);

      const result = await linearService.fetchIssuesByDate(mockCompanyId, 7);

      expect(result).toEqual(mockIssues);
      expect(mockLinearClient.issues).toHaveBeenCalledWith(expect.objectContaining({
        filter: expect.objectContaining({
          or: expect.arrayContaining([
            expect.objectContaining({ createdAt: expect.any(Object) }),
            expect.objectContaining({ updatedAt: expect.any(Object) })
          ])
        })
      }));
    });

    it('should handle errors when fetching issues by date', async () => {
      mockLinearClient.issues.mockRejectedValue(new Error('API Error'));

      await expect(linearService.fetchIssuesByDate(mockCompanyId, 7)).rejects.toThrow('Error fetching issues by date');
    });
  });

  describe('fetchUserList', () => {
    it('should fetch user list successfully', async () => {
      const mockUsers: Partial<User>[] = [{ id: '1', name: 'Test User' }];
      mockLinearClient.users.mockResolvedValue({ nodes: mockUsers as User[] } as UserConnection);

      const result = await linearService.fetchUserList(mockCompanyId);

      expect(result).toEqual(mockUsers);
      expect(mockLinearClient.users).toHaveBeenCalled();
    });

    it('should handle errors when fetching user list', async () => {
      mockLinearClient.users.mockRejectedValue(new Error('API Error'));

      await expect(linearService.fetchUserList(mockCompanyId)).rejects.toThrow('Error fetching user list');
    });
  });
});