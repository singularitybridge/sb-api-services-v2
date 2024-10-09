import { ActionContext } from '../../actions/types';
import { createCurlActions, CurlActionResponse } from '../curl.actions';

describe('Curl Actions', () => {
  const context: ActionContext = {
    companyId: 'companyId',
    sessionId: 'sessionId',
  };

  const actions = createCurlActions(context);

  it('should perform a GET request successfully', async () => {
    const args = {
      url: 'https://jsonplaceholder.typicode.com/todos/1',
    };

    const result = await actions.performCurlRequest.function(args) as CurlActionResponse;

    expect(result).toHaveProperty('status', 200);
    expect(result).toHaveProperty('data');
    expect(result.data).toHaveProperty('id', 1);
    expect(result.data).toHaveProperty('title');
  });

  it('should return an error for invalid URL', async () => {
    const args = {
      url: 'ftp://invalid-url',
    };

    const result = await actions.performCurlRequest.function(args) as CurlActionResponse;

    expect(result).toHaveProperty('error');
    expect(result.error).toMatch(/Invalid URL|Request failed/);
  });
});