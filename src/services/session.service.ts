import { Assistant } from '../models/Assistant';
import { Session } from '../models/Session';
import { CustomError, NotFoundError } from '../utils/errors';
import { createNewThread, deleteThread } from './oai.thread.service';
import { ChannelType } from '../types/ChannelType';

export const sessionFriendlyAggreationQuery = [
  {
    $lookup: {
      from: 'users',
      localField: 'userId',
      foreignField: '_id',
      as: 'userDetails',
    },
  },
  {
    $unwind: '$userDetails',
  },
  {
    $lookup: {
      from: 'assistants',
      localField: 'assistantId',
      foreignField: '_id',
      as: 'assistantDetails',
    },
  },
  {
    $unwind: '$assistantDetails',
  },

  {
    $lookup: {
      from: 'companies',
      localField: 'companyId',
      foreignField: '_id',
      as: 'companyDetails',
    },
  },
  {
    $unwind: '$companyDetails',
  },

  {
    $project: {
      assistantId: 1,
      userId: 1,
      companyId: 1,
      userName: '$userDetails.name',
      assistantName: '$assistantDetails.name',
      companyName: '$companyDetails.name',
      threadId: 1,
      active: 1,
      channel: 1,
    },
  },
];

export const updateSessionAssistant = async (
  sessionId: string,
  assistantId: string,
) => {
  const session = await Session.findById(sessionId);
  if (session) {
    session.assistantId = assistantId;
    await session.save();
  }
};

export const getSessionOrCreate = async (
  apiKey: string,
  userId: string,
  companyId: string,
  channel: ChannelType = ChannelType.WEB,
) => {
  console.log(`Attempting to find or create session for userId: ${userId}, companyId: ${companyId}, channel: ${channel}`);

  const findSession = async () => {
    const session = await Session.findOne({ userId, companyId, channel, active: true });
    if (session) {
      console.log(`Existing session found: ${session._id}`);
      return session;
    }
    return null;
  };

  let session = await findSession();

  if (session) {
    return {
      _id: session._id,
      assistantId: session.assistantId,
      channel: session.channel,
    };
  }

  console.log('No existing session found. Attempting to create a new one.');

  const defaultAssistant = await Assistant.findOne({ companyId });

  if (!defaultAssistant) {
    console.error(`No default assistant available for companyId: ${companyId}`);
    throw new Error('No default assistant available for this company');
  }

  const threadId = await createNewThread(apiKey);

  try {
    session = await Session.create({
      userId,
      companyId,
      assistantId: defaultAssistant._id,
      active: true,
      threadId,
      channel,
    });
    console.log(`New session created: ${session._id}`);
  } catch (error: any) {
    if (error.code === 11000) {
      console.log('Duplicate key error encountered. Attempting to fetch existing session.');
      session = await findSession();
      if (!session) {
        console.error('Failed to retrieve session after duplicate key error');
        throw new Error('Failed to create or retrieve session after duplicate key error');
      }
      console.log(`Existing session retrieved after duplicate key error: ${session._id}`);
    } else {
      console.error('Error creating session:', error);
      throw error;
    }
  }

  return {
    _id: session._id,
    assistantId: session.assistantId,
    channel: session.channel,
  };
};

export const endSession = async (apiKey: string, sessionId: string): Promise<boolean> => {
  const session = await Session.findOne({ _id: sessionId, active: true });
  
  if (!session) {
    throw new NotFoundError('Active session');
  }

  try {
    await deleteThread(apiKey, session.threadId);
    session.active = false;
    await session.save();

    console.log(`Session ended, sessionId: ${sessionId}, userId: ${session.userId}, channel: ${session.channel}`);
    return true;
  } catch (error: any) {
    console.error('Error ending session:', error);
    throw new CustomError('Failed to end session', 500);
  }
};

// Function to ensure the correct index is created
export const ensureSessionIndex = async () => {
  try {
    await Session.collection.dropIndexes();
    await Session.collection.createIndex(
      { companyId: 1, userId: 1, channel: 1 },
      { unique: true, partialFilterExpression: { active: true } }
    );
    console.log('Session index updated successfully');
  } catch (error) {
    console.error('Error updating session index:', error);
  }
};