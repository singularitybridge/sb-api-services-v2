// file path: /src/routes/company.routes.ts
import express from 'express';
import {
  createCompany,
  getCompany,
  updateCompany,
} from '../services/company.service';
import {
  verifyAccess,
  AuthenticatedRequest,
} from '../middleware/auth.middleware';

const companyRouter = express.Router();

// Admin-only routes
companyRouter.post(
  '/',
  verifyAccess(true),
  async (req: AuthenticatedRequest, res) => {
    const company = await createCompany(req.body);
    res.json(company);
  },
);

companyRouter.get(
  '/',
  verifyAccess(),
  async (req: AuthenticatedRequest, res) => {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res
        .status(400)
        .json({ message: 'Company ID not found in user session' });
    }
    const company = await getCompany(companyId.toString());
    res.json(company);
  },
);

companyRouter.delete(
  '/:id',
  verifyAccess(true),
  async (req: AuthenticatedRequest, res) => {
    return res.status(403).json({
      message:
        'Company deletion is disabled on this endpoint. Use Komissar admin tool for company deletion.',
    });
  },
);

companyRouter.put(
  '/',
  verifyAccess(),
  async (req: AuthenticatedRequest, res) => {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res
        .status(400)
        .json({ message: 'Company ID not found in user session' });
    }
    const company = await updateCompany(companyId.toString(), req.body);
    res.json(company);
  },
);

export { companyRouter };
