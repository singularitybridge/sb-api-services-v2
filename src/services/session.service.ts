// File: src/services/session.service.ts
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
  const defaultAssistant = await Assistant.findOne({ companyId });

  if (!defaultAssistant) {
    throw new Error('No default assistant available for this company');
  }

  // First, try to find an active session for the user and company, regardless of the channel
  let session = await Session.findOne({ userId, companyId, active: true });

  if (session) {
    // If a session exists but the channel is different, update the channel
    if (session.channel !== channel) {
      session.channel = channel;
      await session.save();
    }
  } else {
    // If no session exists, create a new one
    const threadId = await createNewThread(apiKey);
    session = new Session({
      userId,
      companyId,
      assistantId: defaultAssistant._id,
      active: true,
      threadId,
      channel,
    });
    await session.save();
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
  } catch (error: unknown) {
    console.error('Error ending session:', error);
    throw new CustomError('Failed to end session', 500);
  }
};
