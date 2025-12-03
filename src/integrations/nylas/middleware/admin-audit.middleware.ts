/**
 * Admin Audit Middleware
 *
 * Automatically logs admin actions when accessing other users' data.
 * Used by Nylas actions to create audit trail for compliance.
 */

import mongoose from 'mongoose';
import { AdminActionLog } from '../models/AdminActionLog';

export interface AdminAuditContext {
  adminUserId: mongoose.Types.ObjectId | string;
  targetUserId: mongoose.Types.ObjectId | string;
  companyId: mongoose.Types.ObjectId | string;
  action: string;
  resourceType: 'email' | 'calendar' | 'contact' | 'other';
  method: 'read' | 'create' | 'update' | 'delete';
  resourceId?: string;
  requestParams?: any;
  sessionId?: string;
  assistantId?: mongoose.Types.ObjectId | string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: {
    targetEmail?: string;
    targetName?: string;
    [key: string]: any;
  };
}

/**
 * Log admin action with audit trail
 * Non-blocking - errors won't prevent the action from executing
 */
export async function logAdminAction(
  context: AdminAuditContext,
  result: {
    status: 'success' | 'error' | 'unauthorized';
    errorMessage?: string;
    duration?: number;
  }
): Promise<void> {
  try {
    await AdminActionLog.logAdminAction({
      adminUserId: context.adminUserId,
      targetUserId: context.targetUserId,
      companyId: context.companyId,
      action: context.action,
      resourceType: context.resourceType,
      method: context.method,
      resourceId: context.resourceId,
      requestParams: context.requestParams,
      responseStatus: result.status,
      errorMessage: result.errorMessage,
      sessionId: context.sessionId,
      assistantId: context.assistantId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      duration: result.duration,
      metadata: context.metadata,
    });

    if (result.status === 'success') {
      console.log(
        `[ADMIN AUDIT] Admin ${context.adminUserId} accessed ${context.targetUserId}'s ${context.resourceType} (${context.action})`
      );
    }
  } catch (error) {
    // Don't throw - we don't want logging failures to break the app
    console.error('[ADMIN AUDIT] Failed to log admin action:', error);
  }
}

/**
 * Wrapper function for Nylas actions with automatic audit logging
 *
 * Usage:
 * const result = await withAdminAudit(context, async () => {
 *   return await nylasServiceFunction();
 * });
 */
export async function withAdminAudit<T>(
  context: AdminAuditContext,
  actionFn: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();

  try {
    const result = await actionFn();
    const duration = Date.now() - startTime;

    // Log successful action
    await logAdminAction(context, {
      status: 'success',
      duration,
    });

    return result;
  } catch (error: any) {
    const duration = Date.now() - startTime;
    const isAuthError = error.message?.toLowerCase().includes('access denied') ||
                       error.message?.toLowerCase().includes('unauthorized') ||
                       error.message?.toLowerCase().includes('permission');

    // Log failed action
    await logAdminAction(context, {
      status: isAuthError ? 'unauthorized' : 'error',
      errorMessage: error.message || 'Unknown error',
      duration,
    });

    // Re-throw the original error
    throw error;
  }
}

/**
 * Determine resource type from action name
 */
export function getResourceTypeFromAction(action: string): 'email' | 'calendar' | 'contact' | 'other' {
  const lowerAction = action.toLowerCase();

  if (lowerAction.includes('email') || lowerAction.includes('message')) {
    return 'email';
  }
  if (lowerAction.includes('calendar') || lowerAction.includes('event') || lowerAction.includes('availability')) {
    return 'calendar';
  }
  if (lowerAction.includes('contact')) {
    return 'contact';
  }
  return 'other';
}

/**
 * Determine HTTP method equivalent from action name
 */
export function getMethodFromAction(action: string): 'read' | 'create' | 'update' | 'delete' {
  const lowerAction = action.toLowerCase();

  if (lowerAction.includes('get') || lowerAction.includes('list') || lowerAction.includes('search') || lowerAction.includes('find')) {
    return 'read';
  }
  if (lowerAction.includes('create') || lowerAction.includes('send') || lowerAction.includes('add')) {
    return 'create';
  }
  if (lowerAction.includes('update') || lowerAction.includes('modify') || lowerAction.includes('edit')) {
    return 'update';
  }
  if (lowerAction.includes('delete') || lowerAction.includes('remove') || lowerAction.includes('revoke')) {
    return 'delete';
  }

  // Default to read for safety
  return 'read';
}

/**
 * Check if audit logging should be skipped
 * (e.g., for same-user access, certain low-sensitivity actions)
 */
export function shouldSkipAudit(
  adminUserId: mongoose.Types.ObjectId | string,
  targetUserId: mongoose.Types.ObjectId | string
): boolean {
  // Skip audit if accessing own data (not cross-user access)
  const adminId = adminUserId.toString();
  const targetId = targetUserId.toString();

  return adminId === targetId;
}

/**
 * Build audit context from action parameters
 * Helper function to construct AdminAuditContext from action inputs
 */
export function buildAuditContext(params: {
  adminUserId: mongoose.Types.ObjectId | string;
  targetUserId: mongoose.Types.ObjectId | string;
  companyId: mongoose.Types.ObjectId | string;
  actionName: string;
  requestParams?: any;
  sessionId?: string;
  assistantId?: mongoose.Types.ObjectId | string;
  targetEmail?: string;
  targetName?: string;
  resourceId?: string;
}): AdminAuditContext {
  return {
    adminUserId: params.adminUserId,
    targetUserId: params.targetUserId,
    companyId: params.companyId,
    action: params.actionName,
    resourceType: getResourceTypeFromAction(params.actionName),
    method: getMethodFromAction(params.actionName),
    resourceId: params.resourceId,
    requestParams: params.requestParams,
    sessionId: params.sessionId,
    assistantId: params.assistantId,
    metadata: {
      targetEmail: params.targetEmail,
      targetName: params.targetName,
    },
  };
}
