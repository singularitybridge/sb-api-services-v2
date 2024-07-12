/// file_path: src/services/token.service.ts
import jwt from 'jsonwebtoken';
import { Company } from '../models/Company';
import { decryptData } from './encryption.service';

export const verifyToken = async (token: string): Promise<{ company: any; decryptedApiKey: string }> => {
  try {
    console.log('Attempting to verify token:', token); // Log the token being verified
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { companyId: string };
    console.log('Decoded token:', decoded); // Log the decoded token

    const company = await Company.findById(decoded.companyId);
    if (!company) {
      throw new Error('Company not found');
    }

    const apiKey = company.api_keys[0] as any;
    const decryptedApiKey = decryptData({ 'value': apiKey.value, 'iv': apiKey.iv, 'tag': apiKey.tag });

    return {
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