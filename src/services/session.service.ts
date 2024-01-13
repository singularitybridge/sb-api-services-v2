import { Assistant } from '../models/Assistant';
import { Session } from '../models/Session';
import { createNewThread } from './oai.thread.service';

export const getSessionOrCreate = async (
    userId: string,
    companyId: string,
    assistantId?: string, // Made optional
  ) => {
    let session = await Session.findOne({ userId, companyId, active: true });
  
    if (session) {
      if (assistantId && session.assistantId !== assistantId) {
        session.assistantId = assistantId;
        await session.save();
      }
    } else {
      const threadId = await createNewThread();
  
      // If assistantId is not provided, find a default assistant for the company
      if (!assistantId) {
        console.log('No assistantId provided, finding default assistant', { companyId });
        const defaultAssistant = await Assistant.findOne({ companyId });
        assistantId = defaultAssistant?._id;
      }
  
      // If an assistantId (either provided or default) is available, create the session
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
        // Handle the case where no assistantId is available
        throw new Error('No assistantId available to create a session');
      }
    }
  
    return session;
  };
  
