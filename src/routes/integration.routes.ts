import express from 'express';
import {
  AuthenticatedRequest,
  verifyAccess,
} from '../middleware/auth.middleware';
import { getSessionOrCreate, getSessionLanguage } from '../services/session.service';
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

// Discover a specific action by ID
router.get(
  '/discover/action/:actionId',
  verifyAccess(),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { actionId } = req.params;
      const userId = req.user?._id.toString();
      const companyId = req.user?.companyId.toString();
      if (!userId || !companyId) {
        throw new Error('User ID or Company ID not found');
      }
      const language = await getSessionLanguage(userId, companyId);
      const action = await discoverActionById(actionId, language);
      if (action) {
        res.json(action);
      } else {
        res.status(404).json({ error: 'Action not found' });
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to discover action' });
    }
  },
);

// Discover lean actions for all integrations
router.get(
  '/discover/lean',
  verifyAccess(),
  async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?._id.toString();
      const companyId = req.user?.companyId.toString();
      if (!userId || !companyId) {
        throw new Error('User ID or Company ID not found');
      }
      const language = await getSessionLanguage(userId, companyId);
      const fieldsParam = req.query.fields as string | undefined;
      const fields = fieldsParam
        ? (fieldsParam.split(',') as (keyof Integration)[])
        : undefined;

      const leanActions = await getLeanIntegrationActions(language, fields);

      res.json(leanActions);
    } catch (error) {
      console.error('Error in /discover/lean:', error); // Log any errors
      res.status(500).json({ error: 'Failed to discover lean actions' });
    }
  },
);

// Get a specific integration by ID
router.get(
  '/:integrationId',
  verifyAccess(),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { integrationId } = req.params;
      const userId = req.user?._id.toString();
      const companyId = req.user?.companyId.toString();
      if (!userId || !companyId) {
        throw new Error('User ID or Company ID not found');
      }
      const language = await getSessionLanguage(userId, companyId);
      const integration = await getIntegrationById(integrationId, language);
      if (integration) {
        res.json(integration);
      } else {
        res.status(404).json({ error: 'Integration not found' });
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to get integration' });
    }
  },
);

// Trigger an action for a specific integration
router.post(
  '/actions/:integrationName/:actionName',
  verifyAccess(),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { integrationName, actionName } = req.params;
      const { data } = req.body;

      if (!integrationName || !actionName) {
        return res
          .status(400)
          .json({ error: 'Integration name and action name are required' });
      }

      const companyId = req.company?._id;
      const userId = req.user?._id;

      if (!companyId) {
        return res.status(400).json({ error: 'Company ID is required' });
      }

      if (!userId) {
        return res
          .status(401)
          .json({ error: 'Unauthorized: User ID is required' });
      }

      // Get API key
      const apiKey = await getApiKey(
        companyId.toString(),
        'openai_api_key',
      );
      if (!apiKey) {
        return res
          .status(500)
          .json({ error: 'OpenAI API key not found for the company' });
      }

      // Get or create session
      const session = await getSessionOrCreate(
        apiKey,
        userId.toString(),
        companyId.toString(),
        ChannelType.WEB,
      );

      if (!session) {
        return res
          .status(500)
          .json({ error: 'Failed to create or retrieve session' });
      }

      // Sanitize the function name
      const fullFunctionName = sanitizeFunctionName(
        `${integrationName}.${actionName}`,
      );

      // Include the sanitized function name in allowedActions
      const allowedActions: string[] = [fullFunctionName];

      const result = await triggerAction(
        integrationName,
        actionName,
        data,
        session._id.toString(),
        companyId.toString(),
        allowedActions,
      );

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
  },
);

export default router;
