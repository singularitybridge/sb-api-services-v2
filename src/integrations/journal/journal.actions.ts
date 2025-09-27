import { ActionContext, FunctionFactory, ActionType } from '../actions/types';
import {
  createJournalEntry,
  getJournalEntries,
  updateJournalEntry,
  deleteJournalEntry,
  getFriendlyJournalEntries,
  searchJournalEntries,
} from './journal.service';
import { getSessionById } from '../../services/session.service';
import { IJournal } from '../../models/Journal';
import { getApiKey } from '../../services/api.key.service';
import { Types } from 'mongoose';
import { executeAction } from '../actions/executor';
import {
  ActionExecutionError,
  ActionValidationError,
} from '../../utils/actionErrors';

interface JournalEntryArgs {
  content: string;
  entryType: string; // Made required
  tags?: string[];
  metadata?: Record<string, any>; // Added metadata
}

interface GetJournalEntriesArgs {
  entryType?: string;
  tags?: string[];
  limit?: number;
  scope?: 'user' | 'company';
}

interface UpdateJournalEntryArgs {
  journalId: string;
  updateData: Partial<IJournal>;
}

interface SearchJournalEntriesArgs {
  query: string;
  limit?: number;
  scope?: 'user' | 'company';
  entryType?: string; // Added entryType
  tags?: string[]; // Added tags
}

