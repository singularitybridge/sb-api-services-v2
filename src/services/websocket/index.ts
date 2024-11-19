import { Server as SocketServer } from 'socket.io';
import { Server } from 'http';
import { AuthenticatedSocket } from './types';
import { websocketConfig } from './config';
import { setupSocketAuth } from './handlers/authHandler';
import { handleMessage } from './handlers/messageHandler';

const setupEventHandlers = (io: SocketServer): void => {
  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log(`Client connected: ${socket.id}`);

    socket.on('message', async (rawMessage: string) => {
      try {
        const message = JSON.parse(rawMessage);
        await handleMessage(socket, message);
      } catch (error) {
        socket.emit('message', JSON.stringify({
          requestId: 'system',
          type: 'ERROR',
          error: {
            code: 'INVALID_MESSAGE',
            message: 'Invalid message format'
          }
        }));
      }
    });

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
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
