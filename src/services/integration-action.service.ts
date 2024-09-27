import { executeFunctionCall, sanitizeFunctionName } from '../integrations/actions/factory';

export interface IntegrationActionResult {
  success: boolean;
  data?: any;
  error?: string;
}

export const triggerAction = async (
  integrationName: string,
  service: string,
  data: any,
  sessionId: string,
  companyId: string,
  allowedActions: string[]
): Promise<IntegrationActionResult> => {
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
};