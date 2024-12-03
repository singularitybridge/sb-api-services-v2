import { Journal, IJournal } from '../../models/Journal';
import mongoose from 'mongoose';
import { getSessionOrCreate, getSessionById } from '../../services/session.service';
import { ChannelType } from '../../types/ChannelType';
import { getUserById } from '../../services/user.service';
import { getAssistantById } from '../../services/assistant.service';
import { format, toZonedTime } from 'date-fns-tz';
import { upsertVector, deleteVector, runVectorSearch } from '../../services/vector.search.service';

type JournalScope = 'user' | 'company';

export async function createJournalEntry(
  journalData: Partial<IJournal>,
  apiKey: string,
  channel: ChannelType = ChannelType.WEB
): Promise<IJournal> {
  try {
    console.log('journal service :: Creating journal entry:', journalData);
    
    if (!journalData.userId || !journalData.companyId) {
      throw new Error('userId and companyId are required to create a journal entry');
    }

    // Get or create a session
    const session = await getSessionOrCreate(
      apiKey,
      journalData.userId.toString(),
      journalData.companyId.toString(),
      channel
    );
    journalData.sessionId = session._id;
    
    const newJournal = new Journal(journalData);
    const savedJournal = await newJournal.save();
    
    // Try to store in Pinecone, but don't fail if it errors
    try {
      await upsertVector(savedJournal._id.toString(), savedJournal.content, {
        userId: savedJournal.userId.toString(),
        companyId: savedJournal.companyId.toString(),
        sessionId: savedJournal.sessionId.toString(),
        entryType: savedJournal.entryType,
        tags: savedJournal.tags,
        timestamp: savedJournal.timestamp.toISOString(),
      });
    } catch (vectorError) {
      // Log the error but don't throw it
      console.warn('Warning: Failed to store vector in Pinecone:', vectorError);
      console.warn('Journal entry was saved to MongoDB but vector search will not be available for this entry');
    }
    
    return savedJournal;
  } catch (error) {
    console.error('Error creating journal entry:', error);
    throw error;
  }
}

export async function getJournalEntries(
  userId: string,
  companyId: string,
  sessionId?: string,
  entryType?: string,
  tags?: string[],
  limit: number = 25,
  scope: JournalScope = 'user'
): Promise<IJournal[]> {
  try {
    if (!companyId) {
      throw new Error('companyId is required to get journal entries');
    }

    const query: any = { companyId: new mongoose.Types.ObjectId(companyId) };
    
    if (scope === 'user') {
      query.userId = new mongoose.Types.ObjectId(userId);
    }
    
    if (sessionId) query.sessionId = new mongoose.Types.ObjectId(sessionId);
    if (entryType) query.entryType = entryType;
    if (tags && tags.length > 0) query.tags = { $in: tags };

    return await Journal.find(query).sort({ timestamp: -1 }).limit(limit);
  } catch (error) {
    console.error('Error getting journal entries:', error);
    throw error;
  }
}

export async function searchJournalEntries(
  query: string,
  companyId: string,
  userId?: string,
  limit: number = 10
): Promise<IJournal[]> {
  try {
    let journalEntries: IJournal[] = [];
    
    try {
      const searchResults = await runVectorSearch({
        query,
        entity: ['journal'],
        companyId,
        limit,
        filter: userId ? { userId: { $eq: userId } } : {},
      });

      // Get the IDs of matched documents
      const matchedIds = searchResults.map(match => match.id);

      // Fetch the full journal entries from MongoDB
      journalEntries = await Journal.find({
        _id: { $in: matchedIds.map(id => new mongoose.Types.ObjectId(id)) },
      });

      // Sort entries based on the order of search results
      const idToEntry = new Map(journalEntries.map(entry => [entry._id.toString(), entry]));
      journalEntries = matchedIds.map(id => idToEntry.get(id)!).filter(Boolean);
    } catch (vectorError) {
      console.warn('Warning: Vector search failed, falling back to text search:', vectorError);
      
      // Fallback to basic text search if vector search fails
      const textSearchQuery: any = {
        companyId: new mongoose.Types.ObjectId(companyId),
        $text: { $search: query },
      };
      
      if (userId) {
        textSearchQuery.userId = new mongoose.Types.ObjectId(userId);
      }
      
      journalEntries = await Journal.find(textSearchQuery)
        .sort({ score: { $meta: 'textScore' } })
        .limit(limit);
    }
    
    return journalEntries;
  } catch (error) {
    console.error('Error searching journal entries:', error);
    throw error;
  }
}

