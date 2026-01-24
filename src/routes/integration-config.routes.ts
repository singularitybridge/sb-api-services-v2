// file path: /src/routes/integration-config.routes.ts
import express from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import {
  getIntegrationConfigs,
  getIntegrationConfig,
  saveIntegrationConfig,
  deleteIntegrationConfig,
  getIntegrationConfigStatuses,
  getIntegrationApiKey,
  testIntegrationConnection,
  ApiKeyInput,
} from '../services/integration-config.service';
import { discoveryService } from '../services/discovery.service';

const router = express.Router();

/**
 * GET /api/integrations/configs
 * List all integration configs for the company with status
 */
router.get('/configs', async (req: AuthenticatedRequest, res) => {
  try {
    const companyId = req.company?._id?.toString();
    if (!companyId) {
      return res.status(400).json({ error: 'Company ID required' });
    }

    // Get all integrations from discovery service
    const integrations = await discoveryService.discoverIntegrations();
    const integrationIds = integrations.map((i) => i.id);

    // Get config statuses for all integrations
    const statuses = await getIntegrationConfigStatuses(
      companyId,
      integrationIds,
    );

    // Merge integration info with config status
    const result = integrations.map((integration) => {
      const status = statuses.find((s) => s.integrationId === integration.id);
      return {
        ...integration,
        configured: status?.configured ?? false,
        enabled: status?.enabled ?? false,
        configuredAt: status?.configuredAt,
        configuredKeys: status?.configuredKeys ?? [],
      };
    });

    res.json(result);
  } catch (error) {
    console.error('Error getting integration configs:', error);
    res.status(500).json({ error: 'Failed to get integration configs' });
  }
});

/**
 * GET /api/integrations/:id/config
 * Get a specific integration config
 */
router.get('/:id/config', async (req: AuthenticatedRequest, res) => {
  try {
    const companyId = req.company?._id?.toString();
    const { id: integrationId } = req.params;

    if (!companyId) {
      return res.status(400).json({ error: 'Company ID required' });
    }

    const config = await getIntegrationConfig(companyId, integrationId);

    if (!config) {
      return res.json({
        integrationId,
        configured: false,
        enabled: false,
        configuredKeys: [],
      });
    }

    // Return config without decrypted values
    res.json({
      integrationId: config.integrationId,
      configured: config.apiKeys.length > 0,
      enabled: config.enabled,
      configuredAt: config.configuredAt,
      configuredKeys: config.apiKeys.map((k) => k.key),
    });
  } catch (error) {
    console.error('Error getting integration config:', error);
    res.status(500).json({ error: 'Failed to get integration config' });
  }
});

/**
 * PUT /api/integrations/:id/config
 * Save or update integration API keys
 */
router.put('/:id/config', async (req: AuthenticatedRequest, res) => {
  try {
    const companyId = req.company?._id?.toString();
    const userId = req.user?._id?.toString();
    const { id: integrationId } = req.params;
    const { apiKeys } = req.body as { apiKeys: ApiKeyInput[] };

    if (!companyId) {
      return res.status(400).json({ error: 'Company ID required' });
    }

    if (!apiKeys || !Array.isArray(apiKeys)) {
      return res.status(400).json({ error: 'apiKeys array required' });
    }

    // Validate apiKeys structure
    for (const key of apiKeys) {
      if (!key.key || typeof key.key !== 'string') {
        return res
          .status(400)
          .json({ error: 'Each apiKey must have a key field' });
      }
      if (!key.value || typeof key.value !== 'string') {
        return res
          .status(400)
          .json({ error: 'Each apiKey must have a value field' });
      }
    }

    const config = await saveIntegrationConfig(
      companyId,
      integrationId,
      apiKeys,
      userId,
    );

    res.json({
      integrationId: config.integrationId,
      configured: true,
      enabled: config.enabled,
      configuredAt: config.configuredAt,
      configuredKeys: config.apiKeys.map((k) => k.key),
    });
  } catch (error) {
    console.error('Error saving integration config:', error);
    res.status(500).json({ error: 'Failed to save integration config' });
  }
});

/**
 * GET /api/integrations/:id/config/keys/:keyName
 * Get a specific decrypted API key value (for preview)
 */
router.get(
  '/:id/config/keys/:keyName',
  async (req: AuthenticatedRequest, res) => {
    try {
      const companyId = req.company?._id?.toString();
      const { id: integrationId, keyName } = req.params;

      if (!companyId) {
        return res.status(400).json({ error: 'Company ID required' });
      }

      const keyValue = await getIntegrationApiKey(
        companyId,
        integrationId,
        keyName,
      );

      if (!keyValue) {
        return res.status(404).json({ error: 'API key not found' });
      }

      res.json({ key: keyName, value: keyValue });
    } catch (error) {
      console.error('Error getting API key:', error);
      res.status(500).json({ error: 'Failed to get API key' });
    }
  },
);

/**
 * POST /api/integrations/:id/test
 * Test connection for an integration
 * Optionally accepts apiKeys in body to test with unsaved values
 */
router.post('/:id/test', async (req: AuthenticatedRequest, res) => {
  try {
    const companyId = req.company?._id?.toString();
    const { id: integrationId } = req.params;
    const { apiKeys } = req.body as { apiKeys?: ApiKeyInput[] };

    if (!companyId) {
      return res.status(400).json({ error: 'Company ID required' });
    }

    // Convert apiKeys array to Record if provided
    let apiKeysRecord: Record<string, string> | undefined;
    if (apiKeys && Array.isArray(apiKeys) && apiKeys.length > 0) {
      apiKeysRecord = {};
      for (const key of apiKeys) {
        if (key.key && key.value) {
          apiKeysRecord[key.key] = key.value;
        }
      }
    }

    const result = await testIntegrationConnection(
      companyId,
      integrationId,
      apiKeysRecord,
    );

    if (result.success) {
      res.json({
        success: true,
        message: result.message || 'Connection test successful',
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error || 'Connection test failed',
      });
    }
  } catch (error: any) {
    console.error('Error testing integration:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to test integration connection',
    });
  }
});

/**
 * DELETE /api/integrations/:id/config
 * Remove an integration config
 */
router.delete('/:id/config', async (req: AuthenticatedRequest, res) => {
  try {
    const companyId = req.company?._id?.toString();
    const { id: integrationId } = req.params;

    if (!companyId) {
      return res.status(400).json({ error: 'Company ID required' });
    }

    const deleted = await deleteIntegrationConfig(companyId, integrationId);

    if (!deleted) {
      return res.status(404).json({ error: 'Integration config not found' });
    }

    res.json({ message: 'Integration config deleted' });
  } catch (error) {
    console.error('Error deleting integration config:', error);
    res.status(500).json({ error: 'Failed to delete integration config' });
  }
});

export default router;
