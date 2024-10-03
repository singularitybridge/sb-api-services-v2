import { Message } from '../../models/Message';
import { publishSessionMessage } from '../../services/pusher.service';
import { ExecutionDetails } from './types';

export const publishActionMessage = async (
  sessionId: string,
  status: 'started' | 'completed' | 'failed',
  executionDetails: ExecutionDetails
): Promise<void> => {
  const messageData = {
    id: executionDetails.id,
    actionId: executionDetails.actionId,
    serviceName: executionDetails.serviceName,
    actionTitle: executionDetails.actionTitle,
    actionDescription: executionDetails.actionDescription,
    icon: executionDetails.icon,
    originalActionId: executionDetails.originalActionId,
    language: executionDetails.language,
    status
  };

  const message = await Message.findOneAndUpdate(
    { sessionId, 'data.id': executionDetails.id },
    {
      $set: {
        sessionId,
        sender: 'system',
        messageType: 'action_execution',
        data: messageData,
        timestamp: new Date()
      }
    },
    { upsert: true, new: true }
  );

  // Publish a message to the client with all required fields
  await publishSessionMessage(sessionId, 'action_execution_update', {
    messageId: message._id.toString(),
    actionId: messageData.actionId,
    serviceName: messageData.serviceName,
    actionTitle: messageData.actionTitle,
    actionDescription: messageData.actionDescription,
    icon: messageData.icon,
    originalActionId: messageData.originalActionId,
    language: messageData.language,
    status: messageData.status
  });
};