import { ActionContext, FunctionFactory, ActionType } from './types';
import {
  createJournalEntry,
  getJournalEntries,
  updateJournalEntry,
  deleteJournalEntry,
  getFriendlyJournalEntries,
} from '../services/journal.service';
import { getSessionById } from '../services/session.service';
import { ChannelType } from '../types/ChannelType';
import { IJournal } from '../models/Journal';
import { getApiKey } from '../services/api.key.service';

export const createJournalActions = (
  context: ActionContext,
): FunctionFactory => ({
  createJournalEntry: {
    description: 'Create a new journal entry',
    strict: false,
    actionType: ActionType.JOURNAL_OPERATION,
    parameters: {
      type: 'object',
      properties: {
        journalData: {
          type: 'object',
          description: 'The data for the new journal entry',
        },
      },
      required: ['journalData'],
      additionalProperties: false,
    },
    function: async (args) => {
      const { journalData } = args;
      const { companyId, sessionId } = context;

      if (!journalData) {
        return {
          error: 'Missing parameters',
          message: 'journalData is required.',
        };
      }

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

        const apiKey = (await getApiKey(companyId, 'openai')) || '';
        const result = await createJournalEntry(
          {
            ...journalData,
            userId: session.userId,
            companyId,
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
        entryType: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        limit: { type: 'number' },
      },
      required: [],
      additionalProperties: false,
    },
    function: async ({ entryType, tags, limit = 25 }) => {
      try {
        const { companyId, sessionId } = context;

        if (!sessionId) {
          return {
            error: 'Invalid session',
            message: 'Session ID is required.',
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
        entryType: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        limit: { type: 'number' },
      },
      required: [],
      additionalProperties: false,
    },
    function: async ({ entryType, tags, limit = 25 }) => {
      try {
        const { companyId, sessionId } = context;

        if (!sessionId) {
          return {
            error: 'Invalid session',
            message: 'Session ID is required.',
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
    function: async (args) => {
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
    function: async ({ journalId }) => {
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
