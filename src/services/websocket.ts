/**
 * WebSocket Service - Phase 2 UI State Query System
 *
 * Provides bidirectional real-time communication between backend and frontend
 * for UI state updates and UI control commands.
 */

import { Server, Socket } from 'socket.io';
import http from 'http';
import { logger } from '../utils/logger';
import { verifyToken } from './token.service';
import { IUser } from '../models/User';

let io: Server | null = null;

/**
 * Extended Socket interface with authenticated user data
 */
interface AuthenticatedSocket extends Socket {
  userId: string;
  user: IUser;
  companyId: string;
}

/**
 * WebSocket authentication middleware
 * Verifies JWT token and attaches user data to socket
 */
async function authenticateSocket(
  socket: Socket,
  next: (err?: Error) => void,
): Promise<void> {
  try {
    const token = socket.handshake.auth.token;

    if (!token) {
      logger.warn(`WebSocket connection rejected: No token provided`);
      return next(new Error('Authentication token required'));
    }

    // Verify JWT token using existing token service
    const { user, company } = await verifyToken(token);

    if (!user || !company) {
      logger.warn(`WebSocket connection rejected: Invalid token`);
      return next(new Error('Invalid authentication token'));
    }

    // Attach user data to socket
    const authSocket = socket as AuthenticatedSocket;
    authSocket.userId = user._id.toString();
    authSocket.user = user;
    authSocket.companyId = company._id.toString();

    logger.info(
      `WebSocket authenticated: user=${authSocket.userId}, company=${authSocket.companyId}`,
    );
    next();
  } catch (error) {
    logger.error('WebSocket authentication error:', error);
    next(new Error('Authentication failed'));
  }
}

/**
 * Initialize WebSocket server on existing HTTP server
 */
export function initializeWebSocket(server: http.Server): Server {
  logger.info('Initializing WebSocket server...');

  // Create Socket.io server with CORS configuration
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    path: '/socket.io',
    transports: ['websocket', 'polling'],
  });

  // Apply authentication middleware
  io.use(authenticateSocket);

  // Connection handler (only called after successful authentication)
  io.on('connection', async (socket: Socket) => {
    const authSocket = socket as AuthenticatedSocket;

    logger.info(
      `WebSocket client connected: ${socket.id} (user: ${authSocket.userId})`,
    );

    // Join user-specific room for targeted messages
    socket.join(`user:${authSocket.userId}`);

    // Register socket for UI RPC communication
    try {
      const { registerSocket } = await import(
        '../integrations/agent_hub_ui_context/agent_hub_ui_context.service'
      );
      await registerSocket(authSocket.companyId, authSocket);
      logger.info(
        `Socket registered for UI RPC: company=${authSocket.companyId}`,
      );
    } catch (error) {
      logger.error('Failed to register socket for UI RPC:', error);
    }

    // Handle JSON-RPC messages (requests and responses)
    socket.on('message', async (rawMessage: string) => {
      try {
        const message = JSON.parse(rawMessage);
        const {
          isJsonRpcRequest,
          isJsonRpcResponse,
          handleRpcRequest,
          handleRpcResponse,
        } = await import('./websocket/rpc/utils');

        // Handle JSON-RPC response (from frontend to backend)
        if (isJsonRpcResponse(message)) {
          logger.debug(`WebSocket: Received JSON-RPC response`, {
            id: message.id,
            hasError: 'error' in message,
          });
          handleRpcResponse(message);
        }
        // Handle JSON-RPC request (from frontend to backend)
        else if (isJsonRpcRequest(message)) {
          logger.debug(`WebSocket: Received JSON-RPC request`, {
            method: message.method,
            id: message.id,
          });
          await handleRpcRequest(authSocket, message);
        } else {
          logger.warn('WebSocket: Received invalid JSON-RPC message', message);
        }
      } catch (error) {
        logger.error('WebSocket: Error parsing message', error);
      }
    });

    // Handle UI state updates from frontend
    socket.on('ui-state-update', async (payload: any) => {
      try {
        const { uiSessionStateService } = await import(
          '../services/ui-session-state.service'
        );
        uiSessionStateService.updateUIState(authSocket.userId, {
          sessionId: payload.sessionId,
          currentRoute: payload.currentRoute,
          assistantId: payload.assistantId,
          openWorkspaceDocument: payload.openWorkspaceDocument,
          uiContext: payload.uiContext,
        });

        logger.debug(`UI state updated for user ${authSocket.userId}`, {
          route: payload.currentRoute,
          sessionId: payload.sessionId,
        });
      } catch (error) {
        logger.error('Error handling UI state update:', error);
      }
    });

    // Handle disconnection
    socket.on('disconnect', async (reason) => {
      logger.info(
        `WebSocket client disconnected: ${socket.id} (user: ${authSocket.userId}), reason: ${reason}`,
      );

      // Unregister socket
      try {
        const { unregisterSocket } = await import(
          '../integrations/agent_hub_ui_context/agent_hub_ui_context.service'
        );
        await unregisterSocket(authSocket.companyId);
        logger.info(
          `Socket unregistered for UI RPC: company=${authSocket.companyId}`,
        );
      } catch (error) {
        logger.error('Failed to unregister socket for UI RPC:', error);
      }
    });

    // Handle errors
    socket.on('error', (error) => {
      logger.error(
        `WebSocket error for client ${socket.id} (user: ${authSocket.userId}):`,
        error,
      );
    });
  });

  logger.info('WebSocket server initialized successfully with authentication');
  return io;
}

/**
 * Get the Socket.io server instance
 */
export function getSocketServer(): Server {
  if (!io) {
    throw new Error(
      'WebSocket server not initialized. Call initializeWebSocket first.',
    );
  }
  return io;
}

/**
 * Emit event to specific user
 */
export function emitToUser(userId: string, event: string, data: any): void {
  if (!io) {
    logger.warn('Cannot emit to user: WebSocket server not initialized');
    return;
  }

  io.to(`user:${userId}`).emit(event, data);
  logger.debug(`Emitted ${event} to user:${userId}`);
}

/**
 * Emit event to all connected clients
 */
export function emitToAll(event: string, data: any): void {
  if (!io) {
    logger.warn('Cannot emit to all: WebSocket server not initialized');
    return;
  }

  io.emit(event, data);
  logger.debug(`Emitted ${event} to all clients`);
}
