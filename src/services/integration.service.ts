import { executeFunctionCall, sanitizeFunctionName } from '../integrations/actions/factory';
import { discoveryService, SupportedLanguage, ActionInfo, Integration } from './discovery.service';

export interface IntegrationActionResult {
  success: boolean;
  data?: any;
  error?: string;
}

export async function triggerAction(
  integrationName: string,
  service: string,
  data: any,
  sessionId: string,
  companyId: string,
  allowedActions: string[]
): Promise<IntegrationActionResult> {
  try {
    const fullServiceId = sanitizeFunctionName(`${integrationName}.${service}`);
    
    const call = {
      function: {
        name: fullServiceId,
        arguments: JSON.stringify(data)
      }
    };

    const sanitizedAllowedActions = allowedActions.map(sanitizeFunctionName);
    const result = await executeFunctionCall(call, sessionId, companyId, sanitizedAllowedActions);

    if (result.error) {
      return { success: false, error: result.error.message };
    }

    return { success: true, data: result.result };
  } catch (error: unknown) {
    if (error instanceof Error) {
      return { success: false, error: error.message };
    } else {
      return { success: false, error: 'An unknown error occurred' };
    }
  }
}

export async function getActions(language: SupportedLanguage = 'en'): Promise<ActionInfo[]> {
  return discoveryService.discoverActions(language);
}

export async function getIntegrationById(id: string, language: SupportedLanguage = 'en'): Promise<Integration | null> {
  return discoveryService.getIntegrationById(id, language);
}

export async function getLeanIntegrationActions(language: SupportedLanguage = 'en', fields?: (keyof Integration)[]): Promise<Partial<Integration>[]> {
  return discoveryService.getIntegrationsLean(language, fields);
}

export async function discoverActionById(actionId: string, language: SupportedLanguage = 'en'): Promise<ActionInfo | null> {
  const actions = await getActions(language);
  return actions.find(action => action.id === actionId) || null;
}