/**
 * Jira Projects Service
 * Handles project information retrieval
 */

import { initializeClient, executeJiraRequest } from '../client';
import { Result, JiraProject } from '../types';

// ============================================================================
// Get Project Info
// ============================================================================

/**
 * Get project details by project key or ID
 * @param companyId - Company ID for credentials
 * @param projectKeyOrId - The project key (e.g., "PROJ") or numeric ID
 */
export const getProject = async (
  companyId: string,
  projectKeyOrId: string,
): Promise<Result<JiraProject>> => {
  try {
    const client = await initializeClient(companyId);

    const response = await executeJiraRequest<any>(
      client,
      {
        method: 'GET',
        url: `/rest/api/3/project/${projectKeyOrId}`,
        params: {
          expand: 'description,lead,url',
        },
      },
      `Failed to get project ${projectKeyOrId}`,
    );

    if (!response || !response.id) {
      return {
        success: false,
        error: `Error fetching project ${projectKeyOrId}. Unexpected response format.`,
      };
    }

    const project: JiraProject = {
      id: response.id,
      key: response.key,
      name: response.name,
      projectTypeKey: response.projectTypeKey,
      simplified: response.simplified,
      style: response.style,
      isPrivate: response.isPrivate,
      description: response.description,
      lead: response.lead
        ? {
            accountId: response.lead.accountId,
            displayName: response.lead.displayName,
            emailAddress: response.lead.emailAddress,
          }
        : undefined,
      url: response.url,
      avatarUrls: response.avatarUrls,
    };

    return {
      success: true,
      data: project,
      message: `Retrieved project ${project.key}: ${project.name}`,
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to get project ${projectKeyOrId}: ${error.message || 'Unknown error'}`,
    };
  }
};

// ============================================================================
// List Projects
// ============================================================================

/**
 * Get all projects accessible to the user
 * @param companyId - Company ID for credentials
 * @param options - Optional parameters for filtering/pagination
 */
export const listProjects = async (
  companyId: string,
  options?: {
    startAt?: number;
    maxResults?: number;
    orderBy?: string;
    query?: string;
    typeKey?: string;
    expand?: string;
  },
): Promise<Result<{ projects: JiraProject[]; total: number }>> => {
  try {
    const client = await initializeClient(companyId);

    const response = await executeJiraRequest<any>(
      client,
      {
        method: 'GET',
        url: '/rest/api/3/project/search',
        params: {
          startAt: options?.startAt || 0,
          maxResults: options?.maxResults || 50,
          orderBy: options?.orderBy,
          query: options?.query,
          typeKey: options?.typeKey,
          expand: options?.expand || 'description,lead',
        },
      },
      'Failed to list projects',
    );

    if (!response || !Array.isArray(response.values)) {
      return {
        success: false,
        error: 'Error listing projects. Unexpected response format.',
      };
    }

    const projects: JiraProject[] = response.values.map((p: any) => ({
      id: p.id,
      key: p.key,
      name: p.name,
      projectTypeKey: p.projectTypeKey,
      simplified: p.simplified,
      style: p.style,
      isPrivate: p.isPrivate,
      description: p.description,
      lead: p.lead
        ? {
            accountId: p.lead.accountId,
            displayName: p.lead.displayName,
            emailAddress: p.lead.emailAddress,
          }
        : undefined,
      url: p.url,
      avatarUrls: p.avatarUrls,
    }));

    return {
      success: true,
      data: {
        projects,
        total: response.total || projects.length,
      },
      message: `Found ${projects.length} projects`,
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to list projects: ${error.message || 'Unknown error'}`,
    };
  }
};
