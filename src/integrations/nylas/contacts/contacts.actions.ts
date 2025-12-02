/**
 * Nylas Contact Management Actions
 *
 * AI-callable actions for Google Contacts CRUD operations
 */

import {
  ActionContext,
  FunctionFactory,
  StandardActionResult,
} from '../../actions/types';
import {
  getContacts as getContactsService,
  createContact as createContactService,
  updateContact as updateContactService,
  getContactById as getContactByIdService,
  deleteContact as deleteContactService,
  searchContacts as searchContactsService,
  findDuplicates as findDuplicatesService,
  SearchCriteria,
} from './contacts.service';
import * as groupsService from './groups.service';
import { executeAction } from '../../actions/executor';
import { ActionValidationError } from '../../../utils/actionErrors';
import { ContactMetadata } from './models/ContactMetadata';
import { ContactDeletionLog } from './models/ContactDeletionLog';
import { getApiKey } from '../../../services/api.key.service';
import mongoose from 'mongoose';
import { resolveTargetUserGrant } from '../../../services/nylas-grant-resolution.service';
import {
  withAdminAudit,
  buildAuditContext,
  shouldSkipAudit,
} from '../../../middleware/admin-audit.middleware';

const SERVICE_NAME = 'nylasService';

// ==========================================
// Interfaces
// ==========================================

interface ContactData {
  id: string;
  givenName?: string;
  surname?: string;
  email?: string;
  phone?: string;
  companyName?: string;
  notes?: string;
}

interface ServiceCallLambdaResponse<T> {
  success: boolean;
  data: T;
  description?: string;
}

// ==========================================
// Contact Actions
// ==========================================

