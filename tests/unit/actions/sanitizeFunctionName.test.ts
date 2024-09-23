import { sanitizeFunctionName } from '../../../src/integrations/actions/factory';

describe('sanitizeFunctionName', () => {
  it('should return the same name when input contains only alphanumeric characters', () => {
    const input = 'validFunctionName';
    const result = sanitizeFunctionName(input);
    expect(result).toBe('validFunctionName');
  });

  it('should replace special characters with underscores', () => {
    const input = 'invalid-function$name!';
    const result = sanitizeFunctionName(input);
    expect(result).toBe('invalid_function_name');
  });

  it('should replace spaces with underscores', () => {
    const input = 'function name with spaces';
    const result = sanitizeFunctionName(input);
    expect(result).toBe('function_name_with_spaces');
  });

  it('should return an empty string when input is empty', () => {
    const input = '';
    const result = sanitizeFunctionName(input);
    expect(result).toBe('');
  });

  it('should handle non-ASCII characters correctly', () => {
    const input = 'função-ñame';
    const result = sanitizeFunctionName(input);
    expect(result).toBe('funcao_name');
  });

  it('should remove leading and trailing underscores', () => {
    const input = '_function_name_';
    const result = sanitizeFunctionName(input);
    expect(result).toBe('function_name');
  });
});