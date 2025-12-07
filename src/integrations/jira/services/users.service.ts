/**
 * Jira Users Service
 * Handles user search and ticket assignment
 */

import { Version3Models } from 'jira.js';
import { initializeClient } from '../client';
import { Result, SimplifiedUser } from '../types';
import { updateTicket } from './tickets.service';

// ============================================================================
// Search Users
// ============================================================================

/**
 * Search for Jira users
 * Filters out bots/service accounts, returning only real users
 */
export const searchUsers = async (
  companyId: string,
  options?: {
    query?: string;
    accountId?: string;
    startAt?: number;
    maxResults?: number;
  },
): Promise<Result<SimplifiedUser[]>> => {
  try {
    const client = await initializeClient(companyId);

    const searchParams: any = {
      query: options?.query || '',
      startAt: options?.startAt || 0,
      maxResults: Math.min(options?.maxResults || 50, 50), // Max 50 users
    };

    const users: Version3Models.User[] =
      await client.userSearch.findUsers(searchParams);

    // Filter to only real users (accountType: "atlassian"), exclude bots/apps
    const realUsers = users.filter((user) => user.accountType === 'atlassian');

    // Simplify user data
    const simplifiedUsers: SimplifiedUser[] = realUsers.map((user) => ({
      accountId: user.accountId!,
      displayName: user.displayName,
      emailAddress: user.emailAddress,
    }));

    return { success: true, data: simplifiedUsers };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to search JIRA users: ${error?.message || 'Unknown error'}`,
    };
  }
};

// ============================================================================
// Get User by Account ID
// ============================================================================

/**
 * Get a specific user by their account ID
 */
export const getUserByAccountId = async (
  companyId: string,
  accountId: string,
): Promise<Result<SimplifiedUser>> => {
  try {
    const client = await initializeClient(companyId);

    const user = await client.users.getUser({ accountId });

    if (!user || user.accountType !== 'atlassian') {
      return {
        success: false,
        error: `User with account ID ${accountId} not found or is not a valid user.`,
      };
    }

    return {
      success: true,
      data: {
        accountId: user.accountId!,
        displayName: user.displayName,
        emailAddress: user.emailAddress,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to get user: ${error?.message || 'Unknown error'}`,
    };
  }
};

// ============================================================================
// Assign Ticket
// ============================================================================

/**
 * Assign a ticket to a user
 * @param accountId - User's account ID, or null to unassign
 */
export const assignTicket = async (
  companyId: string,
  issueIdOrKey: string,
  accountId: string | null,
): Promise<Result<{ id: string; message: string }>> => {
  const fieldsToUpdate = {
    assignee: accountId ? { accountId } : null,
  };

  const result = await updateTicket(companyId, issueIdOrKey, fieldsToUpdate);

  if (result.success) {
    const action = accountId ? `assigned to ${accountId}` : 'unassigned';
    return {
      success: true,
      data: {
        id: issueIdOrKey,
        message: `Ticket ${issueIdOrKey} ${action}.`,
      },
    };
  }

  return result;
};

// ============================================================================
// Get Assignable Users for Issue
// ============================================================================

/**
 * Get users that can be assigned to a specific issue
 */
export const getAssignableUsers = async (
  companyId: string,
  issueIdOrKey: string,
  query?: string,
  maxResults: number = 50,
): Promise<Result<SimplifiedUser[]>> => {
  try {
    const client = await initializeClient(companyId);

    const users = await client.userSearch.findAssignableUsers({
      issueKey: issueIdOrKey,
      query: query || '',
      maxResults: Math.min(maxResults, 50),
    });

    // Filter to only real users
    const realUsers = users.filter((user) => user.accountType === 'atlassian');

    const simplifiedUsers: SimplifiedUser[] = realUsers.map((user) => ({
      accountId: user.accountId!,
      displayName: user.displayName,
      emailAddress: user.emailAddress,
    }));

    return { success: true, data: simplifiedUsers };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to get assignable users: ${error?.message || 'Unknown error'}`,
    };
  }
};

// ============================================================================
// Get Current User
// ============================================================================

/**
 * Get the currently authenticated user
 */
export const getCurrentUser = async (
  companyId: string,
): Promise<Result<SimplifiedUser>> => {
  try {
    const client = await initializeClient(companyId);

    const user = await client.myself.getCurrentUser();

    return {
      success: true,
      data: {
        accountId: user.accountId!,
        displayName: user.displayName,
        emailAddress: user.emailAddress,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to get current user: ${error?.message || 'Unknown error'}`,
    };
  }
};
