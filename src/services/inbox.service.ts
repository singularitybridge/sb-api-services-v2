import moment from 'moment';
import { IInbox, Inbox } from '../models/Inbox';
import { Session } from '../models/Session';
import { User } from '../models/User';
import { Assistant } from '../models/Assistant';
import mongoose from 'mongoose';

interface IInboxInput {
  message: string;
  sessionId: string;
}

export const addMessageToInbox = async (inboxInput: IInboxInput) => {

  const inboxMessage = new Inbox(inboxInput);
  const session = await Session.findById(inboxInput.sessionId);
  const assistant = await Assistant.findById(session?.assistantId);

  if (!assistant) {
    throw new Error('Session not found');
  }
  
  inboxMessage.assistantId = assistant._id;
  return await inboxMessage.save();

};

export const getInboxMessages = async (companyId: string) => {
  const sessionIds = (await Session.find({ companyId }).select('_id createdAt').lean()).map(s => s._id);
  console.log("Session IDs: ", sessionIds);

  const aggregationPipeline: any[] = [
    {
      $match: {
        sessionId: { $in: sessionIds }
      }
    },
    {
      $lookup: {
        from: 'sessions',
        localField: 'sessionId',
        foreignField: '_id',
        as: 'sessionInfo'
      }
    },
    { $unwind: '$sessionInfo' },
    { $sort: { 'createdAt': 1 } },
    // filter for active sessions only
    {
      $match: {
        'sessionInfo.active': true
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: 'sessionInfo.userId',
        foreignField: '_id',
        as: 'userInfo'
      }
    },
    { $unwind: '$userInfo' },
    {
      $lookup: {
        from: 'assistants',
        localField: 'assistantId',
        foreignField: '_id',
        as: 'assistantInfo'
      }
    },
    { $unwind: { path: '$assistantInfo', preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: '$sessionId',
        createdAt: { $first: '$sessionInfo.createdAt' },
        messages: {
          $push: {
            _id: '$_id',
            message: '$message',
            createdAt: { $toDate: '$created' },
            userName: '$userInfo.name',
            sessionActive: '$sessionInfo.active',
            assistantName: '$assistantInfo.name',
            assistantId: '$assistantId'
          }
        }
      }
    },
    { $sort: { 'createdAt': -1 } },
    {
      $project: {
        _id: 0,
        sessionId: '$_id',
        messages: 1
      }
    }
  ];

  const result = await Inbox.aggregate(aggregationPipeline);
  return result;
};






export const getInboxMessage = async (id: string) => {
  return Inbox.findById(id);
};
