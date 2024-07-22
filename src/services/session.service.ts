// File: src/services/session.service.ts
import { Assistant } from '../models/Assistant';
import { Session } from '../models/Session';
import { createNewThread } from './oai.thread.service';
import { User } from '../models/User';
import { Company } from '../models/Company';



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
]

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
  assistantId?: string,
) => {
  let session = await Session.findOne({ userId, companyId, active: true });

  if (session) {
    if (assistantId && session.assistantId !== assistantId) {
      session.assistantId = assistantId;
      await session.save();
    }
  } else {
    const threadId = await createNewThread(apiKey);

    if (!assistantId) {
      console.log('No assistantId provided, finding default assistant', { companyId });
      const defaultAssistant = await Assistant.findOne({ companyId });
      assistantId = defaultAssistant?._id;
    }

    if (assistantId) {
      session = new Session({
        userId,
        companyId,
        assistantId,
        active: true,
        threadId: threadId,
      });
      await session.save();
    } else {
      throw new Error('No assistantId available to create a session');
    }
  }

  // Fetch additional details
  const user = await User.findById(userId);
  const assistant = await Assistant.findById(session.assistantId);
  const company = await Company.findById(companyId);

  return {
    _id: session._id,
    userId: session.userId,
    assistantId: session.assistantId,
    threadId: session.threadId,
    active: session.active,
    companyId: session.companyId,
    userName: user ? user.name : undefined,
    assistantName: assistant ? assistant.name : undefined,
    companyName: company ? company.name : undefined,
  };
};

