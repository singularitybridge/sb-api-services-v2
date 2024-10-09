import { IMessage, Message } from '../models/Message';
import mongoose from 'mongoose';

export const getMessagesBySessionId = async (sessionId: string): Promise<IMessage[]> => {
  return await Message.find({ sessionId: new mongoose.Types.ObjectId(sessionId) })
    .sort({ timestamp: 1 })
    .exec();
};

export const getMessageById = async (messageId: string): Promise<IMessage | null> => {
  return await Message.findById(messageId).exec();
};

export const getMessagesByType = async (sessionId: string, messageType: string): Promise<IMessage[]> => {
  return await Message.find({
    sessionId: new mongoose.Types.ObjectId(sessionId),
    messageType: messageType
  })
    .sort({ timestamp: 1 })
    .exec();
};

export const getLatestMessageByType = async (sessionId: string, messageType: string): Promise<IMessage | null> => {
  return await Message.findOne({
    sessionId: new mongoose.Types.ObjectId(sessionId),
    messageType: messageType
  })
    .sort({ timestamp: -1 })
    .exec();
};