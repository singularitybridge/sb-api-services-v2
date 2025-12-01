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
      'Retrieve contacts from Google Contacts. Optionally filter by email address.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of contacts to return (default: 50)',
        },
        email: {
          type: 'string',
          description: 'Filter contacts by email address (optional)',
        },
      },
      required: [],
      additionalProperties: false,
    },
    function: async (args: {
      limit?: number;
      email?: string;
    }): Promise<StandardActionResult<ContactData[]>> => {
      const { limit = 50, email } = args;

      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }

      return executeAction<ContactData[], ServiceCallLambdaResponse<ContactData[]>>(
        'nylasGetContacts',
        async () => {
          const contacts = await getContactsService(context.companyId!, {
            limit,
            email,
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
        },
        { serviceName: SERVICE_NAME },
      );
    },
  },

  // Create contact
  nylasCreateContact: {
    description:
      'Create a new contact in Google Contacts with name, email, phone, company, and notes.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        email: {
          type: 'string',
          description: 'Email address (required)',
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
    }): Promise<StandardActionResult<ContactData>> => {
      const { email, givenName, surname, phone, companyName, notes } = args;

      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new ActionValidationError(`Invalid email address: ${email}`);
      }

      return executeAction<ContactData, ServiceCallLambdaResponse<ContactData>>(
        'nylasCreateContact',
        async () => {
          const contact = await createContactService(context.companyId!, {
            email,
            givenName,
            surname,
            phone,
            companyName,
            notes,
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
        },
        { serviceName: SERVICE_NAME },
      );
    },
  },

  // Update contact
  nylasUpdateContact: {
    description:
      'Update an existing contact in Google Contacts. All fields except contactId are optional.',
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
    }): Promise<StandardActionResult<ContactData>> => {
      const { contactId, email, givenName, surname, phone, companyName, notes } = args;

      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
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

      return executeAction<ContactData, ServiceCallLambdaResponse<ContactData>>(
        'nylasUpdateContact',
        async () => {
          const contact = await updateContactService(context.companyId!, contactId, {
            email,
            givenName,
            surname,
            phone,
            companyName,
            notes,
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
        },
        { serviceName: SERVICE_NAME },
      );
    },
  },

  // Get contact by ID
  nylasGetContactById: {
    description:
      'Get a single contact from Google Contacts by its ID.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        contactId: {
          type: 'string',
          description: 'The ID of the contact to retrieve (required)',
        },
      },
      required: ['contactId'],
      additionalProperties: false,
    },
    function: async (args: {
      contactId: string;
    }): Promise<StandardActionResult<ContactData>> => {
      const { contactId } = args;

      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }

      if (!contactId || typeof contactId !== 'string') {
        throw new ActionValidationError('contactId is required');
      }

      return executeAction<ContactData, ServiceCallLambdaResponse<ContactData>>(
        'nylasGetContactById',
        async () => {
          const contact = await getContactByIdService(context.companyId!, contactId);
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
        },
        { serviceName: SERVICE_NAME },
      );
    },
  },

  // Delete contact
  nylasDeleteContact: {
    description:
      'Delete a contact from Google Contacts. This action includes safety checks and logging. ' +
      'By default performs a soft delete (keeps metadata). Use confirmHardDelete=true for permanent deletion.',
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
      },
      required: ['contactId'],
      additionalProperties: false,
    },
    function: async (args: {
      contactId: string;
      deletionReason?: string;
      confirmHardDelete?: boolean;
    }): Promise<StandardActionResult<{ deleted: boolean; type: 'soft' | 'hard' }>> => {
      const { contactId, deletionReason, confirmHardDelete = false } = args;

      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }

      if (!context.userId) {
        throw new ActionValidationError('User ID is missing from context.');
      }

      if (!contactId || typeof contactId !== 'string') {
        throw new ActionValidationError('contactId is required');
      }

      return executeAction<
        { deleted: boolean; type: 'soft' | 'hard' },
        ServiceCallLambdaResponse<{ deleted: boolean; type: 'soft' | 'hard' }>
      >(
        'nylasDeleteContact',
        async () => {
          const companyId = context.companyId!;
          const userId = new mongoose.Types.ObjectId(context.userId!);

          // Get contact details before deletion (for snapshot)
          let contactSnapshot: any = {};
          try {
            const contact = await getContactByIdService(companyId, contactId);
            contactSnapshot = {
              givenName: contact.given_name,
              surname: contact.surname,
              emails: contact.emails,
              phoneNumbers: contact.phone_numbers,
              companyName: contact.company_name,
              notes: contact.notes,
            };
          } catch (error) {
            console.warn('[Contact Delete] Could not retrieve contact for snapshot:', error);
          }

          // Get grant ID for metadata
          const { getApiKey } = await import('../../../services/api.key.service');
          const grantId = await getApiKey(companyId, 'nylas_grant_id');

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
            await deleteContactService(companyId, contactId);
            metadata.softDelete(userId, deletionReason);
            await metadata.save();

            console.log(`[Contact Delete] Hard deleted contact ${contactId}`);

            return {
              success: true,
              data: { deleted: true, type: 'hard' },
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
              data: { deleted: true, type: 'soft' },
              description: `Contact marked as deleted (soft delete). Contact still exists in Google Contacts. ` +
                `Use confirmHardDelete=true to permanently delete. Can be restored.`,
            };
          }
        },
        { serviceName: SERVICE_NAME },
      );
    },
  },

  // Search contacts
  nylasSearchContacts: {
    description:
      'Search contacts across multiple criteria: name, email, phone, company. ' +
      'Returns matching contacts from Google Contacts.',
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
      },
      required: [],
      additionalProperties: false,
    },
    function: async (args: SearchCriteria): Promise<StandardActionResult<ContactData[]>> => {
      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }

      // At least one search criterion required
      if (!args.name && !args.email && !args.phone && !args.companyName) {
        throw new ActionValidationError(
          'At least one search criterion required: name, email, phone, or companyName'
        );
      }

      return executeAction<ContactData[], ServiceCallLambdaResponse<ContactData[]>>(
        'nylasSearchContacts',
        async () => {
          const contacts = await searchContactsService(context.companyId!, args);
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
        },
        { serviceName: SERVICE_NAME },
      );
    },
  },

  // Find duplicates
  nylasFindDuplicates: {
    description:
      'Find duplicate contacts based on email or name matching. ' +
      'Returns groups of contacts that appear to be duplicates.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of contacts to scan (default: 100)',
        },
      },
      required: [],
      additionalProperties: false,
    },
    function: async (args: {
      limit?: number;
    }): Promise<StandardActionResult<Array<{
      contacts: ContactData[];
      reason: string;
    }>>> => {
      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }

      return executeAction<
        Array<{ contacts: ContactData[]; reason: string }>,
        ServiceCallLambdaResponse<Array<{ contacts: ContactData[]; reason: string }>>
      >(
        'nylasFindDuplicates',
        async () => {
          const duplicates = await findDuplicatesService(context.companyId!, args);

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
        },
        { serviceName: SERVICE_NAME },
      );
    },
  },

  // Search by metadata tags
  nylasSearchContactsByTags: {
    description:
      'Search contacts by tags in ContactMetadata. Returns contacts that have ALL specified tags.',
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
      },
      required: ['tags'],
      additionalProperties: false,
    },
    function: async (args: {
      tags: string[];
      limit?: number;
    }): Promise<StandardActionResult<Array<ContactData & { tags: string[] }>>> => {
      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }

      if (!args.tags || args.tags.length === 0) {
        throw new ActionValidationError('At least one tag is required');
      }

      return executeAction<
        Array<ContactData & { tags: string[] }>,
        ServiceCallLambdaResponse<Array<ContactData & { tags: string[] }>>
      >(
        'nylasSearchContactsByTags',
        async () => {
          const companyId = new mongoose.Types.ObjectId(context.companyId!);
          const { limit = 50 } = args;

          // Find metadata with ALL specified tags
          const metadataList = await ContactMetadata.find({
            companyId,
            tags: { $all: args.tags },
            isDeleted: false,
          })
            .limit(limit)
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
                metadata.contactId
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
            description: `Found ${contactData.length} contact(s) with tags: ${args.tags.join(', ')}`,
          };
        },
        { serviceName: SERVICE_NAME },
      );
    },
  },

  // Search by lifecycle stage
  nylasSearchContactsByLifecycle: {
    description:
      'Search contacts by lifecycle stage (lead, prospect, customer, partner, inactive).',
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
      },
      required: ['lifecycle'],
      additionalProperties: false,
    },
    function: async (args: {
      lifecycle: 'lead' | 'prospect' | 'customer' | 'partner' | 'inactive';
      limit?: number;
    }): Promise<StandardActionResult<Array<ContactData & { lifecycle: string }>>> => {
      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }

      return executeAction<
        Array<ContactData & { lifecycle: string }>,
        ServiceCallLambdaResponse<Array<ContactData & { lifecycle: string }>>
      >(
        'nylasSearchContactsByLifecycle',
        async () => {
          const companyId = new mongoose.Types.ObjectId(context.companyId!);
          const { limit = 50 } = args;

          // Find metadata with specified lifecycle
          const metadataList = await ContactMetadata.find({
            companyId,
            lifecycle: args.lifecycle,
            isDeleted: false,
          })
            .limit(limit)
            .sort({ updatedAt: -1 });

          if (metadataList.length === 0) {
            return {
              success: true,
              data: [],
              description: `No contacts found with lifecycle: ${args.lifecycle}`,
            };
          }

          // Fetch actual contact data from Nylas
          const contactData: Array<ContactData & { lifecycle: string }> = [];

          for (const metadata of metadataList) {
            try {
              const contact = await getContactByIdService(
                context.companyId!,
                metadata.contactId
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
            description: `Found ${contactData.length} ${args.lifecycle} contact(s)`,
          };
        },
        { serviceName: SERVICE_NAME },
      );
    },
  },

  // ==========================================
  // CONTACT GROUP MANAGEMENT ACTIONS
  // ==========================================

  nylasCreateContactGroup: {
    description: 'Create a new contact group for organizing contacts.',
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
      },
      required: ['name'],
      additionalProperties: false,
    },
    function: async (args: {
      name: string;
      description?: string;
    }): Promise<StandardActionResult> => {
      if (!context.companyId || !context.userId) {
        throw new ActionValidationError('Company ID and User ID are required.');
      }

      return executeAction(
        'nylasCreateContactGroup',
        async () => {
          const group = await groupsService.createGroup(
            context.companyId!,
            context.userId!,
            args.name,
            args.description
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
    description: 'Add a contact to a group.',
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
      },
      required: ['groupId', 'contactId'],
      additionalProperties: false,
    },
    function: async (args: {
      groupId: string;
      contactId: string;
    }): Promise<StandardActionResult> => {
      if (!context.companyId) {
        throw new ActionValidationError('Company ID is required.');
      }

      return executeAction(
        'nylasAddContactToGroup',
        async () => {
          const grantId = await getApiKey(context.companyId!, 'nylas_grant_id');
          if (!grantId) {
            throw new Error('Nylas Grant ID not configured');
          }

          await groupsService.addContactToGroup(
            args.groupId,
            args.contactId,
            grantId,
            context.companyId!
          );

          return {
            success: true,
            data: null,
            description: 'Contact added to group',
          };
        },
        { serviceName: SERVICE_NAME },
      );
    },
  },

  nylasRemoveContactFromGroup: {
    description: 'Remove a contact from a group.',
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
      },
      required: ['groupId', 'contactId'],
      additionalProperties: false,
    },
    function: async (args: {
      groupId: string;
      contactId: string;
    }): Promise<StandardActionResult> => {
      if (!context.companyId) {
        throw new ActionValidationError('Company ID is required.');
      }

      return executeAction(
        'nylasRemoveContactFromGroup',
        async () => {
          const grantId = await getApiKey(context.companyId!, 'nylas_grant_id');
          if (!grantId) {
            throw new Error('Nylas Grant ID not configured');
          }

          await groupsService.removeContactFromGroup(
            args.groupId,
            args.contactId,
            grantId,
            context.companyId!
          );

          return {
            success: true,
            data: null,
            description: 'Contact removed from group',
          };
        },
        { serviceName: SERVICE_NAME },
      );
    },
  },
});
