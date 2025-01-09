import { AuthenticatedSocket } from '../../types';
import { registerRpcMethod } from '../utils';
import { 
  createJournalEntry, 
  getJournalEntries, 
  searchJournalEntries,
  updateJournalEntry,
  deleteJournalEntry
} from '../../../../integrations/journal/journal.service';
import { Types } from 'mongoose';
import { getApiKey } from '../../../api.key.service';
import { ChannelType } from '../../../../types/ChannelType';

// Register createJournalEntry RPC method
registerRpcMethod('createJournalEntry', async (socket: AuthenticatedSocket, params: any) => {
  const { content, entryType, tags } = params;
  const { userId, companyId } = socket.decodedToken!;

  if (!content) {
    throw new Error('content is required');
  }

  const apiKey = await getApiKey(companyId, 'openai_api_key') as string;

  const result = await createJournalEntry(
    {
      content,
      entryType,
      tags,
      userId: new Types.ObjectId(userId),
      companyId: new Types.ObjectId(companyId),
    },
    apiKey,
    ChannelType.WEB
  );

  return { success: true, data: result };
});

// Register getJournalEntries RPC method
registerRpcMethod('getJournalEntries', async (socket: AuthenticatedSocket, params: any) => {
  const { entryType, tags, limit = 25, scope = 'user' } = params;
  const { userId, companyId } = socket.decodedToken!;

  const entries = await getJournalEntries(
    userId,
    companyId,
    socket.sessionId,
    entryType,
    tags,
    limit,
    scope
  );

  return { success: true, data: entries };
});

// Register updateJournalEntry RPC method
registerRpcMethod('updateJournalEntry', async (socket: AuthenticatedSocket, params: any) => {
  const { journalId, updateData } = params;

  if (!journalId || !updateData) {
    throw new Error('journalId and updateData are required');
  }

  const result = await updateJournalEntry(journalId, updateData);
  return { success: true, data: result };
});

// Register searchJournalEntries RPC method
registerRpcMethod('searchJournalEntries', async (socket: AuthenticatedSocket, params: any) => {
  const { query, limit = 10, scope = 'user' } = params;
  const { userId, companyId } = socket.decodedToken!;

  if (!query) {
    throw new Error('query is required');
  }

  const entries = await searchJournalEntries(
    query,
    companyId,
    scope === 'user' ? userId : undefined,
    limit
  );

  return { success: true, data: entries };
});

// Register deleteJournalEntry RPC method
registerRpcMethod('deleteJournalEntry', async (socket: AuthenticatedSocket, params: any) => {
  const { journalId } = params;

  if (!journalId) {
    throw new Error('journalId is required');
  }

  const result = await deleteJournalEntry(journalId);
  return { success: true, data: result };
});
