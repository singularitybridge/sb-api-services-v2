import { LinearClient, Issue, IssueConnection, IssuePayload, User, UserConnection, Team, WorkflowState, WorkflowStateConnection } from "@linear/sdk";
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
      issue: jest.fn(),
      deleteIssue: jest.fn(),
      users: jest.fn(),
      workflowStates: jest.fn(),
    } as unknown as jest.Mocked<LinearClient>;

    (LinearClient as jest.Mock).mockImplementation(() => mockLinearClient);
    (apiKeyService.getApiKey as jest.Mock).mockResolvedValue(mockApiKey);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ... (other test cases remain unchanged)

  describe('updateIssue', () => {
    it('should update an issue successfully', async () => {
      const mockIssue = {
        update: jest.fn().mockResolvedValue({}),
      };
      mockLinearClient.issue.mockResolvedValue(mockIssue as unknown as Issue);

      const mockWorkflowStates: Partial<WorkflowState>[] = [
        { id: 'state-1', name: 'In Progress' },
        { id: 'state-2', name: 'Done' },
      ];
      const mockWorkflowStateConnection: Partial<WorkflowStateConnection> = {
        nodes: mockWorkflowStates as WorkflowState[],
        pageInfo: { hasNextPage: false, endCursor: null },
      };
      mockLinearClient.workflowStates.mockResolvedValue(mockWorkflowStateConnection as WorkflowStateConnection);

      await linearService.updateIssue(mockCompanyId, 'issue-id', { title: 'Updated Issue', status: 'In Progress' });

      expect(mockLinearClient.issue).toHaveBeenCalledWith('issue-id');
      expect(mockLinearClient.workflowStates).toHaveBeenCalled();
      expect(mockIssue.update).toHaveBeenCalledWith({
        title: 'Updated Issue',
        stateId: 'state-1',
      });
    });

    it('should handle errors when updating an issue', async () => {
      mockLinearClient.issue.mockRejectedValue(new Error('API Error'));

      await expect(linearService.updateIssue(mockCompanyId, 'issue-id', { title: 'Updated Issue' })).rejects.toThrow('Error updating issue');
    });

    it('should throw an error when the status is invalid', async () => {
      const mockIssue = {
        update: jest.fn().mockResolvedValue({}),
      };
      mockLinearClient.issue.mockResolvedValue(mockIssue as unknown as Issue);

      const mockWorkflowStates: Partial<WorkflowState>[] = [
        { id: 'state-1', name: 'In Progress' },
        { id: 'state-2', name: 'Done' },
      ];
      const mockWorkflowStateConnection: Partial<WorkflowStateConnection> = {
        nodes: mockWorkflowStates as WorkflowState[],
        pageInfo: { hasNextPage: false, endCursor: null },
      };
      mockLinearClient.workflowStates.mockResolvedValue(mockWorkflowStateConnection as WorkflowStateConnection);

      await expect(linearService.updateIssue(mockCompanyId, 'issue-id', { status: 'Invalid Status' })).rejects.toThrow('Invalid status');
    });
  });

  // ... (other test cases remain unchanged)
});