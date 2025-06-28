// src/middleware/auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { extractTokenFromHeader, verifyToken } from '../services/token.service';
import { Company } from '../models/Company';
import { IUser } from '../models/User';
import { logger } from '../utils/logger';
import { ApiKeyService } from '../services/apiKey.service';

export interface AuthenticatedRequest extends Request {
  user?: IUser;
  company?: any;
}

export const verifyTokenMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const authHeader = req.headers.authorization;

    // Check if it's an API key (starts with 'Bearer sk_live_')
    if (authHeader && authHeader.startsWith('Bearer sk_live_')) {
      const apiKey = authHeader.substring(7); // Remove 'Bearer ' prefix
      const result = await ApiKeyService.validateApiKey(apiKey);

      if (!result) {
        throw new Error('Invalid or expired API key');
      }

      req.user = result.user;
      req.company = result.company;

      // Add API key metadata to request for logging/rate limiting
      (req as any).apiKeyId = result.apiKeyDoc._id;
      (req as any).isApiKeyAuth = true;

      return next();
    }

    // Otherwise, it's a JWT token
    const token = extractTokenFromHeader(authHeader);
    const { user, company } = await verifyToken(token);

    if (!company || !company._id) {
      throw new Error('Company or Company ID is missing');
    }

    req.user = user;
    req.company = company;
    (req as any).isApiKeyAuth = false;

    next();
  } catch (error: any) {
    logger.error('Error verifying authentication', {
      error: error.message,
      stack: error.stack,
    });
    res
      .status(401)
      .json({ message: 'Authentication failed: ' + error.message });
  }
};

export const verifyAccess = (adminOnly: boolean = false) => {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (adminOnly && req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Access denied: Admin only' });
    }

    if (req.user.role === 'Admin') {
      // If it's an admin and a specific companyId is provided in the request, switch context
      const requestedCompanyId = req.params.companyId || req.body.companyId;
      if (requestedCompanyId) {
        const company = await Company.findById(requestedCompanyId);
        if (!company) {
          return res.status(404).json({ message: 'Company not found' });
        }
        req.user.companyId = requestedCompanyId;
        req.company = company;
      }
    } else {
      // For CompanyUsers, ensure they can only access their own company's data
      const requestedCompanyId = req.params.companyId || req.body.companyId;
      if (
        requestedCompanyId &&
        requestedCompanyId !== req.user.companyId.toString()
      ) {
        return res
          .status(403)
          .json({ message: 'Access denied: Company mismatch' });
      }
    }

    next();
  };
};

export const verifyCompanyAccess = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  if (
    req.user?.role !== 'Admin' &&
    req.user?.companyId.toString() !== req.params.id
  ) {
    return res.status(403).json({ message: 'Access denied: Company mismatch' });
  }
  next();
};