export async function getFriendlyJournalEntries(
  userId: string,
  companyId: string,
  sessionId?: string,
  entryType?: string,
  tags?: string[],
  limit: number = 25,
  scope: JournalScope = 'user'
): Promise<Array<IJournal & { userName: string; agentName: string | null; friendlyTimestamp: string }>> {
  try {
    if (!companyId) {
      throw new Error('companyId is required to get friendly journal entries');
    }

    const entries = await getJournalEntries(userId, companyId, sessionId, entryType, tags, limit, scope);
    
    const userIds = [...new Set(entries.map(entry => entry.userId.toString()))];
    const users = await Promise.all(userIds.map(id => getUserById(id)));
    const userMap = new Map(users.map(user => [user?._id.toString(), user?.name || 'Unknown User']));
    
    const friendlyEntries = await Promise.all(entries.map(async (entry) => {
      const session = await getSessionById(entry.sessionId.toString());
      let agentName = null;
      
      if (session && session.assistantId) {
        const assistant = await getAssistantById(session.assistantId);
        agentName = assistant ? assistant.name : null;
      }

      const israelTime = toZonedTime(entry.timestamp, 'Asia/Jerusalem');
      const friendlyTimestamp = format(israelTime, 'dd/MM/yy, HH:mm', { timeZone: 'Asia/Jerusalem' });

      return {
        ...entry.toObject(),
        userName: userMap.get(entry.userId.toString()) || 'Unknown User',
        agentName: agentName,
        friendlyTimestamp: friendlyTimestamp
      };
    }));

    // Sort entries from new to old
    friendlyEntries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return friendlyEntries;
  } catch (error) {
    console.error('Error getting friendly journal entries:', error);
    throw error;
  }
}

export async function updateJournalEntry(
  journalId: string,
  updateData: Partial<IJournal>
): Promise<IJournal | null> {
  try {
    const updatedJournal = await Journal.findByIdAndUpdate(journalId, updateData, { new: true });
    
    if (updatedJournal && updateData.content) {
      // Try to update vector in Pinecone, but don't fail if it errors
      try {
        await upsertVector(updatedJournal._id.toString(), updatedJournal.content, {
          userId: updatedJournal.userId.toString(),
          companyId: updatedJournal.companyId.toString(),
          sessionId: updatedJournal.sessionId.toString(),
          entryType: updatedJournal.entryType,
          tags: updatedJournal.tags,
          timestamp: updatedJournal.timestamp.toISOString(),
        });
      } catch (vectorError) {
        console.warn('Warning: Failed to update vector in Pinecone:', vectorError);
        console.warn('Journal entry was updated in MongoDB but vector search may be out of sync');
      }
    }
    
    return updatedJournal;
  } catch (error) {
    console.error('Error updating journal entry:', error);
    throw error;
  }
}

export async function deleteJournalEntry(journalId: string): Promise<boolean> {
  try {
    const result = await Journal.findByIdAndDelete(journalId);
    if (result) {
      // Try to delete from Pinecone, but don't fail if it errors
      try {
        await deleteVector(journalId);
      } catch (vectorError) {
        console.warn('Warning: Failed to delete vector from Pinecone:', vectorError);
      }
    }
    return !!result;
  } catch (error) {
    console.error('Error deleting journal entry:', error);
    throw error;
  }
}
