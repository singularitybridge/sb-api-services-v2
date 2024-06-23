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

const companyRouter = express.Router();

companyRouter.post('/', async (req, res) => {
  // const apiKey = req.headers['openai-api-key'] as string;
  const apiKey = process.env.OPENAI_API_KEY as string;
  console.log('POST LOG ____ API Key:', apiKey);

  const company = await createCompany(apiKey, req.body);
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

companyRouter.get('/decrypted/:id', async (req, res) => {
  const company = await getDecryptedCompany(req.params.id);
  res.json(company);
});

companyRouter.put('/refresh-token/:id', async (req, res) => {
  const company = await refreshCompanyToken(req.params.id, req.body);
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
