import express from 'express';
import { discoveryService, SupportedLanguage } from '../integrations/discovery.service';
import { leanMiddleware } from '../utils/leanResponse';

const router = express.Router();

class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

const validateLanguage = (language: string): SupportedLanguage => {
  if (language !== 'en' && language !== 'he') {
    throw new ValidationError('Unsupported language. Use "en" or "he".');
  }
  return language as SupportedLanguage;
};

const handleError = (error: unknown, res: express.Response) => {
  console.error('Error:', error);
  if (error instanceof ValidationError) {
    res.status(400).json({ error: error.message });
  } else if (error instanceof Error) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  } else {
    res.status(500).json({ error: 'Unknown error occurred' });
  }
};

router.get('/discover', async (req, res) => {
  try {
    const language = validateLanguage((req.query.language as string) || 'en');
    const actions = await discoveryService.discoverActions(language);
    res.json(actions);
  } catch (error: unknown) {
    handleError(error, res);
  }
});

router.get('/integration/:id', async (req, res) => {
  try {
    const language = validateLanguage((req.query.language as string) || 'en');
    const integration = await discoveryService.getIntegrationById(req.params.id, language);
    if (integration) {
      res.json(integration);
    } else {
      res.status(404).json({ error: 'Integration not found' });
    }
  } catch (error: unknown) {
    handleError(error, res);
  }
});

router.get('/integrations/lean', leanMiddleware(['id', 'serviceName', 'actionTitle', 'description']), async (req, res) => {
  try {
    const language = validateLanguage((req.query.language as string) || 'en');
    const leanIntegrations = await discoveryService.getIntegrationsLean(language, res.locals.getLeanResponse.fields);
    res.json(leanIntegrations);
  } catch (error: unknown) {
    handleError(error, res);
  }
});

export default router;
