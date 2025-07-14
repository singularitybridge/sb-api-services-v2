import { createTerminalTurtleActions } from '../terminal_turtle.actions';
import { ActionContext } from '../../actions/types';
import axios from 'axios';
import { SupportedLanguage } from '../../../services/discovery.service';
import * as apiKeyService from '../../../services/api.key.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

jest.mock('../../../services/api.key.service');
const mockedApiKeyService = apiKeyService as jest.Mocked<typeof apiKeyService>;

// Import or define the TerminalTurtleResponse interface
interface TerminalTurtleResponse {
  success: boolean;
  data?: any;
  error?: string;
}

describe('Terminal Turtle Actions', () => {
  let actions: ReturnType<typeof createTerminalTurtleActions>;

  beforeEach(() => {
    // Reset mocks
    mockedAxios.post.mockReset();
    mockedAxios.get.mockReset();
    mockedApiKeyService.getApiKey.mockReset();

    // Setup default mock implementations for getApiKey
    mockedApiKeyService.getApiKey.mockImplementation(
      async (companyId, keyName) => {
        if (keyName === 'executor_agent_token') return 'mock-executor-token';
        if (keyName === 'executor_agent_url')
          return 'http://mock-executor-url.com';
        return null;
      },
    );

    const context: ActionContext = {
      sessionId: 'test-session',
      companyId: 'test-company', // This will be used by getApiKey mock
      language: 'en' as SupportedLanguage,
    };
    actions = createTerminalTurtleActions(context);
  });

  it('should execute a command and handle immediate response', async () => {
    mockedAxios.post.mockResolvedValue({
      data: { output: 'Command executed', exitCode: 0, completed: true },
    });
    const result = (await actions.executeCommand.function({
      command: 'echo "Hello, World!"',
    })) as TerminalTurtleResponse;
    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      output: 'Command executed',
      exitCode: 0,
      completed: true,
    });
  });

  it('should execute a command and handle long-running task response', async () => {
    mockedAxios.post.mockResolvedValue({
      data: {
        taskId: 'task-123',
        initialOutput: 'Task started...',
        isLongRunning: true,
      },
    });
    const result = (await actions.executeCommand.function({
      command: 'npm run dev',
    })) as TerminalTurtleResponse;
    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      taskId: 'task-123',
      initialOutput: 'Task started...',
      isLongRunning: true,
    });
  });

  it('should get task status', async () => {
    const mockTaskData = {
      id: '12345',
      command: 'npm run dev',
      status: 'running',
      output: 'logs...',
      exitCode: null,
      error: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockedAxios.get.mockResolvedValue({ data: mockTaskData });
    // Corrected action name
    const result = (await actions.getTaskStatus.function({
      taskId: '12345',
    })) as TerminalTurtleResponse;
    expect(result.success).toBe(true);
    expect(result.data).toEqual(mockTaskData);
  });

  it('should end a task', async () => {
    const mockEndTaskResponse = {
      message: 'Task task-123 ended successfully.',
      taskId: 'task-123',
    };
    mockedAxios.post.mockResolvedValue({ data: mockEndTaskResponse });
    // Corrected action name and parameters
    const result = (await actions.endTask.function({
      taskId: 'task-123',
    })) as TerminalTurtleResponse;
    expect(result.success).toBe(true);
    expect(result.data).toEqual(mockEndTaskResponse);
  });

  it('should perform file operations', async () => {
    const mockFileOpResponse = {
      success: true,
      result: 'File operation completed',
    };
    mockedAxios.post.mockResolvedValue({ data: mockFileOpResponse });
    // Corrected action name
    const result = (await actions.performFileOperation.function({
      operation: 'read',
      path: '/path/to/file.txt',
    })) as TerminalTurtleResponse;
    expect(result.success).toBe(true);
    expect(result.data).toBe('File operation completed');
  });

  // Commenting out stopExecution test as the action does not exist
  // it('should stop execution', async () => {
  //   mockedAxios.post.mockResolvedValue({ data: { message: 'Execution stopped' } });
  //   const result = await actions.stopExecution.function({}) as TerminalTurtleResponse;
  //   expect(result.success).toBe(true);
  //   expect(result.data).toBe('Execution stopped');
  // });

  it('should handle errors from executeCommand', async () => {
    mockedAxios.post.mockRejectedValue(new Error('API Error'));
    const result = (await actions.executeCommand.function({
      command: 'invalid_command',
    })) as TerminalTurtleResponse;
    expect(result.success).toBe(false);
    expect(result.error).toBe('API Error');
  });
});
