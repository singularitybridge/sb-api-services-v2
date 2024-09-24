import { processTemplate } from '../../../src/services/template.service';
import * as sessionContextService from '../../../src/services/session-context.service';

jest.mock('../../../src/services/session-context.service');

describe('Template Service', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should render template with valid data', async () => {
    const mockData = { name: 'John', age: 30 };
    (sessionContextService.getSessionContextData as jest.Mock).mockResolvedValue(mockData);

    const template = 'Hello {{name}}, you are {{age}} years old.';
    const result = await processTemplate(template, 'test-session-id');

    expect(result).toBe('Hello John, you are 30 years old.');
  });

  it('should handle missing data fields', async () => {
    const mockData = { name: 'John' };
    (sessionContextService.getSessionContextData as jest.Mock).mockResolvedValue(mockData);

    const template = 'Hello {{name}}, you are {{age}} years old.';
    const result = await processTemplate(template, 'test-session-id');

    expect(result).toBe('Hello John, you are  years old.');
  });

  it('should render template with complex nested data', async () => {
    const mockData = {
      user: {
        name: 'John',
        address: {
          city: 'New York',
          country: 'USA'
        }
      },
      items: ['apple', 'banana', 'orange']
    };
    (sessionContextService.getSessionContextData as jest.Mock).mockResolvedValue(mockData);

    const template = '{{user.name}} lives in {{user.address.city}}, {{user.address.country}}. Favorite fruits: {{#each items}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}';
    const result = await processTemplate(template, 'test-session-id');

    expect(result).toBe('John lives in New York, USA. Favorite fruits: apple, banana, orange');
  });

  it('should return original template on error', async () => {
    (sessionContextService.getSessionContextData as jest.Mock).mockRejectedValue(new Error('Test error'));

    const template = 'Hello {{name}}';
    const result = await processTemplate(template, 'test-session-id');

    expect(result).toBe(template);
    expect(console.error).toHaveBeenCalledWith('Error processing template:', expect.any(Error));
  });
});