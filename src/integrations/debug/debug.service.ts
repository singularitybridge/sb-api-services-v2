import { Session } from '../../models/Session';
import { getUserById } from '../../services/user.service';
import { getCompany } from '../../services/company.service';
import {
  triggerAction,
  getLeanIntegrationActions,
  getIntegrationById,
  discoverActionById as discoverActionByIdService,
} from '../../services/integration.service';
import { ActionContext } from '../actions/types';
import { getSessionContextData } from '../../services/session-context.service';
import {
  SupportedLanguage,
  Integration,
} from '../../services/discovery.service';

export const getSessionInfo = async (
  sessionId: string,
  companyId: string,
): Promise<{ success: boolean; markdown?: string; error?: string }> => {
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
  data: any,
): Promise<{ success: boolean; data?: any; error?: string }> => {
  try {
    // Use the original function name without sanitization
    const fullFunctionName = `${integrationName}.${service}`;

    // Include the full function name in allowedActions
    const allowedActions: string[] = [fullFunctionName];

    const result = await triggerAction(
      integrationName,
      service,
      data,
      sessionId,
      companyId,
      allowedActions,
    );

    return {
      success: result.success,
      data: result.data,
      error: result.error,
    };
  } catch (error: any) {
    console.error('Error in triggerIntegrationAction:', error);
    return {
      success: false,
      error: error.message || 'Failed to trigger integration action',
    };
  }
};

export const discoverLeanActions = async (): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> => {
  try {
    const leanActions = await getLeanIntegrationActions('en', [
      'id',
      'name',
      'description',
    ]);
    return { success: true, data: leanActions };
  } catch (error: any) {
    console.error('Error in discoverLeanActions:', error);
    return {
      success: false,
      error: error.message || 'Failed to discover lean actions',
    };
  }
};

export const getIntegration = async (
  integrationId: string,
): Promise<{ success: boolean; data?: any; error?: string }> => {
  try {
    const integration = await getIntegrationById(integrationId);
    if (integration) {
      return { success: true, data: integration };
    } else {
      return { success: false, error: 'Integration not found' };
    }
  } catch (error: any) {
    console.error('Error in getIntegration:', error);
    return {
      success: false,
      error: error.message || 'Failed to get integration',
    };
  }
};

export const discoverActionById = async (
  actionId: string,
  language: SupportedLanguage,
): Promise<{ success: boolean; data?: any; error?: string }> => {
  try {
    const action = await discoverActionByIdService(actionId, language);
    if (action) {
      return { success: true, data: action };
    } else {
      return { success: false, error: 'Action not found' };
    }
  } catch (error: any) {
    console.error('Error in discoverActionById:', error);
    return {
      success: false,
      error: error.message || 'Failed to discover action by ID',
    };
  }
};

export const discoverAllIntegrations = async (
  language: SupportedLanguage = 'en',
): Promise<{ success: boolean; data?: any; error?: string }> => {
  try {
    const { discoveryService } = await import(
      '../../services/discovery.service'
    );
    const integrations = await discoveryService.discoverIntegrations(language);

    // Add action count and simplify the response
    const integrationsWithCounts = integrations.map((integration) => ({
      id: integration.id,
      name: integration.name,
      description: integration.description,
      icon: integration.icon,
      actionCount: integration.actions?.length || 0,
      actions:
        integration.actions?.map((action) => ({
          id: action.id,
          title: action.actionTitle,
          description: action.description,
        })) || [],
    }));

    return { success: true, data: integrationsWithCounts };
  } catch (error: any) {
    console.error('Error in discoverAllIntegrations:', error);
    return {
      success: false,
      error: error.message || 'Failed to discover all integrations',
    };
  }
};

export const discoverActionsByIntegration = async (
  integrationId: string,
  language: SupportedLanguage = 'en',
): Promise<{ success: boolean; data?: any; error?: string }> => {
  try {
    const integration = await getIntegrationById(integrationId, language);
    if (!integration) {
      return {
        success: false,
        error: `Integration '${integrationId}' not found`,
      };
    }

    // Return detailed action information
    const actionsWithDetails = integration.actions.map((action) => ({
      id: action.id,
      serviceName: action.serviceName,
      actionTitle: action.actionTitle,
      description: action.description,
      icon: action.icon,
      parameters: action.parameters,
      integration: {
        id: integration.id,
        name: integration.name,
        icon: integration.icon,
      },
    }));

    return {
      success: true,
      data: {
        integration: {
          id: integration.id,
          name: integration.name,
          description: integration.description,
          icon: integration.icon,
        },
        actions: actionsWithDetails,
        totalActions: actionsWithDetails.length,
      },
    };
  } catch (error: any) {
    console.error('Error in discoverActionsByIntegration:', error);
    return {
      success: false,
      error: error.message || 'Failed to discover actions by integration',
    };
  }
};

export const searchActions = async (
  searchTerm: string,
  language: SupportedLanguage = 'en',
): Promise<{ success: boolean; data?: any; error?: string }> => {
  try {
    const { discoveryService } = await import(
      '../../services/discovery.service'
    );
    const allActions = await discoveryService.discoverActions(language);

    const searchLower = searchTerm.toLowerCase();
    const matchedActions = allActions.filter(
      (action) =>
        action.id.toLowerCase().includes(searchLower) ||
        action.actionTitle.toLowerCase().includes(searchLower) ||
        action.description.toLowerCase().includes(searchLower) ||
        action.serviceName.toLowerCase().includes(searchLower),
    );

    // Group actions by integration for better organization
    const groupedActions = matchedActions.reduce(
      (acc, action) => {
        const integrationId = action.service;
        if (!acc[integrationId]) {
          acc[integrationId] = {
            integrationId,
            integrationName: action.serviceName,
            actions: [],
          };
        }
        acc[integrationId].actions.push({
          id: action.id,
          title: action.actionTitle,
          description: action.description,
          parameters: action.parameters,
        });
        return acc;
      },
      {} as Record<string, any>,
    );

    return {
      success: true,
      data: {
        searchTerm,
        totalMatches: matchedActions.length,
        results: Object.values(groupedActions),
        allMatches: matchedActions,
      },
    };
  } catch (error: any) {
    console.error('Error in searchActions:', error);
    return {
      success: false,
      error: error.message || 'Failed to search actions',
    };
  }
};
