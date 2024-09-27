import { discoveryService } from '../integrations/discovery.service';

export interface IntegrationActionResult {
  success: boolean;
  data?: any;
  error?: string;
}

export const triggerAction = async (
  integrationName: string,
  service: string,
  data: any
): Promise<IntegrationActionResult> => {
  try {
    const actions = await discoveryService.discoverActions();
    const action = actions.find(a => a.service === integrationName && a.id.endsWith(`.${service}`));

    if (!action) {
      throw new Error(`Action '${service}' not found for integration '${integrationName}'`);
    }

    // Dynamically import the integration's action file
    const integrationModule = await import(`../integrations/${integrationName}/${integrationName}.actions`);
    const actionFunction = integrationModule[service];

    if (typeof actionFunction !== 'function') {
      throw new Error(`Invalid action function for '${service}' in integration '${integrationName}'`);
    }

    const result = await actionFunction(data);
    return { success: true, data: result };
  } catch (error: unknown) {
    if (error instanceof Error) {
      return { success: false, error: error.message };
    } else {
      return { success: false, error: 'An unknown error occurred' };
    }
  }
};