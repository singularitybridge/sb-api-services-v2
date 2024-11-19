import { Socket } from 'socket.io';
import { verifyToken } from '../../token.service';
import { AuthenticatedSocket } from '../types';

export const extractTokenFromHandshake = (socket: Socket): string => {
  const authHeader = socket.handshake.auth.token || socket.handshake.query.token;
  if (!authHeader) {
    throw new Error('No token provided');
  }
  
  return authHeader.startsWith('Bearer ') 
    ? authHeader.substring(7) 
    : authHeader;
};

export const setupSocketAuth = async (socket: AuthenticatedSocket, next: (err?: Error) => void) => {
  try {
    const token = extractTokenFromHandshake(socket);
    const { user, company } = await verifyToken(token);
    
    socket.decodedToken = {
      userId: user._id.toString(),
      companyId: company._id.toString()
    };
    
    // Join company-specific room
    socket.join(`company-${company._id}`);

    next();
  } catch (error) {
    console.error('WebSocket authentication error:', error);
    next(new Error('Authentication failed'));
  }
};