export const createJournalActions = (
  context: ActionContext & { companyId: string },
): FunctionFactory => ({
  createJournalEntry: {
    description: 'Create a new journal entry',
    strict: false,
    actionType: ActionType.JOURNAL_OPERATION,
    parameters: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description: 'The content of the journal entry',
        },
        entryType: {
          type: 'string',
          description: 'The type of the journal entry',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tags for the journal entry',
        },
        metadata: {
          type: 'object',
          description: 'Additional metadata for the journal entry',
          additionalProperties: true,
        },
      },
      required: ['content', 'entryType'], // entryType is now required
      additionalProperties: false,
    },
    function: async (args: JournalEntryArgs) => {
      const { content, entryType, tags, metadata } = args;
      const { companyId, sessionId } = context;
      const actionName = 'createJournalEntry';

      if (!sessionId) {
        throw new ActionExecutionError('Session ID is required.', {
          actionName,
          statusCode: 400,
        });
      }
      // Assuming companyId is guaranteed by ActionContext typing & population
      // if (!companyId) {
      //   throw new ActionExecutionError('Company ID is required.', { actionName, statusCode: 400 });
      // }

      const session = await getSessionById(sessionId);
      if (!session) {
        throw new ActionExecutionError('Invalid session.', {
          actionName,
          statusCode: 401,
        });
      }
      if (!session.userId) {
        throw new ActionExecutionError('User ID not found in session.', {
          actionName,
          statusCode: 400,
        });
      }

      const apiKey = (await getApiKey(companyId, 'openai_api_key')) || '';

      return executeAction<IJournal>(
        actionName,
        async () => {
          const result = await createJournalEntry(
            {
              content,
              entryType,
              tags,
              metadata,
              userId: new Types.ObjectId(session.userId as string),
              companyId: new Types.ObjectId(companyId),
            },
            apiKey,
          );
          return { success: true, data: result };
        },
        { serviceName: 'JournalService' },
      );
    },
  },

  searchJournalEntries: {
    description: 'Search journal entries using vector similarity search',
    strict: true,
    actionType: ActionType.JOURNAL_OPERATION,
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query text',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of entries to return',
        },
        scope: {
          type: 'string',
          enum: ['user', 'company'],
          description:
            'Search entries for current user only or all company entries',
        },
        entryType: {
          type: 'string',
          description: 'Filter by entry type',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter by tags',
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
    function: async ({
      query,
      limit = 10,
      scope = 'user',
      entryType,
      tags,
    }: SearchJournalEntriesArgs) => {
      const { companyId, sessionId } = context;
      const actionName = 'searchJournalEntries';

      if (!sessionId) {
        throw new ActionExecutionError('Session ID is required.', {
          actionName,
          statusCode: 400,
        });
      }
      // if (!companyId) {
      //   throw new ActionExecutionError('Company ID is required.', { actionName, statusCode: 400 });
      // }

      const session = await getSessionById(sessionId);
      if (!session) {
        throw new ActionExecutionError('Invalid session.', {
          actionName,
          statusCode: 401,
        });
      }
      // session.userId is optional for company scope search, so no explicit check here if scope is 'company'

      return executeAction<IJournal[]>( // Assuming search returns an array of IJournal
        actionName,
        async () => {
          const entries = await searchJournalEntries(
            query,
            companyId,
            scope === 'user' ? session.userId : undefined,
            entryType,
            tags,
            limit,
          );
          return { success: true, data: entries };
        },
        { serviceName: 'JournalService' },
      );
    },
  },

  getJournalEntries: {
    description: 'Get journal entries',
    strict: true,
    actionType: ActionType.JOURNAL_OPERATION,
    parameters: {
      type: 'object',
      properties: {
        entryType: { type: 'string', description: 'Filter by entry type' },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter by tags',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of entries to return',
        },
        scope: {
          type: 'string',
          enum: ['user', 'company'],
          description:
            'Get entries for current user only or all company entries',
        },
      },
      required: [],
      additionalProperties: false,
    },
    function: async ({
      entryType,
      tags,
      limit = 25,
      scope = 'user',
    }: GetJournalEntriesArgs) => {
      const { companyId, sessionId } = context;
      const actionName = 'getJournalEntries';

      if (!sessionId) {
        throw new ActionExecutionError('Session ID is required.', {
          actionName,
          statusCode: 400,
        });
      }
      // if (!companyId) {
      //   throw new ActionExecutionError('Company ID is required.', { actionName, statusCode: 400 });
      // }

      const session = await getSessionById(sessionId);
      if (!session) {
        throw new ActionExecutionError('Invalid session.', {
          actionName,
          statusCode: 401,
        });
      }
      if (!session.userId && scope === 'user') {
        // userId is required for user scope
        throw new ActionExecutionError(
          'User ID not found in session for user-scoped query.',
          { actionName, statusCode: 400 },
        );
      }

      return executeAction<IJournal[]>( // Assuming get returns an array of IJournal
        actionName,
        async () => {
          const entries = await getJournalEntries(
            session.userId, // Can be undefined if scope is 'company' and service handles it
            companyId,
            undefined, // Assuming this is for a specific context not used here
            entryType,
            tags,
            limit,
            scope,
          );
          return { success: true, data: entries };
        },
        { serviceName: 'JournalService' },
      );
    },
  },

  getFriendlyJournalEntries: {
    description:
      'Get journal entries in a friendly format with user and agent names',
    strict: true,
    actionType: ActionType.JOURNAL_OPERATION,
    parameters: {
      type: 'object',
      properties: {
        entryType: { type: 'string', description: 'Filter by entry type' },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter by tags',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of entries to return',
        },
        scope: {
          type: 'string',
          enum: ['user', 'company'],
          description:
            'Get entries for current user only or all company entries',
        },
      },
      required: [],
      additionalProperties: false,
    },
    function: async ({
      entryType,
      tags,
      limit = 25,
      scope = 'user',
    }: GetJournalEntriesArgs) => {
      const { companyId, sessionId } = context;
      const actionName = 'getFriendlyJournalEntries';

      if (!sessionId) {
        throw new ActionExecutionError('Session ID is required.', {
          actionName,
          statusCode: 400,
        });
      }
      // if (!companyId) {
      //   throw new ActionExecutionError('Company ID is required.', { actionName, statusCode: 400 });
      // }

      const session = await getSessionById(sessionId);
      if (!session) {
        throw new ActionExecutionError('Invalid session.', {
          actionName,
          statusCode: 401,
        });
      }
      if (!session.userId && scope === 'user') {
        // userId is required for user scope
        throw new ActionExecutionError(
          'User ID not found in session for user-scoped query.',
          { actionName, statusCode: 400 },
        );
      }

      // Assuming FriendlyJournalEntry[] is the return type, using any[] for now
      return executeAction<any[]>(
        actionName,
        async () => {
          const entries = await getFriendlyJournalEntries(
            session.userId, // Can be undefined if scope is 'company' and service handles it
            companyId,
            undefined, // Assuming this is for a specific context not used here
            entryType,
            tags,
            limit,
            scope,
          );
          return { success: true, data: entries };
        },
        { serviceName: 'JournalService' },
      );
    },
  },

  updateJournalEntry: {
    description: 'Update a journal entry',
    strict: false,
    actionType: ActionType.JOURNAL_OPERATION,
    parameters: {
      type: 'object',
      properties: {
        journalId: { type: 'string' },
        updateData: { type: 'object' },
      },
      required: ['journalId', 'updateData'],
      additionalProperties: false,
    },
    function: async (args: UpdateJournalEntryArgs) => {
      const { journalId, updateData } = args;
      const actionName = 'updateJournalEntry';

      if (!journalId) {
        throw new ActionValidationError('journalId is required.', {
          fieldErrors: { journalId: 'journalId is required.' },
        });
      }
      if (!updateData || Object.keys(updateData).length === 0) {
        throw new ActionValidationError('updateData cannot be empty.', {
          fieldErrors: { updateData: 'updateData cannot be empty.' },
        });
      }

      return executeAction<IJournal | null>( // updateJournalEntry might return null if not found, or the updated IJournal
        actionName,
        async () => {
          const result = await updateJournalEntry(journalId, updateData);
          return { success: true, data: result };
        },
        { serviceName: 'JournalService' },
      );
    },
  },

  deleteJournalEntry: {
    description: 'Delete a journal entry',
    strict: true,
    actionType: ActionType.JOURNAL_OPERATION,
    parameters: {
      type: 'object',
      properties: {
        journalId: { type: 'string' },
      },
      required: ['journalId'],
      additionalProperties: false,
    },
    function: async ({ journalId }: { journalId: string }) => {
      const actionName = 'deleteJournalEntry';

      if (!journalId) {
        throw new ActionValidationError('journalId is required.', {
          fieldErrors: { journalId: 'journalId is required.' },
        });
      }

      return executeAction<any>( // Define specific return type if known (e.g., { deletedCount: number } or IJournal | null)
        actionName,
        async () => {
          const result = await deleteJournalEntry(journalId);
          return { success: true, data: result };
        },
        { serviceName: 'JournalService' },
      );
    },
  },
});
