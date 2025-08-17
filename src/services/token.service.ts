/// file_path: src/services/token.service.ts
import jwt from 'jsonwebtoken';
import { Company } from '../models/Company';
import { User, IUser } from '../models/User';
import { decryptData } from './encryption.service';
import { AuthenticationError } from '../utils/errors';

export const verifyToken = async (
  token: string,
): Promise<{ user: IUser; company: any; decryptedApiKey: string }> => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
      userId: string;
      email: string;
      companyId: string;
    };

    const user = await User.findById(decoded.userId);
    if (!user) {
      throw new AuthenticationError('User not found');
    }

    const company = await Company.findById(decoded.companyId);
    if (!company) {
      throw new AuthenticationError('Company not found');
    }

    let decryptedApiKey = 'not set';
    const apiKey = company.api_keys.find((key) => key.key === 'openai_api_key');
    if (apiKey) {
      decryptedApiKey = decryptData({
        value: apiKey.value,
        iv: apiKey.iv,
        tag: apiKey.tag,
      });
    }

    return { user, company, decryptedApiKey };
  } catch (error) {
    // Check if it's a JWT-specific error
    if (error instanceof jwt.TokenExpiredError) {
      throw new AuthenticationError('Token expired');
    } else if (error instanceof jwt.JsonWebTokenError) {
      throw new AuthenticationError('Invalid token');
    } else if (error instanceof AuthenticationError) {
      // Re-throw AuthenticationErrors as-is
      throw error;
    }

    // For any other unexpected errors, log them but still throw as AuthenticationError
    console.error('Unexpected authentication error:', (error as Error).message);
    throw new AuthenticationError('Authentication failed');
  }
};

export const extractTokenFromHeader = (
  authHeader: string | undefined,
): string => {
  if (!authHeader) {
    throw new AuthenticationError('No authorization header provided');
  }
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    throw new AuthenticationError('Invalid authorization header format');
  }
  return parts[1];
};
