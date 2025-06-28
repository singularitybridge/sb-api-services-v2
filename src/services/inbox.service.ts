import { IInbox, Inbox } from '../models/Inbox';
import { Session } from '../models/Session';
import { Assistant } from '../models/Assistant';
import mongoose from 'mongoose';

interface IInboxInput {
  message: string;
  sessionId: string;
  type: 'human_agent_request' | 'human_agent_response' | 'notification';
  companyId: string;
}

export const addMessageToInbox = async (inboxInput: IInboxInput) => {
  const session = await Session.findById(inboxInput.sessionId);
  if (!session) {
    throw new Error('Session not found');
  }

  const assistant = await Assistant.findById(session.assistantId);
  if (!assistant) {
    throw new Error('Assistant not found');
  }

  const inboxMessage = new Inbox({
    ...inboxInput,
    senderId: assistant._id,
    status: 'open',
    companyId: inboxInput.companyId,
  });

  return await inboxMessage.save();
};

export const getInboxMessages = async (companyId: string) => {
  const aggregationPipeline: any[] = [
    {
      $match: { companyId: new mongoose.Types.ObjectId(companyId) },
    },
    {
      $lookup: {
        from: 'sessions',
        localField: 'sessionId',
        foreignField: '_id',
        as: 'sessionInfo',
      },
    },
    { $unwind: '$sessionInfo' },
    {
      $lookup: {
        from: 'assistants',
        localField: 'senderId',
        foreignField: '_id',
        as: 'assistantInfo',
      },
    },
    { $unwind: '$assistantInfo' },
    {
      $lookup: {
        from: 'users',
        localField: 'sessionInfo.userId',
        foreignField: '_id',
        as: 'userInfo',
      },
    },
    { $unwind: '$userInfo' },
    {
      $group: {
        _id: '$sessionId',
        sessionId: { $first: '$sessionId' },
        userName: { $first: '$userInfo.name' },
        lastMessageAt: { $max: '$createdAt' },
        messages: {
          $push: {
            _id: '$_id',
            message: '$message',
            createdAt: '$createdAt',
            sessionActive: { $literal: true }, // Assuming all sessions are active
            assistantName: '$assistantInfo.name',
            senderId: '$senderId',
            type: '$type',
          },
        },
      },
    },
    {
      $sort: { lastMessageAt: -1 },
    },
    {
      $project: {
        _id: 0,
        sessionId: 1,
        userName: 1,
        lastMessageAt: 1,
        messages: 1,
      },
    },
  ];

  return await Inbox.aggregate(aggregationPipeline);
};

export const updateInboxMessageStatus = async (
  messageId: string,
  status: 'open' | 'in_progress' | 'closed',
) => {
  return await Inbox.findByIdAndUpdate(messageId, { status }, { new: true });
};

export const getInboxMessage = async (id: string) => {
  return Inbox.findById(id);
};
