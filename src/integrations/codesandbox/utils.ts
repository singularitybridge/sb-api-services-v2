/**
 * Safely escapes a string for use in shell commands
 * Handles the tricky case of single quotes by using the '\'' pattern
 */
export function shellEscape(str: string): string {
  return `'${str.replace(/'/g, "'\\''")}'`;
}