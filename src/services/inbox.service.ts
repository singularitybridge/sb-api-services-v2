import moment from 'moment';
import { IInbox, Inbox } from '../models/Inbox';
import { Session } from '../models/Session';
import { User } from '../models/User';

interface IInboxInput {
  message: string;
  sessionId: string;
}

export const addMessageToInbox = async (inboxInput: IInboxInput) => {
  const inboxMessage = new Inbox(inboxInput);
  return await inboxMessage.save();
};

export const getInboxMessages = async (companyId: string) => {

  const sessions = await Session.find({ companyId });
  const sessionIds = sessions.map(session => session._id.toString());
  const messages = await Inbox.find({ sessionId: { $in: sessionIds } });

  const inboxMessages = await Promise.all(messages.map(async (message) => {
    const session = await Session.findById(message.sessionId);
    const user = await User.findById(session?.userId);

    return {
      _id: message._id,
      message: message.message,
      createdAt: moment(message.created).fromNow(),
      userName: user?.name,
    };
  }));

  return inboxMessages;
};

export const getInboxMessage = async (id: string) => {
  return Inbox.findById(id);
};
