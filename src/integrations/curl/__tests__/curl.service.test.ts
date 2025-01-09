import { performCurlRequest } from '../curl.service';
import { ActionContext } from '../../actions/types';
import { SupportedLanguage } from '../../../services/discovery.service';

describe('curl.service', () => {
  const mockContext: ActionContext = {
    sessionId: 'test-session',
    companyId: 'test-company',
    language: 'en' as SupportedLanguage
  };

  const mockCurlCommand = `curl --location 'https://api.example.com/test' \
    --header 'Content-Type: application/json' \
    --data-raw '{"test": "data"}'`;

  it('should successfully execute a curl request', async () => {
    const result = await performCurlRequest(mockContext, mockCurlCommand);
    expect(result.status).toBeDefined();
    expect(result.data).toBeDefined();
    expect(result.headers).toBeDefined();
  });

  it('should handle request errors gracefully', async () => {
    const invalidCurlCommand = `curl --location 'https://invalid-url' \
      --header 'Content-Type: application/json'`;
    
    const result = await performCurlRequest(mockContext, invalidCurlCommand);
    expect(result.status).toBeGreaterThanOrEqual(400);
    expect(result.error).toBeDefined();
  });

  it('should properly handle XML responses', async () => {
    const xmlCurlCommand = `curl --location 'https://api.example.com/xml' \
      --header 'Content-Type: application/xml'`;
    
    const result = await performCurlRequest(mockContext, xmlCurlCommand);
    expect(result.status).toBeDefined();
    expect(typeof result.data).toBe('string');
  });

  it('should handle POST requests with form data', async () => {
    const formDataCurlCommand = `curl --location 'https://api.example.com/form' \
      --header 'Content-Type: application/x-www-form-urlencoded' \
      --data-urlencode 'key1=value1' \
      --data-urlencode 'key2=value2'`;
    
    const result = await performCurlRequest(mockContext, formDataCurlCommand);
    expect(result.status).toBeDefined();
    expect(result.data).toBeDefined();
  });
});
