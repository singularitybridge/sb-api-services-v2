/// file_path: src/services/token.service.ts
import jwt from 'jsonwebtoken';
import { Company } from '../models/Company';
import { User, IUser } from '../models/User';
import { decryptData } from './encryption.service';

export const verifyToken = async (token: string): Promise<{ user: IUser; company: any; decryptedApiKey: string }> => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { userId: string; email: string; companyId: string };

    const user = await User.findById(decoded.userId);
    if (!user) {
      throw new Error('User not found');
    }

    const company = await Company.findById(decoded.companyId);
    if (!company) {
      throw new Error('Company not found');
    }

    let decryptedApiKey = 'not set';
    const apiKey = company.api_keys.find(key => key.key === 'openai_api_key');
    if (apiKey) {
      decryptedApiKey = decryptData({ 'value': apiKey.value, 'iv': apiKey.iv, 'tag': apiKey.tag });
    }

    return { user, company, decryptedApiKey };
  } catch (error) {
    console.error('Detailed token verification error:', error);
    throw new Error('Invalid token');
  }
};

export const extractTokenFromHeader = (authHeader: string | undefined): string => {
  if (!authHeader) {
    throw new Error('No authorization header provided');
  }
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    throw new Error('Invalid authorization header format');
  }
  return parts[1];
};

