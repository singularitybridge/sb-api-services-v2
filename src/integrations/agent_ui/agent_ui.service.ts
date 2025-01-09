import { getApiKey } from '../../services/api.key.service';
import { callRpcMethod } from '../../services/websocket/rpc/utils';
import { AuthenticatedSocket } from '../../services/websocket/types';
import { UIConnection } from '../../models/UIConnection';

// Store socket instances by socketId for quick lookup
// This is still in-memory but only used after we verify connection state in MongoDB
const socketMap = new Map<string, AuthenticatedSocket>();

export const registerSocket = async (companyId: string, socket: AuthenticatedSocket): Promise<void> => {
  // Store socket instance in memory map
  socketMap.set(socket.id, socket);
  
  // Update connection state in MongoDB
  await UIConnection.findOneAndUpdate(
    { companyId },
    { 
      $set: { 
        isUiConnected: true, 
        socketId: socket.id,
        lastConnectedAt: new Date() 
      } 
    },
    { upsert: true, new: true }
  );
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
    { $set: { isUiConnected: false } }
  );
};

export const getUiContext = async (
  companyId: string
): Promise<{ success: boolean; data?: any; error?: string }> => {
  // Check connection state in MongoDB
  const connection = await UIConnection.findOne({ companyId });
  if (!connection || !connection.isUiConnected) {
    return {
      success: false,
      error: 'No active UI connection found for company',
      data: null
    };
  }

  // Get socket instance from memory
  const socket = connection.socketId ? socketMap.get(connection.socketId) : undefined;
  if (!socket) {
    // Socket instance not found - update MongoDB to reflect disconnected state
    await UIConnection.findOneAndUpdate(
      { companyId },
      { $set: { isUiConnected: false } }
    );
    return {
      success: false,
      error: 'UI connection lost',
      data: null
    };
  }

  try {
    const result = await callRpcMethod(socket, 'getUiContext', {});
    return {
      success: true,
      data: result
    };
  } catch (error) {
    console.error('Error getting UI context:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      data: null
    };
  }
};

interface ExecuteUiMethodParams {
  method: string;
  pageId: string;
  params: Record<string, any>;
}

interface ExecuteUiMethodResult {
  success: boolean;
  data?: any;
  error?: string;
}

export const executeUiMethod = async (
  companyId: string,
  params: ExecuteUiMethodParams
): Promise<ExecuteUiMethodResult> => {
  // Check connection state in MongoDB
  const connection = await UIConnection.findOne({ companyId });
  if (!connection || !connection.isUiConnected) {
    return {
      success: false,
      error: 'No active UI connection found for company'
    };
  }

  // Get socket instance from memory
  const socket = connection.socketId ? socketMap.get(connection.socketId) : undefined;
  if (!socket) {
    // Socket instance not found - update MongoDB to reflect disconnected state
    await UIConnection.findOneAndUpdate(
      { companyId },
      { $set: { isUiConnected: false } }
    );
    return {
      success: false,
      error: 'UI connection lost'
    };
  }

  try {
    const result = await callRpcMethod(socket, params.method, {
      pageId: params.pageId,
      params: params.params
    });
    return {
      success: true,
      data: result
    };
  } catch (error) {
    console.error('Error executing UI method:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
};
