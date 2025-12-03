/**
 * Jira Fields Service
 * Handles field discovery and caching for custom fields
 */

import { initializeClient } from '../client';
import { Result } from '../types';

// ============================================================================
// Field ID Caches (in-memory, per-process)
// ============================================================================

let sprintFieldIdCache: string | null = null;
let storyPointsFieldIdCache: string | null = null;

/**
 * Clear all field caches (useful for testing)
 */
export const clearFieldCaches = (): void => {
  sprintFieldIdCache = null;
  storyPointsFieldIdCache = null;
};

// ============================================================================
// Get All Fields
// ============================================================================

/**
 * Get all available issue fields from Jira
 * @param companyId - Company ID for credentials
 */
export const getJiraFields = async (
  companyId: string,
): Promise<Result<any[]>> => {
  try {
    const client = await initializeClient(companyId);
    const fields = await client.issueFields.getFields();
    return { success: true, data: fields };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to fetch JIRA fields: ${error?.message || 'Unknown error'}`,
    };
  }
};

// ============================================================================
// Sprint Field Discovery
// ============================================================================

const COMMON_SPRINT_FIELD_NAMES = ['Sprint', 'Target Sprint'];

/**
 * Find the sprint field ID dynamically
 * Uses caching to avoid repeated API calls
 */
export const findSprintFieldId = async (
  companyId: string,
): Promise<Result<{ fieldId: string | null }>> => {
  // Return from cache if available
  if (sprintFieldIdCache) {
    return { success: true, data: { fieldId: sprintFieldIdCache } };
  }

  try {
    const fieldsResult = await getJiraFields(companyId);

    if (!fieldsResult.success || !Array.isArray(fieldsResult.data)) {
      return {
        success: false,
        error: fieldsResult.error || 'Failed to fetch Jira fields for sprint ID discovery.',
      };
    }

    const sprintField = fieldsResult.data.find((field: any) => {
      const nameMatches = COMMON_SPRINT_FIELD_NAMES.some(
        (name) => field.name?.toLowerCase() === name.toLowerCase(),
      );

      if (!nameMatches) return false;

      // Validate schema type
      const isSprintField =
        (field.schema?.type === 'array' && field.schema?.items === 'sprint') ||
        field.schema?.custom?.toLowerCase().includes('sprint') ||
        field.clauseNames?.includes('sprint');

      return isSprintField;
    });

    if (sprintField?.id) {
      sprintFieldIdCache = sprintField.id;
      return { success: true, data: { fieldId: sprintField.id } };
    }

    return {
      success: true,
      data: { fieldId: null },
      message: 'Sprint field ID not found by common names/schema.',
    };
  } catch (error: any) {
    console.error('Error finding sprint field ID:', error);
    return {
      success: false,
      error: `Error finding sprint field ID: ${error.message}`,
    };
  }
};

/**
 * Get the sprint field ID, with fallback to common default
 */
export const getSprintFieldId = async (companyId: string): Promise<string> => {
  if (sprintFieldIdCache) return sprintFieldIdCache;

  const result = await findSprintFieldId(companyId);
  if (result.success && result.data?.fieldId) {
    return result.data.fieldId;
  }

  // Fallback to common default
  console.warn(
    `Could not dynamically find sprint field ID, falling back to customfield_10020`,
  );
  return 'customfield_10020';
};

// ============================================================================
// Story Points Field Discovery
// ============================================================================

const COMMON_STORY_POINTS_NAMES = [
  'story points',
  'story point estimate',
  'σ story points',
  'storypoints',
  'story point',
  'sp',
  'points',
];

/**
 * Find the story points field ID dynamically
 * Uses caching to avoid repeated API calls
 */
export const findStoryPointsFieldId = async (
  companyId: string,
): Promise<string | null> => {
  // Return from cache if available
  if (storyPointsFieldIdCache) {
    return storyPointsFieldIdCache;
  }

  try {
    const fieldsResult = await getJiraFields(companyId);

    if (!fieldsResult.success || !Array.isArray(fieldsResult.data)) {
      return null;
    }

    // First try: Match by name with type checking
    let storyPointField = fieldsResult.data.find((field: any) => {
      const fieldNameLower = field.name?.toLowerCase() || '';
      const matchesName =
        COMMON_STORY_POINTS_NAMES.some((name) => fieldNameLower === name) ||
        fieldNameLower.includes('story point');

      if (!matchesName) return false;

      // Accept various numeric field types
      const schemaType = field.schema?.type;
      const schemaCustom = field.schema?.custom?.toLowerCase() || '';

      return (
        schemaType === 'number' ||
        schemaCustom.includes('float') ||
        schemaCustom.includes('number') ||
        schemaCustom.includes('story-points') ||
        schemaCustom.includes('storypoints') ||
        schemaCustom.includes('gh-story-points')
      );
    });

    // Second try: Match by exact name only (for unusual configs)
    if (!storyPointField) {
      storyPointField = fieldsResult.data.find((field: any) => {
        const fieldNameLower = field.name?.toLowerCase() || '';
        return (
          fieldNameLower === 'story points' ||
          fieldNameLower === 'story point estimate'
        );
      });
    }

    if (storyPointField?.id) {
      storyPointsFieldIdCache = storyPointField.id;
      return storyPointField.id;
    }

    return null;
  } catch (error) {
    console.error('[findStoryPointsFieldId] Error:', error);
    return null;
  }
};

// ============================================================================
// Field Resolution Helpers
// ============================================================================

/**
 * Replace field aliases with actual field IDs in a fields array
 * Useful for resolving 'storyPoints' -> actual custom field ID
 */
export const resolveFieldAliases = async (
  companyId: string,
  fields: string[],
): Promise<string[]> => {
  const resolvedFields = [...fields];

  // Resolve storyPoints alias
  const storyPointsIndex = resolvedFields.findIndex(
    (f) => f.toLowerCase() === 'storypoints',
  );

  if (storyPointsIndex !== -1) {
    const storyPointsFieldId = await findStoryPointsFieldId(companyId);
    if (storyPointsFieldId) {
      resolvedFields.splice(storyPointsIndex, 1, storyPointsFieldId);
    } else {
      console.warn(
        "Could not resolve 'storyPoints' to a field ID. It will be excluded.",
      );
      resolvedFields.splice(storyPointsIndex, 1);
    }
  }

  return resolvedFields;
};
