import { Socket } from 'socket.io';
import { AuthenticatedSocket } from '../types';
import {
  isJsonRpcRequest,
  isJsonRpcResponse,
  handleRpcRequest,
  handleRpcResponse,
} from '../rpc/utils';
import { RPC_ERROR_CODES, JsonRpcErrorResponse } from '../rpc/types';

export const sendMessage = (
  socket: Socket,
  message: JsonRpcErrorResponse | string,
): void => {
  socket.emit(
    'message',
    typeof message === 'string' ? message : JSON.stringify(message),
  );
};

export const handleMessage = async (
  socket: AuthenticatedSocket,
  message: any,
): Promise<void> => {
  // Handle JSON-RPC messages
  if (typeof message === 'object' && message.jsonrpc === '2.0') {
    if (isJsonRpcRequest(message)) {
      await handleRpcRequest(socket, message);
      return;
    }

    if (isJsonRpcResponse(message)) {
      handleRpcResponse(message);
      return;
    }

    // Invalid RPC message
    const errorResponse: JsonRpcErrorResponse = {
      jsonrpc: '2.0',
      error: {
        code: RPC_ERROR_CODES.INVALID_REQUEST,
        message: 'Invalid Request',
      },
      id: (message?.id || 'unknown').toString(),
    };
    sendMessage(socket, errorResponse);
    return;
  }

  // Invalid message format
  sendMessage(socket, {
    jsonrpc: '2.0',
    error: {
      code: RPC_ERROR_CODES.INVALID_REQUEST,
      message: 'Invalid message format - expected JSON-RPC 2.0',
    },
    id: 'unknown',
  });
};
