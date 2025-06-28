import { v4 as uuidv4 } from 'uuid';
import { AuthenticatedSocket } from '../types';
import {
  JsonRpcRequest,
  JsonRpcResponse,
  PendingRequest,
  RPC_ERROR_CODES,
  RpcOptions,
  RpcHandler,
  RpcMethodRegistry,
  JsonRpcErrorCode,
} from './types';

const DEFAULT_TIMEOUT = 30000; // 30 seconds
const pendingRequests = new Map<string, PendingRequest>();
const methodRegistry = new Map<string, RpcHandler>();

const createJsonRpcRequest = (
  method: string,
  params?: any,
): JsonRpcRequest => ({
  jsonrpc: '2.0',
  method,
  params,
  id: uuidv4(),
});

const createJsonRpcErrorResponse = (
  id: string,
  code: JsonRpcErrorCode,
  message: string,
): JsonRpcResponse => ({
  jsonrpc: '2.0',
  error: { code, message },
  id,
});

const createJsonRpcSuccessResponse = (
  id: string,
  result: any,
): JsonRpcResponse => ({
  jsonrpc: '2.0',
  result,
  id,
});

export const registerRpcMethod = (
  method: string,
  handler: RpcHandler,
): void => {
  methodRegistry.set(method, handler);
};

export const getRpcMethodRegistry = (): RpcMethodRegistry => methodRegistry;

export const callRpcMethod = async (
  socket: AuthenticatedSocket,
  method: string,
  params?: any,
  options: RpcOptions = {},
): Promise<any> => {
  const request = createJsonRpcRequest(method, params);

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingRequests.delete(request.id);
      reject(
        new Error(
          `RPC call to ${method} timed out after ${
            options.timeout || DEFAULT_TIMEOUT
          }ms`,
        ),
      );
    }, options.timeout || DEFAULT_TIMEOUT);

    pendingRequests.set(request.id, { resolve, reject, timeout });

    socket.emit('message', JSON.stringify(request));
  });
};

export const handleRpcResponse = (response: JsonRpcResponse): void => {
  const pending = pendingRequests.get(response.id);
  if (!pending) {
    console.warn(`Received RPC response for unknown id: ${response.id}`);
    return;
  }

  clearTimeout(pending.timeout);
  pendingRequests.delete(response.id);

  if ('error' in response) {
    const error = new Error(response.error.message);
    (error as any).code = response.error.code;
    pending.reject(error);
  } else {
    pending.resolve(response.result);
  }
};

export const handleRpcRequest = async (
  socket: AuthenticatedSocket,
  request: JsonRpcRequest,
): Promise<void> => {
  try {
    const handler = methodRegistry.get(request.method);
    if (!handler) {
      socket.emit(
        'message',
        JSON.stringify(
          createJsonRpcErrorResponse(
            request.id,
            RPC_ERROR_CODES.METHOD_NOT_FOUND,
            `Method ${request.method} not found`,
          ),
        ),
      );
      return;
    }

    const result = await handler(socket, request.params);
    socket.emit(
      'message',
      JSON.stringify(createJsonRpcSuccessResponse(request.id, result)),
    );
  } catch (error) {
    socket.emit(
      'message',
      JSON.stringify(
        createJsonRpcErrorResponse(
          request.id,
          RPC_ERROR_CODES.INTERNAL_ERROR,
          error instanceof Error ? error.message : 'Internal error',
        ),
      ),
    );
  }
};

export const isJsonRpcRequest = (message: any): message is JsonRpcRequest => {
  return (
    message &&
    message.jsonrpc === '2.0' &&
    typeof message.method === 'string' &&
    typeof message.id === 'string'
  );
};

export const isJsonRpcResponse = (message: any): message is JsonRpcResponse => {
  return (
    message &&
    message.jsonrpc === '2.0' &&
    typeof message.id === 'string' &&
    ('result' in message || 'error' in message)
  );
};
