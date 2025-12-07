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
} from './contacts.service';
import { executeAction } from '../../actions/executor';
import { ActionValidationError } from '../../../utils/actionErrors';

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

export const createContactActions = (
  context: ActionContext,
): FunctionFactory => ({
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

      return executeAction<
        ContactData[],
        ServiceCallLambdaResponse<ContactData[]>
      >(
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
      const {
        contactId,
        email,
        givenName,
        surname,
        phone,
        companyName,
        notes,
      } = args;

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
          const contact = await updateContactService(
            context.companyId!,
            contactId,
            {
              email,
              givenName,
              surname,
              phone,
              companyName,
              notes,
            },
          );
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
});
