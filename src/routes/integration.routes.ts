import express from 'express';
import {
  AuthenticatedRequest,
  verifyAccess,
} from '../middleware/auth.middleware';
import {
  getSessionOrCreate,
} from '../services/session.service';
import { ChannelType } from '../types/ChannelType';
import { getApiKey, ApiKeyType } from '../services/api.key.service';
import {
  triggerAction,
  getActions,
  getIntegrationById,
  getLeanIntegrationActions,
  discoverActionById,
} from '../services/integration.service';
import { SupportedLanguage, Integration } from '../services/discovery.service';
import { sanitizeFunctionName } from '../integrations/actions/factory';

const router = express.Router();

// Helper function to get session language
export async function getSessionLanguage(
  userId: string,
  companyId: string
): Promise<SupportedLanguage> {
  try {
    const apiKey = await getApiKey(companyId, 'openai' as ApiKeyType);
    
    if (!apiKey) {
      console.log('OpenAI API key not found, defaulting to English');
      return 'en';
    }

    const session = await getSessionOrCreate(
      apiKey,
      userId,
      companyId,
      ChannelType.WEB,
      'en' // Default language
    );

    console.log(`Session found:`, session);
    return session.language as SupportedLanguage;
  } catch (error) {
    console.error('Error getting session language:', error);
    return 'en'; // Default to English if there's an error
  }
}

// Discover all integrations
router.get(
  '/discover',
  verifyAccess(),
  async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?._id.toString();
      const companyId = req.user?.companyId.toString();
      if (!userId || !companyId) {
        throw new Error('User ID or Company ID not found');
      }
      const language = await getSessionLanguage(userId, companyId);
      const actions = await getActions(language);
      res.json(actions);
    } catch (error) {
      console.error('Error in /discover:', error);
      res.status(500).json({ error: 'Failed to discover integrations' });
    }
  },
);

// Rest of the file remains unchanged
// ...

export default router;
