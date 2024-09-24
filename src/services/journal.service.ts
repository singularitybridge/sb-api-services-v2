import { Journal, IJournal } from '../models/Journal';
import mongoose from 'mongoose';
import { getSessionOrCreate, getSessionById } from './session.service';
import { ChannelType } from '../types/ChannelType';
import { getUserById } from './user.service';
import { getAssistantById } from './assistant.service';
import { format, toZonedTime } from 'date-fns-tz';

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
    return await newJournal.save();
  } catch (error) {
    console.error('Error creating journal entry:', error);
    throw error;
  }
}

export async function getJournalEntries(
  userId: string,
  companyId?: string,
  sessionId?: string,
  entryType?: string,
  tags?: string[],
  limit: number = 25
): Promise<IJournal[]> {
  try {
    const query: any = { userId: new mongoose.Types.ObjectId(userId) };
    if (companyId) query.companyId = new mongoose.Types.ObjectId(companyId);
    if (sessionId) query.sessionId = new mongoose.Types.ObjectId(sessionId);
    if (entryType) query.entryType = entryType;
    if (tags && tags.length > 0) query.tags = { $in: tags };

    return await Journal.find(query).sort({ timestamp: -1 }).limit(limit);
  } catch (error) {
    console.error('Error getting journal entries:', error);
    throw error;
  }
}

export async function getFriendlyJournalEntries(
  userId: string,
  companyId?: string,
  sessionId?: string,
  entryType?: string,
  tags?: string[],
  limit: number = 25
): Promise<Array<IJournal & { userName: string; agentName: string | null; friendlyTimestamp: string }>> {
  try {
    const entries = await getJournalEntries(userId, companyId, sessionId, entryType, tags, limit);
    const user = await getUserById(userId);
    
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
        userName: user?.name || 'Unknown User',
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
    return await Journal.findByIdAndUpdate(journalId, updateData, { new: true });
  } catch (error) {
    console.error('Error updating journal entry:', error);
    throw error;
  }
}

export async function deleteJournalEntry(journalId: string): Promise<boolean> {
  try {
    const result = await Journal.findByIdAndDelete(journalId);
    return !!result;
  } catch (error) {
    console.error('Error deleting journal entry:', error);
    throw error;
  }
}