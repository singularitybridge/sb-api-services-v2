import express from 'express';
import {
  createCompany,
  deleteCompany,
  getCompanies,
  getCompany,
  updateCompany,
} from '../services/company.service';

const companyRouter = express.Router();

companyRouter.post('/', async (req, res) => {
  console.log('called company router');
  const company = await createCompany(req.body);
  res.json(company);
});

companyRouter.get('/', async (req, res) => {
  const companies = await getCompanies();
  res.json(companies);
});

companyRouter.get('/:id', async (req, res) => {
  const company = await getCompany(req.params.id);
  res.json(company);
});

companyRouter.put('/:id', async (req, res) => {
  const company = await updateCompany(req.params.id, req.body);
  res.json(company);
});

companyRouter.delete('/:id', async (req, res) => {
  const company = await deleteCompany(req.params.id);
  res.json(company);
});

export { companyRouter };
