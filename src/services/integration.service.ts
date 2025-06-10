import { executeFunctionCall, sanitizeFunctionName } from '../integrations/actions/factory';
import { discoveryService, SupportedLanguage, ActionInfo, Integration } from './discovery.service';

export interface IntegrationActionResult {
  success: boolean;
  data?: any;
  error?: string;
}

export interface LeanAction {
  id: string;
  title: string;
  description: string;
}

export type LeanIntegration = Omit<Partial<Integration>, 'actions'> & {
  actions?: LeanAction[];
};

export async function triggerAction(
  integrationName: string,
  service: string,
  data: any,
  sessionId: string,
  companyId: string,
  allowedActions: string[]
): Promise<IntegrationActionResult> {
  console.log(`[triggerAction] Entered. Integration: ${integrationName}, Service: ${service}, SessionID: ${sessionId}, CompanyID: ${companyId}`);
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

export async function getLeanIntegrationActions(language: SupportedLanguage = 'en', fields?: (keyof Integration)[]): Promise<LeanIntegration[]> {
  const leanIntegrations = await discoveryService.getIntegrationsLean(language, fields);
  
  if (fields && fields.includes('actions')) {
    const actions = await getActions(language);
    
    return leanIntegrations.map(integration => ({
      ...integration,
      actions: actions
        .filter(action => action.service === integration.id)
        .map(action => ({
          id: action.id,
          title: action.actionTitle,
          description: action.description
        }))
    })) as LeanIntegration[];
  }
  
  return leanIntegrations as LeanIntegration[];
}

export async function discoverActionById(actionId: string, language: SupportedLanguage = 'en'): Promise<ActionInfo | null> {
  const actions = await getActions(language);
  return actions.find(action => action.id === actionId) || null;
}
