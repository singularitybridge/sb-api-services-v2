/// file_path: src/middleware/auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { extractTokenFromHeader, verifyToken } from '../services/token.service';

export const verifyTokenMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const token = extractTokenFromHeader(req.headers.authorization);
    const { company, decryptedApiKey } = await verifyToken(token);

    console.log('Company found - company._id:', company._id);
    console.log('Auth.Middleware ---------Decrypted API Key:', decryptedApiKey);

    req.headers['openai-api-key'] = decryptedApiKey;

    next();
  } catch (error) {
    console.error('Error verifying token:', error);
    res.status(401).json({ message: 'Authentication token is required or invalid' });
  }
};