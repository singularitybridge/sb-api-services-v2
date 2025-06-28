import {
  addMessageToInbox,
  getInboxMessages as fetchInboxMessages,
  updateInboxMessageStatus as updateStatus,
} from '../../services/inbox.service';

export const sendMessageToInbox = async (
  sessionId: string,
  companyId: string,
  params: {
    message: string;
    type?: 'human_agent_request' | 'human_agent_response' | 'notification';
  },
): Promise<{ success: boolean; data?: any; error?: string }> => {
  try {
    await addMessageToInbox({
      sessionId,
      message: params.message,
      type: params.type || 'human_agent_request',
      companyId,
    });
    console.log(
      `Message sent to inbox: ${params.message}, sessionId: ${sessionId}, companyId: ${companyId}`,
    );
    return { success: true, data: 'Message sent to inbox successfully' };
  } catch (error: any) {
    console.error('Error sending message to inbox:', error);
    if (error.name === 'CastError' && error.path === '_id') {
      return {
        success: false,
        error: 'Invalid session ID or company ID. Please contact support.',
      };
    }
    return { success: false, error: 'Failed to send message to inbox' };
  }
};

export const getInboxMessages = async (
  companyId: string,
): Promise<{ success: boolean; data?: any; error?: string }> => {
  try {
    const messages = await fetchInboxMessages(companyId);
    return { success: true, data: messages };
  } catch (error) {
    console.error('Error retrieving inbox messages:', error);
    return { success: false, error: 'Failed to retrieve inbox messages' };
  }
};

export const updateInboxMessageStatus = async (
  messageId: string,
  status: 'open' | 'in_progress' | 'closed',
): Promise<{ success: boolean; data?: any; error?: string }> => {
  try {
    const updatedMessage = await updateStatus(messageId, status);
    if (updatedMessage) {
      return { success: true, data: updatedMessage };
    } else {
      return { success: false, error: 'Inbox message not found' };
    }
  } catch (error) {
    console.error('Error updating inbox message status:', error);
    return { success: false, error: 'Failed to update inbox message status' };
  }
};
