import express from 'express';
import { AuthenticatedRequest, verifyAccess } from '../middleware/auth.middleware';
import { triggerAction } from '../services/integration-action.service';
import { getSessionOrCreate } from '../services/session.service';
import { ChannelType } from '../types/ChannelType';
import { getApiKey, ApiKeyType } from '../services/api.key.service';
import { sanitizeFunctionName } from '../integrations/actions/factory';

const router = express.Router();

router.post('/trigger', verifyAccess(), async (req: AuthenticatedRequest, res) => {
  try {
    const { integrationName, service, data } = req.body;
    
    if (!integrationName || !service) {
      return res.status(400).json({ error: 'integrationName and service are required' });
    }

    const companyId = req.company?._id;
    const userId = req.user?._id;

    if (!companyId) {
      return res.status(400).json({ error: 'Company ID is required' });
    }

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: User ID is required' });
    }

    // Get API key
    const apiKey = await getApiKey(companyId.toString(), 'openai' as ApiKeyType);
    if (!apiKey) {
      return res.status(500).json({ error: 'OpenAI API key not found for the company' });
    }

    // Get or create session
    const session = await getSessionOrCreate(
      apiKey,
      userId.toString(),
      companyId.toString(),
      ChannelType.WEB
    );

    if (!session) {
      return res.status(500).json({ error: 'Failed to create or retrieve session' });
    }

    // Sanitize the function name
    const sanitizedFunctionName = sanitizeFunctionName(`${integrationName}.${service}`);

    // Include the sanitized function name in allowedActions
    const allowedActions: string[] = [sanitizedFunctionName];

    const result = await triggerAction(integrationName, service, data, session._id.toString(), companyId.toString(), allowedActions);
    
    if (result.success) {
      res.json(result.data);
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error: unknown) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'An unknown error occurred' });
    }
  }
});

export default router;