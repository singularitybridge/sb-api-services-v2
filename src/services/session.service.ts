// File: src/services/session.service.ts
import { Assistant } from '../models/Assistant';
import { Session } from '../models/Session';
import { CustomError, NotFoundError } from '../utils/errors';
import { createNewThread, deleteThread } from './oai.thread.service';

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
) => {
  let session = await Session.findOne({ userId, companyId, active: true });

  if (!session) {
    const threadId = await createNewThread(apiKey);
    const defaultAssistant = await Assistant.findOne({ companyId });

    if (!defaultAssistant) {
      throw new Error('No default assistant available for this company');
    }

    session = new Session({
      userId,
      companyId,
      assistantId: defaultAssistant._id,
      active: true,
      threadId: threadId,
    });
    await session.save();
  }

  const assistant = await Assistant.findById(session.assistantId);

  return {
    _id: session._id,
    assistantId: session.assistantId,
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

    console.log(`Session ended, sessionId: ${sessionId}, userId: ${session.userId}`);
    return true;
  } catch (error: unknown) {
    console.error('Error ending session:', error);
    throw new CustomError('Failed to end session', 500);
  }
};

