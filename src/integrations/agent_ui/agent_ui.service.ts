import { getApiKey } from '../../services/api.key.service';
import { callRpcMethod } from '../../services/websocket/rpc/utils';
import { AuthenticatedSocket } from '../../services/websocket/types';

// We'll need to store socket connections per company
const companySocketMap = new Map<string, AuthenticatedSocket>();

export const registerSocket = (companyId: string, socket: AuthenticatedSocket): void => {
  companySocketMap.set(companyId, socket);
};

export const unregisterSocket = (companyId: string): void => {
  companySocketMap.delete(companyId);
};

export const getUiContext = async (
  companyId: string
): Promise<any> => {
  const socket = companySocketMap.get(companyId);
  if (!socket) {
    throw new Error('No active UI connection found for company');
  }

  try {
    const result = await callRpcMethod(socket, 'getUiContext', {});
    return result;
  } catch (error) {
    console.error('Error getting UI context:', error);
    throw error;
  }
};

interface UpdateUiElementParams {
  type: string;
  id: string;
  data: any;
}

interface UpdateUiElementResult {
  success: boolean;
  data?: any;
  error?: string;
}

export const updateUiElement = async (
  companyId: string,
  params: UpdateUiElementParams
): Promise<UpdateUiElementResult> => {
  const socket = companySocketMap.get(companyId);
  if (!socket) {
    throw new Error('No active UI connection found for company');
  }

  try {
    const result = await callRpcMethod(socket, 'updateUiElement', params);
    return {
      success: true,
      data: result
    };
  } catch (error) {
    console.error('Error updating UI element:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
};
