import { Server as SocketServer } from 'socket.io';
import { Server } from 'http';
import { AuthenticatedSocket } from './types';
import { websocketConfig } from './config';
import { setupSocketAuth } from './handlers/authHandler';
import { handleMessage } from './handlers/messageHandler';
import {
  registerSocket,
  unregisterSocket,
} from '../../integrations/agent_hub_ui_context/agent_hub_ui_context.service';

// Import RPC methods
import './rpc/methods';

const setupEventHandlers = (io: SocketServer): void => {
  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log(`Client connected: ${socket.id}`);
    console.log(`Socket decodedToken:`, socket.decodedToken);

    // Register socket for UI RPC communication if company ID is available
    if (socket.decodedToken?.companyId) {
      console.log(
        `Registering socket for company: ${socket.decodedToken.companyId}`,
      );
      registerSocket(socket.decodedToken.companyId, socket);
    } else {
      console.warn(
        `Socket ${socket.id} missing decodedToken or companyId - socket NOT registered`,
      );
    }

    socket.on('message', async (rawMessage: string) => {
      try {
        const message = JSON.parse(rawMessage);
        await handleMessage(socket, message);
      } catch (error) {
        socket.emit(
          'message',
          JSON.stringify({
            requestId: 'system',
            type: 'ERROR',
            error: {
              code: 'INVALID_MESSAGE',
              message: 'Invalid message format',
            },
          }),
        );
      }
    });

    // Handle UI state updates from frontend
    socket.on('ui-state-update', async (payload: any) => {
      try {
        const { userId } = socket.decodedToken!;

        // Update UI state in service
        const { uiSessionStateService } = await import(
          '../ui-session-state.service'
        );
        uiSessionStateService.updateUIState(userId, {
          sessionId: payload.sessionId,
          currentRoute: payload.currentRoute,
          assistantId: payload.assistantId,
          openWorkspaceDocument: payload.openWorkspaceDocument,
          uiContext: payload.uiContext,
        });

        console.log(`UI state updated for user ${userId}`, {
          route: payload.currentRoute,
          sessionId: payload.sessionId,
        });
      } catch (error) {
        console.error('Error handling UI state update:', error);
      }
    });

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
      // Unregister socket when client disconnects
      if (socket.decodedToken?.companyId) {
        unregisterSocket(socket.decodedToken.companyId);
      }
    });

    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  });
};

export const initializeWebSocket = (server: Server): SocketServer => {
  const io = new SocketServer(server, websocketConfig);

  io.use(setupSocketAuth);
  setupEventHandlers(io);

  return io;
};
