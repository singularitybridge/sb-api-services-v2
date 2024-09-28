import { executeFunctionCall, sanitizeFunctionName } from '../integrations/actions/factory';
import { discoveryService, SupportedLanguage, ActionInfo } from './discovery.service';

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

    const result = await executeFunctionCall(call, sessionId, companyId, allowedActions);

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

export async function getIntegrations(language: SupportedLanguage = 'en') {
  return discoveryService.discoverIntegrations(language);
}

export async function getIntegrationActions(language: SupportedLanguage = 'en') {
  return discoveryService.discoverActions(language);
}

export async function getIntegrationById(id: string, language: SupportedLanguage = 'en') {
  return discoveryService.getIntegrationById(id, language);
}

export async function getLeanIntegrationActions(language: SupportedLanguage = 'en', fields?: (keyof ActionInfo)[]) {
  return discoveryService.getIntegrationsLean(language, fields);
}