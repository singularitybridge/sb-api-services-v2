// src/middleware/auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { extractTokenFromHeader, verifyToken } from '../services/token.service';
import { Company } from '../models/Company';
import { IUser } from '../models/User';

export interface AuthenticatedRequest extends Request {
  user?: IUser;
  company?: any;
}

export const verifyTokenMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = extractTokenFromHeader(req.headers.authorization);
    const { user, company } = await verifyToken(token);

    req.user = user;
    req.company = company;

    next();
  } catch (error) {
    console.error('Error verifying token:', error);
    res.status(401).json({ message: 'Authentication token is required or invalid' });
  }
};



export const verifyAccess = (adminOnly: boolean = false) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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
      if (requestedCompanyId && requestedCompanyId !== req.user.companyId.toString()) {
        return res.status(403).json({ message: 'Access denied: Company mismatch' });
      }
    }

    next();
  };
};


export const verifyCompanyAccess = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'Admin' && req.user?.companyId.toString() !== req.params.id) {
    return res.status(403).json({ message: 'Access denied: Company mismatch' });
  }
  next();
};