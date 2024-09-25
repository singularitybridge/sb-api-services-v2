import axios from 'axios';
import { createAIAgentExecutorActions } from '../aiAgentExecutor.actions';
import { ActionContext } from '../../actions/types';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('AI Agent Executor Actions', () => {
  const context: ActionContext = {
    companyId: 'testCompany',
    sessionId: 'testSession',
  };

  const actions = createAIAgentExecutorActions(context);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should execute a command successfully', async () => {
    mockedAxios.post.mockResolvedValue({ data: { result: 'Command executed' } });

    const result = await actions.executeCommand.function({ command: 'echo "Hello World"' });

    expect(result.success).toBe(true);
    expect(result.data).toBe('Command executed');
    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('/execute'),
      { command: 'echo "Hello World"', runInBackground: undefined },
      expect.any(Object)
    );
  });

  it('should get process status successfully', async () => {
    mockedAxios.get.mockResolvedValue({ data: { status: 'running' } });

    const result = await actions.getProcessStatus.function({ pid: '12345' });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ status: 'running' });
    expect(mockedAxios.get).toHaveBeenCalledWith(
      expect.stringContaining('/process/12345'),
      expect.any(Object)
    );
  });

  it('should stop a process successfully', async () => {
    mockedAxios.post.mockResolvedValue({ data: { message: 'Process stopped' } });

    const result = await actions.stopProcess.function({ pid: '12345' });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ message: 'Process stopped' });
    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('/process/12345/stop'),
      {},
      expect.any(Object)
    );
  });

  it('should perform a file operation successfully', async () => {
    mockedAxios.post.mockResolvedValue({ data: { result: 'File operation completed' } });

    const result = await actions.fileOperation.function({
      operation: 'read',
      path: '/test/file.txt',
    });

    expect(result.success).toBe(true);
    expect(result.data).toBe('File operation completed');
    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('/file-operation'),
      { operation: 'read', path: '/test/file.txt' },
      expect.any(Object)
    );
  });

  it('should stop execution successfully', async () => {
    mockedAxios.post.mockResolvedValue({ data: { message: 'Execution stopped' } });

    const result = await actions.stopExecution.function();

    expect(result.success).toBe(true);
    expect(result.data).toBe('Execution stopped');
    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('/stop-execution'),
      {},
      expect.any(Object)
    );
  });

  it('should handle errors gracefully', async () => {
    mockedAxios.post.mockRejectedValue(new Error('API Error'));

    const result = await actions.executeCommand.function({ command: 'invalid command' });

    expect(result.success).toBe(false);
    expect(result.error).toBe('API Error');
  });
});