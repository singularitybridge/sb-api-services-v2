import { performCurlRequest } from '../curl.service';
import { ActionContext } from '../../actions/types';
import { SupportedLanguage } from '../../../services/discovery.service';
import { exec } from 'child_process'; // Import exec to mock it

// Mock child_process.exec
jest.mock('child_process', () => ({
  ...jest.requireActual('child_process'), // Preserve other child_process exports
  exec: jest.fn(), // Mock exec
}));

// Cast exec to jest.Mock for type safety in tests
const mockExec = exec as unknown as jest.Mock;

describe('curl.service', () => {
  beforeEach(() => {
    // Reset the mock before each test to ensure test isolation
    mockExec.mockReset();
  });

  const mockContext: ActionContext = {
    sessionId: 'test-session',
    companyId: 'test-company',
    language: 'en' as SupportedLanguage,
  };

  const mockCurlCommand = `curl --location 'https://api.example.com/test' \
    --header 'Content-Type: application/json' \
    --data-raw '{"test": "data"}'`;

  it('should successfully execute a curl request and parse JSON', async () => {
    mockExec.mockImplementationOnce((commandStr, callback) => {
      // Simulate a successful JSON response
      const stdout = `{"message": "Success data from mock"}\nSTATUS_CODE:200`;
      callback(null, { stdout, stderr: '' });
    });
    const result = await performCurlRequest(mockContext, mockCurlCommand);
    expect(result.status).toBe(200);
    expect(result.data).toEqual({ message: 'Success data from mock' });
    expect(result.headers).toEqual({}); // Service currently always returns empty headers
    expect(result.error).toBeUndefined();
  });

  it('should handle request errors gracefully when exec fails', async () => {
    const invalidCurlCommand = `curl --location 'https://failing-url.example.com'`; // Command doesn't matter as much as mock behavior

    mockExec.mockImplementationOnce((commandStr, callback) => {
      // Simulate an error from exec itself (e.g., command not found, network issue caught by exec)
      callback(new Error('Simulated exec failure'), {
        stdout: '',
        stderr: 'Error output from exec',
      });
    });

    const result = await performCurlRequest(mockContext, invalidCurlCommand);
    expect(result.status).toBe(500); // performCurlRequest catch block returns 500
    expect(result.error).toBe('Simulated exec failure');
    expect(result.data).toBeNull();
  });

  it('should properly handle XML responses', async () => {
    const xmlCurlCommand = `curl --location 'https://api.example.com/xml' \
      --header 'Content-Type: application/xml'`;

    // Mock exec for this specific test case to return an XML string
    mockExec.mockImplementation((commandStr, callback) => {
      // Check if the command is the one we expect for XML
      if (commandStr.includes('https://api.example.com/xml')) {
        const stdout = `<note><to>User</to><from>Test</from><heading>Reminder</heading><body>XML Content</body></note>\nSTATUS_CODE:200`;
        // promisify(exec) expects callback(null, { stdout, stderr }) for success
        callback(null, { stdout, stderr: '' });
      } else {
        // Fallback for other commands or if the command matching is too simple
        callback(
          new Error('exec_mock_error: command_not_handled_for_xml_test'),
          { stdout: '', stderr: 'exec_mock_error' },
        );
      }
    });

    const result = await performCurlRequest(mockContext, xmlCurlCommand);
    expect(result.status).toBe(200);
    expect(typeof result.data).toBe('string');
    expect(result.data).toContain('<note>');
  });

  it('should handle POST requests with form data', async () => {
    const formDataCurlCommand = `curl --location 'https://api.example.com/form' \
      --header 'Content-Type: application/x-www-form-urlencoded' \
      --data-urlencode 'key1=value1' \
      --data-urlencode 'key2=value2'`;

    mockExec.mockImplementationOnce((commandStr, callback) => {
      // Simulate a successful response for a form post
      const stdout = `Form data processed successfully\nSTATUS_CODE:201`;
      callback(null, { stdout, stderr: '' });
    });

    const result = await performCurlRequest(mockContext, formDataCurlCommand);
    expect(result.status).toBe(201);
    expect(result.data).toBe('Form data processed successfully');
    expect(result.error).toBeUndefined();
  });
});
