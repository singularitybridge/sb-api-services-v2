// file path: /src/routes/company.routes.ts
import express from 'express';
import {
  createCompany,
  deleteCompany,
  getCompanies,
  getCompany,
  getDecryptedCompany,
  refreshCompanyToken,
  updateCompany,
} from '../services/company.service';
import { verifyAccess, AuthenticatedRequest, verifyCompanyAccess } from '../middleware/auth.middleware';
import { Types } from 'mongoose';

const companyRouter = express.Router();

// Admin-only routes
companyRouter.post('/', verifyAccess(true), async (req: AuthenticatedRequest, res) => {
  const company = await createCompany(req.body);
  res.json(company);
});

companyRouter.get('/', verifyAccess(), async (req: AuthenticatedRequest, res) => {
  try {
    const companyId = req.user?.role === 'Admin' ? null : req.user?.companyId;
    const companies = await getCompanies(
      companyId ? new Types.ObjectId(companyId) : null
    );
    res.json(companies);
  } catch (error) {
    console.error('Error retrieving companies:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


companyRouter.delete('/:id', verifyAccess(true), async (req: AuthenticatedRequest, res) => {
  const company = await deleteCompany(req.params.id);
  res.json(company);
});

// Routes accessible by both admins and company users
companyRouter.get('/:id', verifyAccess(), verifyCompanyAccess, async (req: AuthenticatedRequest, res) => {
  const company = await getCompany(req.params.id);
  res.json(company);
});

companyRouter.get('/decrypted/:id', verifyAccess(), verifyCompanyAccess, async (req: AuthenticatedRequest, res) => {
  const company = await getDecryptedCompany(req.params.id);
  res.json(company);
});

companyRouter.put('/refresh-token/:id', verifyAccess(), verifyCompanyAccess, async (req: AuthenticatedRequest, res) => {
  const company = await refreshCompanyToken(req.params.id, req.body);
  res.json(company);
});

companyRouter.put('/:id', verifyAccess(), verifyCompanyAccess, async (req: AuthenticatedRequest, res) => {
  const company = await updateCompany(req.params.id, req.body);
  res.json(company);
});

export { companyRouter };