import { IInbox, Inbox } from '../models/Inbox';

interface IInboxInput {
  message: string;
  sessionId: string;
}


export const addMessageToInbox = async (inboxInput: IInboxInput) => {
  const inboxMessage = new Inbox(inboxInput);
  return await inboxMessage.save();
};

export const getInboxMessages = async (sessionId: string) => {
  return Inbox.find({ sessionId });
};

export const getInboxMessage = async (id: string) => {
  return Inbox.findById(id);
};

