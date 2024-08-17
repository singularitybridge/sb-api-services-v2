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
import { verifyAccess, AuthenticatedRequest } from '../middleware/auth.middleware';
import { Types } from 'mongoose';
import { teardownCompany } from '../services/teardown.service';

const companyRouter = express.Router();

// Admin-only routes
companyRouter.post('/', verifyAccess(true), async (req: AuthenticatedRequest, res) => {
  const company = await createCompany(req.body);
  res.json(company);
});

companyRouter.get('/', verifyAccess(), async (req: AuthenticatedRequest, res) => {
  const companyId = req.user?.companyId;
  if (!companyId) {
    return res.status(400).json({ message: 'Company ID not found in user session' });
  }
  const company = await getCompany(companyId);
  res.json(company);
});


companyRouter.delete('/:id', verifyAccess(true), async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;

  try {
    await teardownCompany(id);
    res.status(200).send({ message: 'Company and related data deleted successfully' });
  } catch (error) {
    console.error('Error deleting company:', error);
    res.status(500).send({ message: 'Failed to delete company and related data' });
  }
});



companyRouter.get('/decrypted', verifyAccess(), async (req: AuthenticatedRequest, res) => {
  const companyId = req.user?.companyId;
  if (!companyId) {
    return res.status(400).json({ message: 'Company ID not found in user session' });
  }
  const company = await getDecryptedCompany(companyId);
  res.json(company);
});

companyRouter.put('/refresh-token', verifyAccess(), async (req: AuthenticatedRequest, res) => {
  const companyId = req.user?.companyId;
  if (!companyId) {
    return res.status(400).json({ message: 'Company ID not found in user session' });
  }
  const company = await refreshCompanyToken(companyId, req.body);
  res.json(company);
});

companyRouter.put('/', verifyAccess(), async (req: AuthenticatedRequest, res) => {
  const companyId = req.user?.companyId;
  if (!companyId) {
    return res.status(400).json({ message: 'Company ID not found in user session' });
  }
  const company = await updateCompany(companyId, req.body);
  res.json(company);
});

export { companyRouter };
