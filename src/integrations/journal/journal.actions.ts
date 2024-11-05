import { ActionContext, FunctionFactory, ActionType } from '../actions/types';
import {
  createJournalEntry,
  getJournalEntries,
  updateJournalEntry,
  deleteJournalEntry,
  getFriendlyJournalEntries,
} from './journal.service';
import { getSessionById } from '../../services/session.service';
import { ChannelType } from '../../types/ChannelType';
import { IJournal } from '../../models/Journal';
import { getApiKey } from '../../services/api.key.service';
import { Types } from 'mongoose';

interface JournalEntryArgs {
  content: string;
  entryType?: string;
  tags?: string[];
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
        content: { type: 'string', description: 'The content of the journal entry' },
        entryType: { type: 'string', description: 'The type of the journal entry' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Tags for the journal entry' },
      },
      required: ['content'],
      additionalProperties: false,
    },
    function: async (args: JournalEntryArgs) => {
      const { content, entryType, tags } = args;
      const { companyId, sessionId } = context;

      if (!sessionId) {
        return {
          error: 'Invalid session',
          message: 'Session ID is required.',
        };
      }

      try {
        const session = await getSessionById(sessionId);

        if (!session) {
          return {
            error: 'Invalid session',
            message: 'Unable to retrieve a valid session.',
          };
        }

        if (!session.userId || !companyId) {
          return {
            error: 'Missing parameters',
            message: 'userId and companyId are required to create a journal entry.',
          };
        }

        const apiKey = (await getApiKey(companyId, 'openai_api_key')) || '';
        const result = await createJournalEntry(
          {
            content,
            entryType,
            tags,
            userId: new Types.ObjectId(session.userId),
            companyId: new Types.ObjectId(companyId),
          },
          apiKey,
          ChannelType.WEB,
        );
        return { success: true, data: result };
      } catch (error) {
        return {
          error: 'Create failed',
          message:
            error instanceof Error
              ? error.message
              : 'An unknown error occurred while creating the journal entry.',
        };
      }
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
        tags: { type: 'array', items: { type: 'string' }, description: 'Filter by tags' },
        limit: { type: 'number', description: 'Maximum number of entries to return' },
        scope: { 
          type: 'string', 
          enum: ['user', 'company'],
          description: 'Get entries for current user only or all company entries' 
        },
      },
      required: [],
      additionalProperties: false,
    },
    function: async ({ entryType, tags, limit = 25, scope = 'user' }: GetJournalEntriesArgs) => {
      try {
        const { companyId, sessionId } = context;

        if (!sessionId) {
          return {
            error: 'Invalid session',
            message: 'Session ID is required.',
          };
        }

        if (!companyId) {
          return {
            error: 'Missing parameters',
            message: 'companyId is required to get journal entries.',
          };
        }

        const session = await getSessionById(sessionId);

        if (!session) {
          return {
            error: 'Invalid session',
            message: 'Unable to retrieve a valid session.',
          };
        }

        const entries = await getJournalEntries(
          session.userId,
          companyId,
          undefined,
          entryType,
          tags,
          limit,
          scope
        );
        return { success: true, data: entries };
      } catch (error) {
        return {
          error: 'Fetch failed',
          message:
            error instanceof Error
              ? error.message
              : 'An unknown error occurred while fetching journal entries.',
        };
      }
    },
  },

  getFriendlyJournalEntries: {
    description: 'Get journal entries in a friendly format with user and agent names',
    strict: true,
    actionType: ActionType.JOURNAL_OPERATION,
    parameters: {
      type: 'object',
      properties: {
        entryType: { type: 'string', description: 'Filter by entry type' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Filter by tags' },
        limit: { type: 'number', description: 'Maximum number of entries to return' },
        scope: { 
          type: 'string', 
          enum: ['user', 'company'],
          description: 'Get entries for current user only or all company entries' 
        },
      },
      required: [],
      additionalProperties: false,
    },
    function: async ({ entryType, tags, limit = 25, scope = 'user' }: GetJournalEntriesArgs) => {
      try {
        const { companyId, sessionId } = context;

        if (!sessionId) {
          return {
            error: 'Invalid session',
            message: 'Session ID is required.',
          };
        }

        if (!companyId) {
          return {
            error: 'Missing parameters',
            message: 'companyId is required to get journal entries.',
          };
        }

        const session = await getSessionById(sessionId);

        if (!session) {
          return {
            error: 'Invalid session',
            message: 'Unable to retrieve a valid session.',
          };
        }

        const entries = await getFriendlyJournalEntries(
          session.userId,
          companyId,
          undefined,
          entryType,
          tags,
          limit,
          scope
        );
        return { success: true, data: entries };
      } catch (error) {
        return {
          error: 'Fetch failed',
          message:
            error instanceof Error
              ? error.message
              : 'An unknown error occurred while fetching friendly journal entries.',
        };
      }
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

      if (!journalId || !updateData) {
        return {
          error: 'Missing parameters',
          message: 'Both journalId and updateData are required.',
        };
      }

      try {
        const result = await updateJournalEntry(journalId, updateData);
        return { success: true, data: result };
      } catch (error) {
        return {
          error: 'Update failed',
          message:
            error instanceof Error
              ? error.message
              : 'An unknown error occurred while updating the journal entry.',
        };
      }
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
      try {
        const result = await deleteJournalEntry(journalId);
        return { success: true, data: result };
      } catch (error) {
        return {
          error: 'Delete failed',
          message:
            error instanceof Error
              ? error.message
              : 'An unknown error occurred while deleting the journal entry.',
        };
      }
    },
  },
});
