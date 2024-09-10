import { LinearService } from '../../../src/services/linear.service';
import { LinearClient } from '@linear/sdk';

jest.mock('@linear/sdk');

describe('LinearService', () => {
  let linearService: LinearService;
  let mockLinearClient: jest.Mocked<LinearClient>;

  beforeEach(() => {
    mockLinearClient = new LinearClient({ apiKey: 'mock-api-key' }) as jest.Mocked<LinearClient>;
    linearService = new LinearService('mock-api-key');
    (linearService as any).linearClient = mockLinearClient;
  });

  describe('fetchIssues', () => {
    it('should fetch issues successfully', async () => {
      const mockIssues = [{ id: '1', title: 'Test Issue' }];
      mockLinearClient.issues.mockResolvedValue({ nodes: mockIssues } as any);

      const result = await linearService.fetchIssues();

      expect(result).toEqual(mockIssues);
      expect(mockLinearClient.issues).toHaveBeenCalledWith({ first: 50 });
    });

    it('should handle errors when fetching issues', async () => {
      mockLinearClient.issues.mockRejectedValue(new Error('API Error'));

      await expect(linearService.fetchIssues()).rejects.toThrow('Error fetching issues');
    });
  });

  describe('createIssue', () => {
    it('should create an issue successfully', async () => {
      const mockIssue = { id: '1', title: 'New Issue' };
      mockLinearClient.createIssue.mockResolvedValue(mockIssue as any);

      const result = await linearService.createIssue('New Issue', 'Description', 'team-id');

      expect(result).toEqual(mockIssue);
      expect(mockLinearClient.createIssue).toHaveBeenCalledWith({
        title: 'New Issue',
        description: 'Description',
        teamId: 'team-id'
      });
    });

    it('should handle errors when creating an issue', async () => {
      mockLinearClient.createIssue.mockRejectedValue(new Error('API Error'));

      await expect(linearService.createIssue('New Issue', 'Description', 'team-id')).rejects.toThrow('Error creating issue');
    });
  });

  describe('updateIssue', () => {
    it('should update an issue successfully', async () => {
      mockLinearClient.updateIssue.mockResolvedValue({ success: true } as any);

      await linearService.updateIssue('issue-id', { title: 'Updated Issue', state: 'In Progress' });

      expect(mockLinearClient.updateIssue).toHaveBeenCalledWith('issue-id', { title: 'Updated Issue', state: 'In Progress' });
    });

    it('should handle errors when updating an issue', async () => {
      mockLinearClient.updateIssue.mockRejectedValue(new Error('API Error'));

      await expect(linearService.updateIssue('issue-id', { title: 'Updated Issue' })).rejects.toThrow('Error updating issue');
    });
  });

  describe('deleteIssue', () => {
    it('should delete an issue successfully', async () => {
      mockLinearClient.deleteIssue.mockResolvedValue({ success: true } as any);

      await linearService.deleteIssue('issue-id');

      expect(mockLinearClient.deleteIssue).toHaveBeenCalledWith('issue-id');
    });

    it('should handle errors when deleting an issue', async () => {
      mockLinearClient.deleteIssue.mockRejectedValue(new Error('API Error'));

      await expect(linearService.deleteIssue('issue-id')).rejects.toThrow('Error deleting issue');
    });
  });

  describe('fetchAllIssues', () => {
    it('should fetch all issues successfully', async () => {
      const mockIssues = [{ id: '1', title: 'Test Issue 1' }, { id: '2', title: 'Test Issue 2' }];
      mockLinearClient.issues.mockResolvedValueOnce({ nodes: mockIssues.slice(0, 1), pageInfo: { hasNextPage: true, endCursor: 'cursor' } } as any);
      mockLinearClient.issues.mockResolvedValueOnce({ nodes: mockIssues.slice(1), pageInfo: { hasNextPage: false } } as any);

      const result = await linearService.fetchAllIssues();

      expect(result).toEqual(mockIssues);
      expect(mockLinearClient.issues).toHaveBeenCalledTimes(2);
      expect(mockLinearClient.issues).toHaveBeenCalledWith({ first: 100, after: null });
      expect(mockLinearClient.issues).toHaveBeenCalledWith({ first: 100, after: 'cursor' });
    });

    it('should handle errors when fetching all issues', async () => {
      mockLinearClient.issues.mockRejectedValue(new Error('API Error'));

      await expect(linearService.fetchAllIssues()).rejects.toThrow('Error fetching all issues');
    });
  });
});