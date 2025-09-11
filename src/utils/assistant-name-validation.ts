/**
 * Validation utilities for assistant names
 */

/**
 * Valid name patterns:
 * - agentname (lowercase)
 * - agentName (camelCase)
 * - agent-name (kebab-case)
 * - agent_name (snake_case)
 * - AgentName (PascalCase)
 *
 * Invalid patterns:
 * - agent name (spaces)
 * - agent.name (dots)
 * - agent@name (special characters)
 * - agent! (punctuation)
 */
const VALID_NAME_PATTERN = /^[a-zA-Z0-9]+([_-][a-zA-Z0-9]+)*$/;

/**
 * Validate if an assistant name follows the allowed naming convention
 * @param name - The assistant name to validate
 * @returns true if valid, false otherwise
 */
export const isValidAssistantName = (name: string): boolean => {
  if (!name || typeof name !== 'string') {
    return false;
  }

  // Check length constraints
  if (name.length < 2 || name.length > 50) {
    return false;
  }

  // Check pattern
  return VALID_NAME_PATTERN.test(name);
};

/**
 * Get a descriptive error message for invalid names
 * @param name - The invalid name
 * @returns Error message describing what's wrong
 */
export const getNameValidationError = (name: string): string => {
  if (!name) {
    return 'Assistant name is required';
  }

  if (name.length < 2) {
    return 'Assistant name must be at least 2 characters long';
  }

  if (name.length > 50) {
    return 'Assistant name must not exceed 50 characters';
  }

  if (name.includes(' ')) {
    return 'Assistant name cannot contain spaces. Use hyphens (-) or underscores (_) instead';
  }

  if (!VALID_NAME_PATTERN.test(name)) {
    return 'Assistant name can only contain letters, numbers, hyphens (-), and underscores (_). Special characters and spaces are not allowed';
  }

  return 'Invalid assistant name format';
};

/**
 * Suggest a valid name based on an invalid input
 * @param invalidName - The invalid name to convert
 * @returns A suggested valid name
 */
export const suggestValidName = (invalidName: string): string => {
  if (!invalidName) return '';

  // Convert to lowercase and replace spaces with hyphens
  let suggested = invalidName
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/[^a-z0-9_-]/g, '') // Remove invalid characters
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens

  // Ensure it's not empty after cleaning
  if (!suggested) {
    suggested = 'assistant';
  }

  // Ensure minimum length
  if (suggested.length < 2) {
    suggested = suggested + '1';
  }

  // Truncate if too long
  if (suggested.length > 50) {
    suggested = suggested.substring(0, 50);
  }

  return suggested;
};