export const createContactActions = (context: ActionContext): FunctionFactory => ({
  // Get contacts
  nylasGetContacts: {
    description:
      'Retrieve contacts from a Google Contacts account. CRITICAL: Use accountOwnerEmail to access ANOTHER user\'s Google account. Use filterByEmail only to search within contacts.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of contacts to return (default: 50)',
        },
        filterByEmail: {
          type: 'string',
          description: 'OPTIONAL FILTER: Search within the contacts list for contacts that have this email. This does NOT determine whose account to access.',
        },
        accountOwnerEmail: {
          type: 'string',
          description: 'WHOSE GOOGLE ACCOUNT to access. Use this when user says "Igor\'s contacts" or "contacts for igorh@aidgenomics.com". Example: accountOwnerEmail: "igorh@aidgenomics.com" accesses Igor\'s Google Contacts. If omitted, accesses current user\'s own Google Contacts.',
        },
      },
      required: [],
      additionalProperties: false,
    },
    function: async (args: {
      limit?: number;
      filterByEmail?: string;
      accountOwnerEmail?: string;
    }): Promise<StandardActionResult<ContactData[]>> => {
      const { limit = 50, filterByEmail, accountOwnerEmail } = args;

      // Map new parameter names to backend logic
      const email = filterByEmail;
      const targetEmail = accountOwnerEmail;

      if (!context.companyId || !context.userId) {
        throw new ActionValidationError('Company ID or User ID is missing from context.');
      }

      // Resolve target user grant (handles admin cross-user access)
      const { grantId, targetUserId, isAdminAccess } = await resolveTargetUserGrant(
        targetEmail,
        context.userId,
        context.companyId
      );

      return executeAction<ContactData[], ServiceCallLambdaResponse<ContactData[]>>(
        'nylasGetContacts',
        async () => {
          // Wrap in audit logging if cross-user access
          const getContacts = async () => {
            const contacts = await getContactsService(context.companyId!, {
              limit,
              email,
              grantId,
            });
            return {
              success: true,
              data: contacts.map((c) => ({
                id: c.id,
                givenName: c.given_name,
                surname: c.surname,
                email: c.emails?.[0]?.email,
                phone: c.phone_numbers?.[0]?.number,
                companyName: c.company_name,
                notes: c.notes,
              })),
            };
          };

          // Audit logging for admin access
          if (isAdminAccess && !shouldSkipAudit(context.userId!, targetUserId)) {
            const auditContext = buildAuditContext({
              adminUserId: context.userId!,
              targetUserId,
              companyId: context.companyId!,
              actionName: 'nylasGetContacts',
              requestParams: { limit, email, targetEmail },
              sessionId: context.sessionId,
              assistantId: context.assistantId,
              targetEmail,
            });
            return await withAdminAudit(auditContext, getContacts);
          }

          return await getContacts();
        },
        { serviceName: SERVICE_NAME },
      );
    },
  },

  // Create contact
  nylasCreateContact: {
    description:
      'Create a new contact in Google Contacts with name, email, phone, company, and notes. Admins can create contacts in other users\' accounts by providing accountOwnerEmail.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        email: {
          type: 'string',
          description: 'Email address of the contact to create (required)',
        },
        givenName: {
          type: 'string',
          description: 'First name (optional)',
        },
        surname: {
          type: 'string',
          description: 'Last name (optional)',
        },
        phone: {
          type: 'string',
          description: 'Phone number (optional)',
        },
        companyName: {
          type: 'string',
          description: 'Company name (optional)',
        },
        notes: {
          type: 'string',
          description: 'Additional notes (optional)',
        },
        accountOwnerEmail: {
          type: 'string',
          description: 'WHOSE GOOGLE ACCOUNT to create the contact in. Use this when creating contacts for another user. If not provided, creates in your own account.',
        },
      },
      required: ['email'],
      additionalProperties: false,
    },
    function: async (args: {
      email: string;
      givenName?: string;
      surname?: string;
      phone?: string;
      companyName?: string;
      notes?: string;
      accountOwnerEmail?: string;
    }): Promise<StandardActionResult<ContactData>> => {
      const { email, givenName, surname, phone, companyName, notes, accountOwnerEmail } = args;

      // Map new parameter name to backend logic
      const targetEmail = accountOwnerEmail;

      if (!context.companyId || !context.userId) {
        throw new ActionValidationError('Company ID or User ID is missing from context.');
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new ActionValidationError(`Invalid email address: ${email}`);
      }

      // Resolve target user grant (handles admin cross-user access)
      const { grantId, targetUserId, isAdminAccess } = await resolveTargetUserGrant(
        targetEmail,
        context.userId,
        context.companyId
      );

      return executeAction<ContactData, ServiceCallLambdaResponse<ContactData>>(
        'nylasCreateContact',
        async () => {
          // Wrap in audit logging if cross-user access
          const createContact = async () => {
            const contact = await createContactService(context.companyId!, {
              email,
              givenName,
              surname,
              phone,
              companyName,
              notes,
              grantId,
            });
            return {
              success: true,
              data: {
                id: contact.id,
                givenName: contact.given_name,
                surname: contact.surname,
                email: contact.emails?.[0]?.email,
                phone: contact.phone_numbers?.[0]?.number,
                companyName: contact.company_name,
                notes: contact.notes,
              },
            };
          };

          // Audit logging for admin access
          if (isAdminAccess && !shouldSkipAudit(context.userId!, targetUserId)) {
            const auditContext = buildAuditContext({
              adminUserId: context.userId!,
              targetUserId,
              companyId: context.companyId!,
              actionName: 'nylasCreateContact',
              requestParams: { email, givenName, surname, phone, companyName, notes, targetEmail },
              sessionId: context.sessionId,
              assistantId: context.assistantId,
              targetEmail,
            });
            return await withAdminAudit(auditContext, createContact);
          }

          return await createContact();
        },
        { serviceName: SERVICE_NAME },
      );
    },
  },

  // Update contact
  nylasUpdateContact: {
    description:
      'Update an existing contact in Google Contacts. All fields except contactId are optional. Admins can update contacts in other users\' accounts by providing targetEmail.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        contactId: {
          type: 'string',
          description: 'The ID of the contact to update (required)',
        },
        email: {
          type: 'string',
          description: 'New email address (optional)',
        },
        givenName: {
          type: 'string',
          description: 'New first name (optional)',
        },
        surname: {
          type: 'string',
          description: 'New last name (optional)',
        },
        phone: {
          type: 'string',
          description: 'New phone number (optional)',
        },
        companyName: {
          type: 'string',
          description: 'New company name (optional)',
        },
        notes: {
          type: 'string',
          description: 'New notes (optional)',
        },
        targetEmail: {
          type: 'string',
          description: 'Email address of the user whose contact to update (admin only). If not provided, updates your own contact.',
        },
      },
      required: ['contactId'],
      additionalProperties: false,
    },
    function: async (args: {
      contactId: string;
      email?: string;
      givenName?: string;
      surname?: string;
      phone?: string;
      companyName?: string;
      notes?: string;
      targetEmail?: string;
    }): Promise<StandardActionResult<ContactData>> => {
      const { contactId, email, givenName, surname, phone, companyName, notes, targetEmail } = args;

      if (!context.companyId || !context.userId) {
        throw new ActionValidationError('Company ID or User ID is missing from context.');
      }

      if (!contactId || typeof contactId !== 'string') {
        throw new ActionValidationError('contactId is required');
      }

      if (email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          throw new ActionValidationError(`Invalid email address: ${email}`);
        }
      }

      // Resolve target user grant (handles admin cross-user access)
      const { grantId, targetUserId, isAdminAccess } = await resolveTargetUserGrant(
        targetEmail,
        context.userId,
        context.companyId
      );

      return executeAction<ContactData, ServiceCallLambdaResponse<ContactData>>(
        'nylasUpdateContact',
        async () => {
          // Wrap in audit logging if cross-user access
          const updateContact = async () => {
            const contact = await updateContactService(context.companyId!, contactId, {
              email,
              givenName,
              surname,
              phone,
              companyName,
              notes,
              grantId,
            });
            return {
              success: true,
              data: {
                id: contact.id,
                givenName: contact.given_name,
                surname: contact.surname,
                email: contact.emails?.[0]?.email,
                phone: contact.phone_numbers?.[0]?.number,
                companyName: contact.company_name,
                notes: contact.notes,
              },
            };
          };

          // Audit logging for admin access
          if (isAdminAccess && !shouldSkipAudit(context.userId!, targetUserId)) {
            const auditContext = buildAuditContext({
              adminUserId: context.userId!,
              targetUserId,
              companyId: context.companyId!,
              actionName: 'nylasUpdateContact',
              requestParams: { contactId, email, givenName, surname, phone, companyName, notes, targetEmail },
              sessionId: context.sessionId,
              assistantId: context.assistantId,
              targetEmail,
              resourceId: contactId,
            });
            return await withAdminAudit(auditContext, updateContact);
          }

          return await updateContact();
        },
        { serviceName: SERVICE_NAME },
      );
    },
  },

  // Get contact by ID
  nylasGetContactById: {
    description:
      'Get a single contact from Google Contacts by its ID. Admins can retrieve contacts from other users\' accounts by providing targetEmail.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        contactId: {
          type: 'string',
          description: 'The ID of the contact to retrieve (required)',
        },
        targetEmail: {
          type: 'string',
          description: 'Email address of the user whose contact to retrieve (admin only). If not provided, retrieves from your own account.',
        },
      },
      required: ['contactId'],
      additionalProperties: false,
    },
    function: async (args: {
      contactId: string;
      targetEmail?: string;
    }): Promise<StandardActionResult<ContactData>> => {
      const { contactId, targetEmail } = args;

      if (!context.companyId || !context.userId) {
        throw new ActionValidationError('Company ID or User ID is missing from context.');
      }

      if (!contactId || typeof contactId !== 'string') {
        throw new ActionValidationError('contactId is required');
      }

      // Resolve target user grant (handles admin cross-user access)
      const { grantId, targetUserId, isAdminAccess } = await resolveTargetUserGrant(
        targetEmail,
        context.userId,
        context.companyId
      );

      return executeAction<ContactData, ServiceCallLambdaResponse<ContactData>>(
        'nylasGetContactById',
        async () => {
          // Wrap in audit logging if cross-user access
          const getContact = async () => {
            const contact = await getContactByIdService(context.companyId!, contactId, grantId);
            return {
              success: true,
              data: {
                id: contact.id,
                givenName: contact.given_name,
                surname: contact.surname,
                email: contact.emails?.[0]?.email,
                phone: contact.phone_numbers?.[0]?.number,
                companyName: contact.company_name,
                notes: contact.notes,
              },
            };
          };

          // Audit logging for admin access
          if (isAdminAccess && !shouldSkipAudit(context.userId!, targetUserId)) {
            const auditContext = buildAuditContext({
              adminUserId: context.userId!,
              targetUserId,
              companyId: context.companyId!,
              actionName: 'nylasGetContactById',
              requestParams: { contactId, targetEmail },
              sessionId: context.sessionId,
              assistantId: context.assistantId,
              targetEmail,
              resourceId: contactId,
            });
            return await withAdminAudit(auditContext, getContact);
          }

          return await getContact();
        },
        { serviceName: SERVICE_NAME },
      );
    },
  },

  // Delete contact
  nylasDeleteContact: {
    description:
      'Delete a contact from Google Contacts. This action includes safety checks and logging. ' +
      'By default performs a soft delete (keeps metadata). Use confirmHardDelete=true for permanent deletion. ' +
      'Admins can delete contacts from other users\' accounts by providing targetEmail.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        contactId: {
          type: 'string',
          description: 'The ID of the contact to delete (required)',
        },
        deletionReason: {
          type: 'string',
          description: 'Optional reason for deletion (for audit trail)',
        },
        confirmHardDelete: {
          type: 'boolean',
          description: 'Set to true to permanently delete from Nylas (default: false = soft delete only)',
        },
        targetEmail: {
          type: 'string',
          description: 'Email address of the user whose contact to delete (admin only). If not provided, deletes from your own account.',
        },
      },
      required: ['contactId'],
      additionalProperties: false,
    },
    function: async (args: {
      contactId: string;
      deletionReason?: string;
      confirmHardDelete?: boolean;
      targetEmail?: string;
    }): Promise<StandardActionResult<{ deleted: boolean; type: 'soft' | 'hard' }>> => {
      const { contactId, deletionReason, confirmHardDelete = false, targetEmail } = args;

      if (!context.companyId || !context.userId) {
        throw new ActionValidationError('Company ID or User ID is missing from context.');
      }

      if (!contactId || typeof contactId !== 'string') {
        throw new ActionValidationError('contactId is required');
      }

      // Resolve target user grant (handles admin cross-user access)
      const { grantId, targetUserId, isAdminAccess } = await resolveTargetUserGrant(
        targetEmail,
        context.userId,
        context.companyId
      );

      return executeAction<
        { deleted: boolean; type: 'soft' | 'hard' },
        ServiceCallLambdaResponse<{ deleted: boolean; type: 'soft' | 'hard' }>
      >(
        'nylasDeleteContact',
        async () => {
          // Wrap in audit logging if cross-user access
          const deleteContact = async () => {
            const companyId = context.companyId!;
            const userId = new mongoose.Types.ObjectId(context.userId!);

            // Get contact details before deletion (for snapshot)
            let contactSnapshot: any = {};
            try {
              const contact = await getContactByIdService(companyId, contactId, grantId);

              // DEBUG: Log contact emails type and value
              console.log('[DEBUG] contact.emails type:', typeof contact.emails);
              console.log('[DEBUG] contact.emails value:', contact.emails);
              console.log('[DEBUG] contact.emails JSON:', JSON.stringify(contact.emails));
              console.log('[DEBUG] Is Array:', Array.isArray(contact.emails));

              contactSnapshot = {
                givenName: contact.given_name,
                surname: contact.surname,
                emails: contact.emails,
                phoneNumbers: contact.phone_numbers,
                companyName: contact.company_name,
                notes: contact.notes,
              };

              // DEBUG: Log contactSnapshot.emails after assignment
              console.log('[DEBUG] contactSnapshot.emails type:', typeof contactSnapshot.emails);
              console.log('[DEBUG] contactSnapshot.emails value:', contactSnapshot.emails);
              console.log('[DEBUG] contactSnapshot.emails JSON:', JSON.stringify(contactSnapshot.emails));
            } catch (error) {
              console.warn('[Contact Delete] Could not retrieve contact for snapshot:', error);
            }

            // Find or create contact metadata
            let metadata = await ContactMetadata.findByContactId(contactId, grantId);

            if (!metadata) {
              // Create metadata if doesn't exist (for legacy contacts)
              metadata = new ContactMetadata({
                contactId,
                grantId,
                companyId: new mongoose.Types.ObjectId(companyId),
                ownerId: userId,
                createdBy: userId,
                lifecycle: 'inactive',
                source: 'manual',
                isShared: false,
              });
            }

            // Check for active interactions (safety check)
            const hasActiveEmails = metadata.emailCount > 0;
            const hasActiveMeetings = metadata.meetingCount > 0;

            const deletionType = confirmHardDelete ? 'hard' : 'soft';

            // DEBUG: Log what we're about to pass to ContactDeletionLog
            console.log('[DEBUG] Before logDeletion - contactSnapshot:', JSON.stringify(contactSnapshot, null, 2));
            console.log('[DEBUG] Before logDeletion - contactSnapshot.emails type:', typeof contactSnapshot.emails);
            console.log('[DEBUG] Before logDeletion - contactSnapshot.emails value:', contactSnapshot.emails);

            // Log the deletion
            await ContactDeletionLog.logDeletion({
              contactId,
              grantId,
              companyId: new mongoose.Types.ObjectId(companyId),
              ownerId: metadata.ownerId,
              deletedBy: userId,
              deletionType,
              contactSnapshot,
              deletionReason,
              metadata: {
                hasActiveEmails,
                hasActiveMeetings,
                interactionCount: metadata.interactionCount,
                lastInteractionAt: metadata.lastInteractionAt,
              },
            });

            // Perform deletion
            if (confirmHardDelete) {
              // Hard delete: Remove from Nylas AND soft-delete metadata
              await deleteContactService(companyId, contactId, grantId);
              metadata.softDelete(userId, deletionReason);
              await metadata.save();

              console.log(`[Contact Delete] Hard deleted contact ${contactId}`);

              return {
                success: true,
                data: { deleted: true, type: 'hard' as const },
                description: `Contact permanently deleted from Google Contacts. ` +
                  `Audit trail preserved. ${hasActiveEmails || hasActiveMeetings ? '⚠️ Contact had active interactions.' : ''}`,
              };
            } else {
              // Soft delete: Only mark metadata as deleted (keep in Nylas)
              metadata.softDelete(userId, deletionReason);
              await metadata.save();

              console.log(`[Contact Delete] Soft deleted contact ${contactId}`);

              return {
                success: true,
                data: { deleted: true, type: 'soft' as const },
                description: `Contact marked as deleted (soft delete). Contact still exists in Google Contacts. ` +
                  `Use confirmHardDelete=true to permanently delete. Can be restored.`,
              };
            }
          };

          // Audit logging for admin access
          if (isAdminAccess && !shouldSkipAudit(context.userId!, targetUserId)) {
            const auditContext = buildAuditContext({
              adminUserId: context.userId!,
              targetUserId,
              companyId: context.companyId!,
              actionName: 'nylasDeleteContact',
              requestParams: { contactId, deletionReason, confirmHardDelete, targetEmail },
              sessionId: context.sessionId,
              assistantId: context.assistantId,
              targetEmail,
              resourceId: contactId,
            });
            return await withAdminAudit(auditContext, deleteContact);
          }

          return await deleteContact();
        },
        { serviceName: SERVICE_NAME },
      );
    },
  },

  // Search contacts
  nylasSearchContacts: {
    description:
      'Search contacts across multiple criteria: name, email, phone, company. ' +
      'Returns matching contacts from Google Contacts. Admins can search contacts in other users\' accounts by providing targetEmail.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Search by first name or last name (partial match supported)',
        },
        email: {
          type: 'string',
          description: 'Search by email address (partial match supported)',
        },
        phone: {
          type: 'string',
          description: 'Search by phone number (digits only, partial match)',
        },
        companyName: {
          type: 'string',
          description: 'Search by company name (partial match supported)',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default: 50)',
        },
        targetEmail: {
          type: 'string',
          description: 'Email address of the user whose contacts to search (admin only). If not provided, searches your own contacts.',
        },
      },
      required: [],
      additionalProperties: false,
    },
    function: async (args: SearchCriteria & { targetEmail?: string }): Promise<StandardActionResult<ContactData[]>> => {
      const { targetEmail, ...searchCriteria } = args;

      if (!context.companyId || !context.userId) {
        throw new ActionValidationError('Company ID or User ID is missing from context.');
      }

      // At least one search criterion required
      if (!args.name && !args.email && !args.phone && !args.companyName) {
        throw new ActionValidationError(
          'At least one search criterion required: name, email, phone, or companyName'
        );
      }

      // Resolve target user grant (handles admin cross-user access)
      const { grantId, targetUserId, isAdminAccess } = await resolveTargetUserGrant(
        targetEmail,
        context.userId,
        context.companyId
      );

      return executeAction<ContactData[], ServiceCallLambdaResponse<ContactData[]>>(
        'nylasSearchContacts',
        async () => {
          // Wrap in audit logging if cross-user access
          const searchContacts = async () => {
            const contacts = await searchContactsService(context.companyId!, searchCriteria, grantId);
            return {
              success: true,
              data: contacts.map((c) => ({
                id: c.id,
                givenName: c.given_name,
                surname: c.surname,
                email: c.emails?.[0]?.email,
                phone: c.phone_numbers?.[0]?.number,
                companyName: c.company_name,
                notes: c.notes,
              })),
              description: `Found ${contacts.length} matching contact(s)`,
            };
          };

          // Audit logging for admin access
          if (isAdminAccess && !shouldSkipAudit(context.userId!, targetUserId)) {
            const auditContext = buildAuditContext({
              adminUserId: context.userId!,
              targetUserId,
              companyId: context.companyId!,
              actionName: 'nylasSearchContacts',
              requestParams: { ...searchCriteria, targetEmail },
              sessionId: context.sessionId,
              assistantId: context.assistantId,
              targetEmail,
            });
            return await withAdminAudit(auditContext, searchContacts);
          }

          return await searchContacts();
        },
        { serviceName: SERVICE_NAME },
      );
    },
  },

  // Find duplicates
  nylasFindDuplicates: {
    description:
      'Find duplicate contacts based on email or name matching. ' +
      'Returns groups of contacts that appear to be duplicates. Admins can find duplicates in other users\' accounts by providing targetEmail.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of contacts to scan (default: 100)',
        },
        targetEmail: {
          type: 'string',
          description: 'Email address of the user whose contacts to scan for duplicates (admin only). If not provided, scans your own contacts.',
        },
      },
      required: [],
      additionalProperties: false,
    },
    function: async (args: {
      limit?: number;
      targetEmail?: string;
    }): Promise<StandardActionResult<Array<{
      contacts: ContactData[];
      reason: string;
    }>>> => {
      const { targetEmail, limit } = args;

      if (!context.companyId || !context.userId) {
        throw new ActionValidationError('Company ID or User ID is missing from context.');
      }

      // Resolve target user grant (handles admin cross-user access)
      const { grantId, targetUserId, isAdminAccess } = await resolveTargetUserGrant(
        targetEmail,
        context.userId,
        context.companyId
      );

      return executeAction<
        Array<{ contacts: ContactData[]; reason: string }>,
        ServiceCallLambdaResponse<Array<{ contacts: ContactData[]; reason: string }>>
      >(
        'nylasFindDuplicates',
        async () => {
          // Wrap in audit logging if cross-user access
          const findDuplicates = async () => {
            const duplicates = await findDuplicatesService(context.companyId!, { limit, grantId });

            const result = duplicates.map((dup) => ({
              contacts: dup.contacts.map((c) => ({
                id: c.id,
                givenName: c.given_name,
                surname: c.surname,
                email: c.emails?.[0]?.email,
                phone: c.phone_numbers?.[0]?.number,
                companyName: c.company_name,
                notes: c.notes,
              })),
              reason: dup.reason,
            }));

            return {
              success: true,
              data: result,
              description: `Found ${duplicates.length} duplicate group(s)`,
            };
          };

          // Audit logging for admin access
          if (isAdminAccess && !shouldSkipAudit(context.userId!, targetUserId)) {
            const auditContext = buildAuditContext({
              adminUserId: context.userId!,
              targetUserId,
              companyId: context.companyId!,
              actionName: 'nylasFindDuplicates',
              requestParams: { limit, targetEmail },
              sessionId: context.sessionId,
              assistantId: context.assistantId,
              targetEmail,
            });
            return await withAdminAudit(auditContext, findDuplicates);
          }

          return await findDuplicates();
        },
        { serviceName: SERVICE_NAME },
      );
    },
  },

  // Search by metadata tags
  nylasSearchContactsByTags: {
    description:
      'Search contacts by tags in ContactMetadata. Returns contacts that have ALL specified tags. ' +
      'Admins can search contacts in other users\' accounts by providing targetEmail.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of tags to search for (AND logic)',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results (default: 50)',
        },
        targetEmail: {
          type: 'string',
          description: 'Email address of the user whose contacts to search (admin only). If not provided, searches your own contacts.',
        },
      },
      required: ['tags'],
      additionalProperties: false,
    },
    function: async (args: {
      tags: string[];
      limit?: number;
      targetEmail?: string;
    }): Promise<StandardActionResult<Array<ContactData & { tags: string[] }>>> => {
      const { tags, limit, targetEmail } = args;

      if (!context.companyId || !context.userId) {
        throw new ActionValidationError('Company ID or User ID is missing from context.');
      }

      if (!tags || tags.length === 0) {
        throw new ActionValidationError('At least one tag is required');
      }

      // Resolve target user grant (handles admin cross-user access)
      const { grantId, targetUserId, isAdminAccess } = await resolveTargetUserGrant(
        targetEmail,
        context.userId,
        context.companyId
      );

      return executeAction<
        Array<ContactData & { tags: string[] }>,
        ServiceCallLambdaResponse<Array<ContactData & { tags: string[] }>>
      >(
        'nylasSearchContactsByTags',
        async () => {
          // Wrap in audit logging if cross-user access
          const searchByTags = async () => {
            const companyId = new mongoose.Types.ObjectId(context.companyId!);
            const limitValue = limit || 50;

            // Find metadata with ALL specified tags for the specific grant
            const metadataList = await ContactMetadata.find({
              companyId,
              grantId,
              tags: { $all: tags },
              isDeleted: false,
            })
              .limit(limitValue)
              .sort({ updatedAt: -1 });

            if (metadataList.length === 0) {
              return {
                success: true,
                data: [],
                description: 'No contacts found with specified tags',
              };
            }

            // Fetch actual contact data from Nylas for each
            const contactData: Array<ContactData & { tags: string[] }> = [];

            for (const metadata of metadataList) {
              try {
                const contact = await getContactByIdService(
                  context.companyId!,
                  metadata.contactId,
                  grantId
                );

                contactData.push({
                  id: contact.id,
                  givenName: contact.given_name,
                  surname: contact.surname,
                  email: contact.emails?.[0]?.email,
                  phone: contact.phone_numbers?.[0]?.number,
                  companyName: contact.company_name,
                  notes: contact.notes,
                  tags: metadata.tags,
                });
              } catch (error) {
                console.warn(
                  `[Search by Tags] Could not fetch contact ${metadata.contactId}:`,
                  error
                );
              }
            }

            return {
              success: true,
              data: contactData,
              description: `Found ${contactData.length} contact(s) with tags: ${tags.join(', ')}`,
            };
          };

          // Audit logging for admin access
          if (isAdminAccess && !shouldSkipAudit(context.userId!, targetUserId)) {
            const auditContext = buildAuditContext({
              adminUserId: context.userId!,
              targetUserId,
              companyId: context.companyId!,
              actionName: 'nylasSearchContactsByTags',
              requestParams: { tags, limit, targetEmail },
              sessionId: context.sessionId,
              assistantId: context.assistantId,
              targetEmail,
            });
            return await withAdminAudit(auditContext, searchByTags);
          }

          return await searchByTags();
        },
        { serviceName: SERVICE_NAME },
      );
    },
  },

  // Search by lifecycle stage
  nylasSearchContactsByLifecycle: {
    description:
      'Search contacts by lifecycle stage (lead, prospect, customer, partner, inactive). ' +
      'Admins can search contacts in other users\' accounts by providing targetEmail.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        lifecycle: {
          type: 'string',
          enum: ['lead', 'prospect', 'customer', 'partner', 'inactive'],
          description: 'Lifecycle stage to filter by',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results (default: 50)',
        },
        targetEmail: {
          type: 'string',
          description: 'Email address of the user whose contacts to search (admin only). If not provided, searches your own contacts.',
        },
      },
      required: ['lifecycle'],
      additionalProperties: false,
    },
    function: async (args: {
      lifecycle: 'lead' | 'prospect' | 'customer' | 'partner' | 'inactive';
      limit?: number;
      targetEmail?: string;
    }): Promise<StandardActionResult<Array<ContactData & { lifecycle: string }>>> => {
      const { lifecycle, limit, targetEmail } = args;

      if (!context.companyId || !context.userId) {
        throw new ActionValidationError('Company ID or User ID is missing from context.');
      }

      // Resolve target user grant (handles admin cross-user access)
      const { grantId, targetUserId, isAdminAccess } = await resolveTargetUserGrant(
        targetEmail,
        context.userId,
        context.companyId
      );

      return executeAction<
        Array<ContactData & { lifecycle: string }>,
        ServiceCallLambdaResponse<Array<ContactData & { lifecycle: string }>>
      >(
        'nylasSearchContactsByLifecycle',
        async () => {
          // Wrap in audit logging if cross-user access
          const searchByLifecycle = async () => {
            const companyId = new mongoose.Types.ObjectId(context.companyId!);
            const limitValue = limit || 50;

            // Find metadata with specified lifecycle for the specific grant
            const metadataList = await ContactMetadata.find({
              companyId,
              grantId,
              lifecycle,
              isDeleted: false,
            })
              .limit(limitValue)
              .sort({ updatedAt: -1 });

            if (metadataList.length === 0) {
              return {
                success: true,
                data: [],
                description: `No contacts found with lifecycle: ${lifecycle}`,
              };
            }

            // Fetch actual contact data from Nylas
            const contactData: Array<ContactData & { lifecycle: string }> = [];

            for (const metadata of metadataList) {
              try {
                const contact = await getContactByIdService(
                  context.companyId!,
                  metadata.contactId,
                  grantId
                );

                contactData.push({
                  id: contact.id,
                  givenName: contact.given_name,
                  surname: contact.surname,
                  email: contact.emails?.[0]?.email,
                  phone: contact.phone_numbers?.[0]?.number,
                  companyName: contact.company_name,
                  notes: contact.notes,
                  lifecycle: metadata.lifecycle,
                });
              } catch (error) {
                console.warn(
                  `[Search by Lifecycle] Could not fetch contact ${metadata.contactId}:`,
                  error
                );
              }
            }

            return {
              success: true,
              data: contactData,
              description: `Found ${contactData.length} ${lifecycle} contact(s)`,
            };
          };

          // Audit logging for admin access
          if (isAdminAccess && !shouldSkipAudit(context.userId!, targetUserId)) {
            const auditContext = buildAuditContext({
              adminUserId: context.userId!,
              targetUserId,
              companyId: context.companyId!,
              actionName: 'nylasSearchContactsByLifecycle',
              requestParams: { lifecycle, limit, targetEmail },
              sessionId: context.sessionId,
              assistantId: context.assistantId,
              targetEmail,
            });
            return await withAdminAudit(auditContext, searchByLifecycle);
          }

          return await searchByLifecycle();
        },
        { serviceName: SERVICE_NAME },
      );
    },
  },

  // ==========================================
  // CONTACT GROUP MANAGEMENT ACTIONS
  // ==========================================

  nylasCreateContactGroup: {
    description: 'Create a new contact group for organizing contacts. Admins can create groups for other users by providing targetEmail.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Group name (required)',
        },
        description: {
          type: 'string',
          description: 'Optional group description',
        },
        targetEmail: {
          type: 'string',
          description: 'Email address of the user for whom to create the group (admin only). If not provided, creates for yourself.',
        },
      },
      required: ['name'],
      additionalProperties: false,
    },
    function: async (args: {
      name: string;
      description?: string;
      targetEmail?: string;
    }): Promise<StandardActionResult> => {
      const { name, description, targetEmail } = args;

      if (!context.companyId || !context.userId) {
        throw new ActionValidationError('Company ID and User ID are required.');
      }

      // Resolve target user (determines owner of the group)
      const { targetUserId, isAdminAccess } = await resolveTargetUserGrant(
        targetEmail,
        context.userId,
        context.companyId
      );

      return executeAction(
        'nylasCreateContactGroup',
        async () => {
          // Wrap in audit logging if cross-user access
          const createGroup = async () => {
            const group = await groupsService.createGroup(
              context.companyId!,
              targetUserId.toString(), // Use target user as owner
              name,
              description
            );

            return {
              success: true,
              data: {
                groupId: group._id.toString(),
                name: group.name,
                memberCount: group.memberCount,
              },
              description: `Created group: ${group.name}`,
            };
          };

          // Audit logging for admin access
          if (isAdminAccess && !shouldSkipAudit(context.userId!, targetUserId)) {
            const auditContext = buildAuditContext({
              adminUserId: context.userId!,
              targetUserId,
              companyId: context.companyId!,
              actionName: 'nylasCreateContactGroup',
              requestParams: { name, description, targetEmail },
              sessionId: context.sessionId,
              assistantId: context.assistantId,
              targetEmail,
            });
            return await withAdminAudit(auditContext, createGroup);
          }

          return await createGroup();
        },
        { serviceName: SERVICE_NAME },
      );
    },
  },

  nylasGetContactGroup: {
    description: 'Get details of a specific contact group.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        groupId: {
          type: 'string',
          description: 'Group ID (required)',
        },
      },
      required: ['groupId'],
      additionalProperties: false,
    },
    function: async (args: {
      groupId: string;
    }): Promise<StandardActionResult> => {
      if (!context.companyId) {
        throw new ActionValidationError('Company ID is required.');
      }

      return executeAction(
        'nylasGetContactGroup',
        async () => {
          const group = await groupsService.getGroup(
            args.groupId,
            context.companyId!
          );

          if (!group) {
            return {
              success: false,
              data: null,
              description: 'Group not found',
            };
          }

          return {
            success: true,
            data: {
              id: group._id.toString(),
              name: group.name,
              description: group.description,
              memberCount: group.memberCount,
              ownerId: group.ownerId.toString(),
            },
            description: `Retrieved group: ${group.name}`,
          };
        },
        { serviceName: SERVICE_NAME },
      );
    },
  },

  nylasUpdateContactGroup: {
    description: 'Update an existing contact group.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        groupId: {
          type: 'string',
          description: 'Group ID (required)',
        },
        name: {
          type: 'string',
          description: 'New group name',
        },
        description: {
          type: 'string',
          description: 'New group description',
        },
      },
      required: ['groupId'],
      additionalProperties: false,
    },
    function: async (args: {
      groupId: string;
      name?: string;
      description?: string;
    }): Promise<StandardActionResult> => {
      if (!context.companyId) {
        throw new ActionValidationError('Company ID is required.');
      }

      return executeAction(
        'nylasUpdateContactGroup',
        async () => {
          const group = await groupsService.updateGroup(
            args.groupId,
            context.companyId!,
            {
              name: args.name,
              description: args.description,
            }
          );

          return {
            success: true,
            data: {
              id: group._id.toString(),
              name: group.name,
              description: group.description,
              memberCount: group.memberCount,
            },
            description: `Updated group: ${group.name}`,
          };
        },
        { serviceName: SERVICE_NAME },
      );
    },
  },

  nylasDeleteContactGroup: {
    description:
      'Delete a contact group. Removes the group from all contacts.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        groupId: {
          type: 'string',
          description: 'Group ID (required)',
        },
      },
      required: ['groupId'],
      additionalProperties: false,
    },
    function: async (args: { groupId: string }): Promise<StandardActionResult> => {
      if (!context.companyId) {
        throw new ActionValidationError('Company ID is required.');
      }

      return executeAction(
        'nylasDeleteContactGroup',
        async () => {
          await groupsService.deleteGroup(args.groupId, context.companyId!);

          return {
            success: true,
            data: null,
            description: 'Group deleted successfully',
          };
        },
        { serviceName: SERVICE_NAME },
      );
    },
  },

  nylasAddContactToGroup: {
    description: 'Add a contact to a group. Admins can add contacts to groups for other users by providing targetEmail.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        groupId: {
          type: 'string',
          description: 'Group ID (required)',
        },
        contactId: {
          type: 'string',
          description: 'Nylas contact ID (required)',
        },
        targetEmail: {
          type: 'string',
          description: 'Email address of the user whose contact/group to modify (admin only). If not provided, uses your own account.',
        },
      },
      required: ['groupId', 'contactId'],
      additionalProperties: false,
    },
    function: async (args: {
      groupId: string;
      contactId: string;
      targetEmail?: string;
    }): Promise<StandardActionResult> => {
      const { groupId, contactId, targetEmail } = args;

      if (!context.companyId || !context.userId) {
        throw new ActionValidationError('Company ID and User ID are required.');
      }

      // Resolve target user grant (determines which user's contacts/groups)
      const { grantId, targetUserId, isAdminAccess } = await resolveTargetUserGrant(
        targetEmail,
        context.userId,
        context.companyId
      );

      return executeAction(
        'nylasAddContactToGroup',
        async () => {
          // Wrap in audit logging if cross-user access
          const addToGroup = async () => {
            await groupsService.addContactToGroup(
              groupId,
              contactId,
              grantId,
              context.companyId!
            );

            return {
              success: true,
              data: null,
              description: 'Contact added to group',
            };
          };

          // Audit logging for admin access
          if (isAdminAccess && !shouldSkipAudit(context.userId!, targetUserId)) {
            const auditContext = buildAuditContext({
              adminUserId: context.userId!,
              targetUserId,
              companyId: context.companyId!,
              actionName: 'nylasAddContactToGroup',
              requestParams: { groupId, contactId, targetEmail },
              sessionId: context.sessionId,
              assistantId: context.assistantId,
              targetEmail,
              resourceId: groupId,
            });
            return await withAdminAudit(auditContext, addToGroup);
          }

          return await addToGroup();
        },
        { serviceName: SERVICE_NAME },
      );
    },
  },

  nylasRemoveContactFromGroup: {
    description: 'Remove a contact from a group. Admins can remove contacts from groups for other users by providing targetEmail.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        groupId: {
          type: 'string',
          description: 'Group ID (required)',
        },
        contactId: {
          type: 'string',
          description: 'Nylas contact ID (required)',
        },
        targetEmail: {
          type: 'string',
          description: 'Email address of the user whose contact/group to modify (admin only). If not provided, uses your own account.',
        },
      },
      required: ['groupId', 'contactId'],
      additionalProperties: false,
    },
    function: async (args: {
      groupId: string;
      contactId: string;
      targetEmail?: string;
    }): Promise<StandardActionResult> => {
      const { groupId, contactId, targetEmail } = args;

      if (!context.companyId || !context.userId) {
        throw new ActionValidationError('Company ID and User ID are required.');
      }

      // Resolve target user grant (determines which user's contacts/groups)
      const { grantId, targetUserId, isAdminAccess } = await resolveTargetUserGrant(
        targetEmail,
        context.userId,
        context.companyId
      );

      return executeAction(
        'nylasRemoveContactFromGroup',
        async () => {
          // Wrap in audit logging if cross-user access
          const removeFromGroup = async () => {
            await groupsService.removeContactFromGroup(
              groupId,
              contactId,
              grantId,
              context.companyId!
            );

            return {
              success: true,
              data: null,
              description: 'Contact removed from group',
            };
          };

          // Audit logging for admin access
          if (isAdminAccess && !shouldSkipAudit(context.userId!, targetUserId)) {
            const auditContext = buildAuditContext({
              adminUserId: context.userId!,
              targetUserId,
              companyId: context.companyId!,
              actionName: 'nylasRemoveContactFromGroup',
              requestParams: { groupId, contactId, targetEmail },
              sessionId: context.sessionId,
              assistantId: context.assistantId,
              targetEmail,
              resourceId: groupId,
            });
            return await withAdminAudit(auditContext, removeFromGroup);
          }

          return await removeFromGroup();
        },
        { serviceName: SERVICE_NAME },
      );
    },
  },
});
