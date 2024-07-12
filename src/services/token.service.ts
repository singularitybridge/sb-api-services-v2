/// file_path: src/services/token.service.ts
import jwt from 'jsonwebtoken';
import { Company } from '../models/Company';
import { User } from '../models/User';
import { decryptData } from './encryption.service';

interface DecodedToken {
  userId: string;
  email: string;
  companyId: string;
}

export const verifyToken = async (token: string): Promise<{ user: any; company: any; decryptedApiKey?: string }> => {
  try {
    console.log('Attempting to verify token:', token);
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as DecodedToken;
    console.log('Decoded token:', decoded);

    const user = await User.findById(decoded.userId);
    if (!user) {
      throw new Error('User not found');
    }

    const company = await Company.findById(decoded.companyId);
    if (!company) {
      throw new Error('Company not found');
    }

    const apiKey = company.api_keys.find(key => key.key === 'openai_api_key');
    let decryptedApiKey: string | undefined;

    if (apiKey) {
      decryptedApiKey = decryptData({ 'value': apiKey.value, 'iv': apiKey.iv, 'tag': apiKey.tag });
    } else {
      console.log('API key not found for company:', company._id);
    }

    return {
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      company: {
        _id: company._id,
        name: company.name,
      },
      decryptedApiKey
    };
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
