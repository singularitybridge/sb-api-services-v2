import { callRpcMethod } from '../../services/websocket/rpc/utils';
import { AuthenticatedSocket } from '../../services/websocket/types';
import { UIConnection } from '../../models/UIConnection';
import { Message } from '../../models/Message';
import { Session } from '../../models/Session';
import { publishSessionMessage } from '../../services/session-messaging.service';
import mongoose from 'mongoose';

// Store socket instances by socketId for quick lookup
// This is in-memory but only used after we verify connection state in MongoDB
const socketMap = new Map<string, AuthenticatedSocket>();

export const registerSocket = async (
  companyId: string,
  socket: AuthenticatedSocket,
): Promise<void> => {
  console.log(`[AgentHubUiContext] registerSocket called`, {
    companyId,
    socketId: socket.id,
  });

  // Store socket instance in memory map
  socketMap.set(socket.id, socket);
  console.log(`[AgentHubUiContext] Socket ${socket.id} added to memory map`);

  // Update connection state in MongoDB
  const result = await UIConnection.findOneAndUpdate(
    { companyId },
    {
      $set: {
        isUiConnected: true,
        socketId: socket.id,
        lastConnectedAt: new Date(),
      },
    },
    { upsert: true, new: true },
  );

  console.log(`[AgentHubUiContext] MongoDB UIConnection updated:`, {
    companyId,
    socketId: result.socketId,
    isUiConnected: result.isUiConnected,
  });
};

export const unregisterSocket = async (companyId: string): Promise<void> => {
  // Get connection to remove socket from memory
  const connection = await UIConnection.findOne({ companyId });
  if (connection?.socketId !== undefined) {
    socketMap.delete(connection.socketId);
  }

  // Mark UI as disconnected in MongoDB
  await UIConnection.findOneAndUpdate(
    { companyId },
    { $set: { isUiConnected: false } },
  );

  console.log(
    `[AgentHubUiContext] Unregistered socket for company: ${companyId}`,
  );
};

export const getUiContext = async (
  companyId: string,
): Promise<{ success: boolean; data?: any; error?: string }> => {
  // Check connection state in MongoDB
  const connection = await UIConnection.findOne({ companyId });
  if (!connection || !connection.isUiConnected) {
    return {
      success: false,
      error: 'No active UI connection found for company',
      data: null,
    };
  }

  // Get socket instance from memory
  const socket = connection.socketId
    ? socketMap.get(connection.socketId)
    : undefined;
  if (!socket) {
    // Socket instance not found - update MongoDB to reflect disconnected state
    await UIConnection.findOneAndUpdate(
      { companyId },
      { $set: { isUiConnected: false } },
    );
    return {
      success: false,
      error: 'UI connection lost',
      data: null,
    };
  }

  try {
    console.log(
      `[AgentHubUiContext] Getting UI context for company: ${companyId}`,
    );
    const result = await callRpcMethod(socket, 'getUiContext', {});
    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error('[AgentHubUiContext] Error getting UI context:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      data: null,
    };
  }
};

interface ExecuteUiActionParams {
  action: string;
  params: Record<string, any>;
}

interface ExecuteUiActionResult {
  success: boolean;
  data?: any;
  error?: string;
}

export const executeUiAction = async (
  companyId: string,
  actionParams: ExecuteUiActionParams,
): Promise<ExecuteUiActionResult> => {
  // Check connection state in MongoDB
  const connection = await UIConnection.findOne({ companyId });
  if (!connection || !connection.isUiConnected) {
    return {
      success: false,
      error: 'No active UI connection found for company',
    };
  }

  // Get socket instance from memory
  const socket = connection.socketId
    ? socketMap.get(connection.socketId)
    : undefined;
  if (!socket) {
    // Socket instance not found - update MongoDB to reflect disconnected state
    await UIConnection.findOneAndUpdate(
      { companyId },
      { $set: { isUiConnected: false } },
    );
    return {
      success: false,
      error: 'UI connection lost',
    };
  }

  try {
    console.log(
      `[AgentHubUiContext] Executing UI action for company: ${companyId}`,
      {
        action: actionParams.action,
        params: actionParams.params,
      },
    );

    // Special handling for pushMessageToChat - persist to DB and broadcast via Pusher
    if (actionParams.action === 'pushMessageToChat') {
      console.log(
        '[AgentHubUiContext] Handling pushMessageToChat with persistence',
      );

      // 1. Get UI context to find sessionId
      const uiContextResult = await getUiContext(companyId);
      if (!uiContextResult.success || !uiContextResult.data?.sessionId) {
        console.warn(
          '[AgentHubUiContext] No active session found, skipping persistence',
        );
      } else {
        const sessionId = uiContextResult.data.sessionId;

        try {
          // 2. Get session and validate
          const session = await Session.findById(sessionId);
          if (!session) {
            console.warn(
              `[AgentHubUiContext] Session ${sessionId} not found, skipping persistence`,
            );
          } else {
            // 3. Extract message data from params
            const {
              content,
              role = 'assistant',
              metadata,
            } = actionParams.params;

            // 4. Create Message document
            const message = new Message({
              sessionId: new mongoose.Types.ObjectId(sessionId),
              sender: role === 'user' ? 'user' : 'assistant',
              content,
              assistantId: session.assistantId,
              userId: session.userId,
              timestamp: new Date(),
              messageType: 'text',
              data: metadata || {},
            });

            // 5. Save to MongoDB
            await message.save();
            console.log('[AgentHubUiContext] Message saved to database:', {
              messageId: message._id,
              sessionId,
              sender: message.sender,
            });

            // 6. Broadcast via Pusher
            const pusherMessage = {
              id: message._id.toString(),
              sender: message.sender,
              content: message.content,
              timestamp: message.timestamp,
              messageType: message.messageType,
              data: message.data,
            };

            await publishSessionMessage(
              sessionId,
              'chat_message',
              pusherMessage,
            );
            console.log('[AgentHubUiContext] Message broadcast via Pusher');
          }
        } catch (persistError) {
          // Log but don't fail - immediate RPC update will still work
          console.error(
            '[AgentHubUiContext] Error persisting message:',
            persistError,
          );
        }
      }
    }

    // 7. Always call RPC for immediate frontend update
    const result = await callRpcMethod(
      socket,
      actionParams.action,
      actionParams.params,
    );
    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error('[AgentHubUiContext] Error executing UI action:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
};
