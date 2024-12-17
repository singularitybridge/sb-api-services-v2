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
): Promise<{ success: boolean; data?: any; error?: string }> => {
  const socket = companySocketMap.get(companyId);
  if (!socket) {
    return {
      success: false,
      error: 'No active UI connection found for company',
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
  const socket = companySocketMap.get(companyId);
  if (!socket) {
    return {
      success: false,
      error: 'No active UI connection found for company'
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
