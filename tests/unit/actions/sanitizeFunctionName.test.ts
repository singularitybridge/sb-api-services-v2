import { sanitizeFunctionName } from '../../../src/integrations/actions/factory';

describe('sanitizeFunctionName', () => {
  it('should return the same name when input contains only alphanumeric characters', () => {
    const input = 'validFunctionName';
    const result = sanitizeFunctionName(input);
    expect(result).toBe('validFunctionName');
  });

  it('should remove special characters but keep hyphens and underscores', () => {
    const input = 'invalid-function$name!';
    const result = sanitizeFunctionName(input);
    expect(result).toBe('invalid-functionname');
  });

  it('should remove spaces', () => {
    const input = 'function name with spaces';
    const result = sanitizeFunctionName(input);
    expect(result).toBe('functionnamewithspaces');
  });

  it('should return an empty string when input is empty', () => {
    const input = '';
    const result = sanitizeFunctionName(input);
    expect(result).toBe('');
  });
 

  it('should not alter leading and trailing underscores or hyphens', () => {
    const input = '_function-name_';
    const result = sanitizeFunctionName(input);
    expect(result).toBe('_function-name_');
  });
});