import { createAIAgentExecutorActions } from '../aiAgentExecutor.actions';
import { ActionContext } from '../../actions/types';
import axios from 'axios';
import { SupportedLanguage } from '../../../services/discovery.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Import or define the AIAgentExecutorResponse interface
interface AIAgentExecutorResponse {
  success: boolean;
  data?: any;
  error?: string;
}

describe('AI Agent Executor Actions', () => {
  let actions: ReturnType<typeof createAIAgentExecutorActions>;

  beforeEach(() => {
    const context: ActionContext = {
      sessionId: 'test-session',
      companyId: 'test-company',
      language: 'en' as SupportedLanguage
    };
    actions = createAIAgentExecutorActions(context);
  });

  it('should execute a command', async () => {
    mockedAxios.post.mockResolvedValue({ data: { result: 'Command executed' } });
    const result = await actions.executeCommand.function({ command: 'echo "Hello, World!"', runInBackground: false }) as AIAgentExecutorResponse;
    expect(result.success).toBe(true);
    expect(result.data).toBe('Command executed');
  });

  it('should get process status', async () => {
    mockedAxios.get.mockResolvedValue({ data: { status: 'running' } });
    const result = await actions.getProcessStatus.function({ pid: '12345' }) as AIAgentExecutorResponse;
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ status: 'running' });
  });

  it('should stop a process', async () => {
    mockedAxios.post.mockResolvedValue({ data: { message: 'Process stopped' } });
    const result = await actions.stopProcess.function({ pid: '12345' }) as AIAgentExecutorResponse;
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ message: 'Process stopped' });
  });

  it('should perform file operations', async () => {
    mockedAxios.post.mockResolvedValue({ data: { result: 'File operation completed' } });
    const result = await actions.fileOperation.function({
      operation: 'read',
      path: '/path/to/file.txt'
    }) as AIAgentExecutorResponse;
    expect(result.success).toBe(true);
    expect(result.data).toBe('File operation completed');
  });

  it('should stop execution', async () => {
    mockedAxios.post.mockResolvedValue({ data: { message: 'Execution stopped' } });
    const result = await actions.stopExecution.function({}) as AIAgentExecutorResponse;
    expect(result.success).toBe(true);
    expect(result.data).toBe('Execution stopped');
  });

  it('should handle errors', async () => {
    mockedAxios.post.mockRejectedValue(new Error('API Error'));
    const result = await actions.executeCommand.function({ command: 'invalid_command' }) as AIAgentExecutorResponse;
    expect(result.success).toBe(false);
    expect(result.error).toBe('API Error');
  });
});
