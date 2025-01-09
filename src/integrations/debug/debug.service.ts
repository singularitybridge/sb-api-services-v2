import { Session } from '../../models/Session';
import { getUserById } from '../../services/user.service';
import { getCompany } from '../../services/company.service';
import { triggerAction, getLeanIntegrationActions, getIntegrationById, discoverActionById as discoverActionByIdService } from '../../services/integration.service';
import { ActionContext } from '../actions/types';
import { getSessionContextData } from '../../services/session-context.service';
import { SupportedLanguage, Integration } from '../../services/discovery.service';

export const getSessionInfo = async (sessionId: string, companyId: string): Promise<{ success: boolean; markdown?: string; error?: string }> => {
  try {
    const session = await Session.findById(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const user = await getUserById(session.userId);
    if (!user) {
      throw new Error('User not found');
    }

    const company = await getCompany(companyId);

    const info = {
      sessionId,
      userId: user._id.toString(),
      userName: user.name,
      companyId: company._id.toString(),
      companyName: company.name,
    };

    const markdown = `
| Property    | Value                |
|-------------|----------------------|
| Session ID  | ${info.sessionId}    |
| User ID     | ${info.userId}       |
| User Name   | ${info.userName}     |
| Company ID  | ${info.companyId}    |
| Company Name| ${info.companyName}  |
    `;

    return { success: true, markdown };
  } catch (error: any) {
    console.error('Error in getSessionInfo:', error);
    return { success: false, error: error.message || 'An error occurred' };
  }
};

export const verifyApiKey = async (_key: string): Promise<boolean> => {
  // Debug integration doesn't require API key verification
  return true;
};

export const triggerIntegrationAction = async (
  sessionId: string,
  companyId: string,
  integrationName: string,
  service: string,
  data: any
): Promise<{ success: boolean; data?: any; error?: string }> => {
  try {
    // Use the original function name without sanitization
    const fullFunctionName = `${integrationName}.${service}`;

    // Include the full function name in allowedActions
    const allowedActions: string[] = [fullFunctionName];

    const result = await triggerAction(integrationName, service, data, sessionId, companyId, allowedActions);

    return {
      success: result.success,
      data: result.data,
      error: result.error,
    };
  } catch (error: any) {
    console.error('Error in triggerIntegrationAction:', error);
    return { success: false, error: error.message || 'Failed to trigger integration action' };
  }
};

export const discoverLeanActions = async (): Promise<{ success: boolean; data?: any; error?: string }> => {
  try {
    const leanActions = await getLeanIntegrationActions('en', ['id', 'name', 'description'])
    return { success: true, data: leanActions };
  } catch (error: any) {
    console.error('Error in discoverLeanActions:', error);
    return { success: false, error: error.message || 'Failed to discover lean actions' };
  }
};

export const getIntegration = async (integrationId: string): Promise<{ success: boolean; data?: any; error?: string }> => {
  try {
    const integration = await getIntegrationById(integrationId);
    if (integration) {
      return { success: true, data: integration };
    } else {
      return { success: false, error: 'Integration not found' };
    }
  } catch (error: any) {
    console.error('Error in getIntegration:', error);
    return { success: false, error: error.message || 'Failed to get integration' };
  }
};

export const discoverActionById = async (actionId: string, language: SupportedLanguage): Promise<{ success: boolean; data?: any; error?: string }> => {
  try {
    const action = await discoverActionByIdService(actionId, language);
    if (action) {
      return { success: true, data: action };
    } else {
      return { success: false, error: 'Action not found' };
    }
  } catch (error: any) {
    console.error('Error in discoverActionById:', error);
    return { success: false, error: error.message || 'Failed to discover action by ID' };
  }
};
