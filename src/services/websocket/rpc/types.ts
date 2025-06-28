import { AuthenticatedSocket } from '../types';

export type JsonRpcVersion = '2.0';

export type JsonRpcRequest = {
  jsonrpc: JsonRpcVersion;
  method: string;
  params?: any;
  id: string;
};

export type JsonRpcSuccessResponse = {
  jsonrpc: JsonRpcVersion;
  result: any;
  id: string;
};

export type JsonRpcErrorCode =
  | -32700 // Parse error
  | -32600 // Invalid request
  | -32601 // Method not found
  | -32602 // Invalid params
  | -32603 // Internal error
  | -32000; // Server error

export type JsonRpcError = {
  code: JsonRpcErrorCode;
  message: string;
  data?: any;
};

export type JsonRpcErrorResponse = {
  jsonrpc: JsonRpcVersion;
  error: JsonRpcError;
  id: string;
};

export type JsonRpcResponse = JsonRpcSuccessResponse | JsonRpcErrorResponse;

export type JsonRpcMessage = JsonRpcRequest | JsonRpcResponse;

export type PendingRequest = {
  resolve: (result: any) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
};

export const RPC_ERROR_CODES = {
  PARSE_ERROR: -32700 as const,
  INVALID_REQUEST: -32600 as const,
  METHOD_NOT_FOUND: -32601 as const,
  INVALID_PARAMS: -32602 as const,
  INTERNAL_ERROR: -32603 as const,
  TIMEOUT_ERROR: -32000 as const,
};

export type RpcOptions = {
  timeout?: number;
};

export type RpcHandler = (
  socket: AuthenticatedSocket,
  params: any,
) => Promise<any>;

export type RpcMethodRegistry = Map<string, RpcHandler>;
