import mongoose from 'mongoose';
import { Session } from '../../models/Session';
import { getUserById } from '../../services/user.service';
import { getCompany } from '../../services/company.service';
import {
  triggerAction,
  triggerActionWithContext,
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

/**
 * Check if a string is a valid MongoDB ObjectId (and not the stateless marker)
 */
const isValidSessionId = (id: string): boolean => {
  return mongoose.Types.ObjectId.isValid(id) && id !== 'stateless_execution';
};

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
  contextOverride?: Partial<ActionContext>,
): Promise<{ success: boolean; data?: any; error?: string }> => {
  try {
    // Use the original function name without sanitization
    const fullFunctionName = `${integrationName}.${service}`;

    // Include the full function name in allowedActions
    const allowedActions: string[] = [fullFunctionName];

    // Determine if this is a stateless execution
    const isStateless =
      contextOverride?.isStateless || !isValidSessionId(sessionId);

    if (isStateless) {
      // Stateless mode - build context from available data and use context-first path
      console.log(
        `[triggerIntegrationAction] Using stateless execution path for sessionId: ${sessionId}`,
      );

      const context: ActionContext = {
        sessionId,
        companyId,
        language: contextOverride?.language || 'en',
        userId: contextOverride?.userId,
        assistantId: contextOverride?.assistantId,
        isStateless: true,
        ...contextOverride,
      };

      const result = await triggerActionWithContext(
        integrationName,
        service,
        data,
        context,
        allowedActions,
      );

      return {
        success: result.success,
        data: result.data,
        error: result.error,
      };
    }

    // Session mode - use legacy path which derives context from session lookup
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

/**
 * Generate developer-focused implementation guide for an action
 */
export const getActionImplementationGuide = async (
  actionId: string,
  language: SupportedLanguage = 'en',
): Promise<{ success: boolean; data?: any; error?: string }> => {
  try {
    const action = await discoverActionByIdService(actionId, language);
    if (!action) {
      return { success: false, error: `Action '${actionId}' not found` };
    }

    // Parse integration and action name from ID
    const [integrationName, actionName] = actionId.split('.');

    // Generate example request data based on schema
    const generateExampleRequest = (parameters: any): any => {
      if (!parameters || !parameters.properties) return {};

      const example: any = {};
      const props = parameters.properties as Record<string, any>;
      const requiredFields = (parameters.required || []) as string[];

      for (const [key, prop] of Object.entries(props)) {
        const propDef = prop as any;
        const isRequired = requiredFields.includes(key);

        // Generate example based on type
        switch (propDef.type) {
          case 'string':
            example[key] = propDef.description
              ? `"your_${key.toLowerCase()}"`
              : `"example_${key}"`;
            break;
          case 'number':
          case 'integer':
            example[key] = propDef.enum ? propDef.enum[0] : 123;
            break;
          case 'boolean':
            example[key] = true;
            break;
          case 'array':
            example[key] =
              propDef.items?.type === 'string' ? ['item1', 'item2'] : [];
            break;
          case 'object':
            example[key] = {};
            break;
          default:
            if (isRequired) {
              example[key] = `"${key}_value"`;
            }
        }
      }

      return example;
    };

    const exampleRequest = generateExampleRequest(action.parameters);

    // Build implementation guide
    const guide = {
      action: {
        id: actionId,
        integration: integrationName,
        actionName: actionName,
        title: action.actionTitle,
        description: action.description,
      },

      implementation: {
        // How to call via triggerIntegrationAction
        triggerAction: {
          method: 'debug.triggerIntegrationAction',
          parameters: {
            integrationName: integrationName,
            service: actionName,
            requestData: JSON.stringify(exampleRequest, null, 2),
          },
          example: `debug.triggerIntegrationAction({\n  integrationName: "${integrationName}",\n  service: "${actionName}",\n  requestData: ${JSON.stringify(exampleRequest, null, 2)}\n})`,
        },

        // Direct AI agent configuration
        aiAgentConfig: {
          allowedActions: [actionId],
          examplePrompt: `Use ${actionId} to ${action.description.toLowerCase()}`,
          requiredParameters: ((action.parameters as any)?.required ||
            []) as string[],
        },
      },

      schema: {
        parameters: action.parameters,
        required: ((action.parameters as any)?.required || []) as string[],
        properties: Object.entries(
          ((action.parameters as any)?.properties || {}) as Record<string, any>,
        ).map(([key, prop]: [string, any]) => ({
          name: key,
          type: prop.type,
          description: prop.description,
          required: (
            ((action.parameters as any)?.required || []) as string[]
          ).includes(key),
          enum: prop.enum,
          items: prop.items,
        })),
      },

      examples: {
        minimalRequest: JSON.stringify(
          Object.fromEntries(
            (((action.parameters as any)?.required || []) as string[]).map(
              (key: string) => [key, exampleRequest[key]],
            ),
          ),
          null,
          2,
        ),
        fullRequest: JSON.stringify(exampleRequest, null, 2),
        curl: `curl -X POST /api/integrations/trigger \\
  -H "Content-Type: application/json" \\
  -d '{
    "integrationName": "${integrationName}",
    "service": "${actionName}",
    "data": ${JSON.stringify(exampleRequest)}
  }'`,
      },

      errorHandling: {
        commonErrors: [
          {
            error: 'Missing required parameter',
            solution: `Ensure all required fields are provided: ${(((action.parameters as any)?.required || []) as string[]).join(', ')}`,
          },
          {
            error: 'Invalid parameter type',
            solution: 'Check schema.properties for correct data types',
          },
          {
            error: 'Integration not configured',
            solution: `Verify ${integrationName} credentials are set up`,
          },
        ],
      },

      bestPractices: [
        'Always validate required parameters before calling',
        'Handle errors gracefully with try/catch',
        'Use the schema to validate input data',
        'Test with minimal request first, then add optional params',
        'Check integration setup requirements before use',
      ],
    };

    return { success: true, data: guide };
  } catch (error: any) {
    console.error('Error in getActionImplementationGuide:', error);
    return {
      success: false,
      error: error.message || 'Failed to generate implementation guide',
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

/**
 * Generate business-friendly context for an integration
 */
const generateBusinessContext = (
  integrationId: string,
  actions: any[],
): {
  setupRequirements: string[];
  commonUseCases: string[];
  requiredInfo: string[];
} => {
  const context = {
    setupRequirements: [] as string[],
    commonUseCases: [] as string[],
    requiredInfo: [] as string[],
  };

  // Integration-specific context
  const integrationContext: Record<string, any> = {
    jira: {
      setupRequirements: [
        'JIRA workspace URL (e.g., yourcompany.atlassian.net)',
        'API token from JIRA settings',
        'User email address for authentication',
      ],
      commonUseCases: [
        'Create and track bug reports',
        'Manage project tasks and sprints',
        'Automate ticket creation from customer feedback',
        'Track team progress and velocity',
      ],
      requiredInfo: [
        'Project key (e.g., "PROJ" from PROJ-123)',
        'Issue type (Bug, Story, Task, Epic)',
        'Summary and description for new tickets',
      ],
    },
    sendgrid: {
      setupRequirements: [
        'SendGrid API key from account settings',
        'Verified sender email address',
      ],
      commonUseCases: [
        'Send customer notifications and alerts',
        'Automated email campaigns',
        'Transactional emails (receipts, confirmations)',
        'Internal team notifications',
      ],
      requiredInfo: [
        'Recipient email address',
        'Email subject line',
        'Message content (text and/or HTML)',
      ],
    },
    linear: {
      setupRequirements: [
        'Linear workspace access',
        'API key from Linear settings',
      ],
      commonUseCases: [
        'Create and assign product issues',
        'Track feature development',
        'Manage product roadmap',
        'Sprint planning and execution',
      ],
      requiredInfo: [
        'Team ID for issue assignment',
        'Issue title and description',
        'Priority level and labels',
      ],
    },
    mongodb: {
      setupRequirements: [
        'MongoDB connection string',
        'Database and collection names',
        'Read/write permissions',
      ],
      commonUseCases: [
        'Query customer data',
        'Generate reports and analytics',
        'Update user records',
        'Data migration and backup',
      ],
      requiredInfo: [
        'Collection name to query',
        'Filter criteria (MongoDB query)',
        'Fields to retrieve or update',
      ],
    },
  };

  // Default context for unknown integrations
  const defaultContext = {
    setupRequirements: [
      'API credentials or access token',
      'Service account or workspace access',
    ],
    commonUseCases: [
      'Automate repetitive tasks',
      'Integrate with business workflows',
      'Sync data across platforms',
    ],
    requiredInfo: ['Action-specific parameters', 'Target resource identifiers'],
  };

  const specific = integrationContext[integrationId.toLowerCase()];
  if (specific) {
    context.setupRequirements = specific.setupRequirements;
    context.commonUseCases = specific.commonUseCases;
    context.requiredInfo = specific.requiredInfo;
  } else {
    context.setupRequirements = defaultContext.setupRequirements;
    context.commonUseCases = defaultContext.commonUseCases;
    context.requiredInfo = defaultContext.requiredInfo;
  }

  return context;
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

    // Return detailed action information with simplified parameters
    const actionsWithDetails = integration.actions.map((action) => {
      // Extract required parameters in simple terms
      const params = action.parameters as any;
      const requiredFields = (params?.required || []) as string[];
      const properties = (params?.properties || {}) as Record<string, any>;

      const requiredParams = requiredFields.map((param: string) => {
        const propDef = properties[param];
        return {
          name: param,
          description: propDef?.description || param,
          type: propDef?.type || 'string',
        };
      });

      return {
        id: action.id,
        serviceName: action.serviceName,
        actionTitle: action.actionTitle,
        description: action.description,
        icon: action.icon,
        requiredParameters: requiredParams,
        allParameters: action.parameters,
        integration: {
          id: integration.id,
          name: integration.name,
          icon: integration.icon,
        },
      };
    });

    // Add business context
    const businessContext = generateBusinessContext(
      integrationId,
      actionsWithDetails,
    );

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
        businessContext,
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

/**
 * Extract search keywords from a query
 * Examples:
 * "How can I send emails?" -> ["send", "email", "mail"]
 * "Create JIRA tickets" -> ["create", "jira", "ticket", "issue"]
 */
const extractSearchKeywords = (query: string): string[] => {
  const keywords: string[] = [];
  const queryLower = query.toLowerCase();

  // Common task verbs and their synonyms
  const taskMappings: Record<string, string[]> = {
    send: ['send', 'sending', 'sent', 'deliver', 'dispatch'],
    create: ['create', 'creating', 'make', 'add', 'new', 'generate'],
    get: ['get', 'fetch', 'retrieve', 'find', 'search', 'list'],
    update: ['update', 'modify', 'edit', 'change'],
    delete: ['delete', 'remove', 'clear'],
    email: ['email', 'mail', 'message', 'notification'],
    ticket: ['ticket', 'issue', 'task', 'story'],
    file: ['file', 'document', 'upload', 'download'],
    image: ['image', 'picture', 'photo', 'generate'],
    user: ['user', 'person', 'account', 'member'],
    message: ['message', 'chat', 'communicate'],
  };

  // Extract base query words
  const words = queryLower
    .replace(/[?!.,]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 2);

  // Add original words
  keywords.push(...words);

  // Add mapped synonyms
  for (const [key, synonyms] of Object.entries(taskMappings)) {
    if (words.some((word) => synonyms.includes(word))) {
      keywords.push(key, ...synonyms);
    }
  }

  return [...new Set(keywords)]; // Remove duplicates
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

    // Extract smart keywords from search term
    const keywords = extractSearchKeywords(searchTerm);
    const searchLower = searchTerm.toLowerCase();

    // Match using both original term and extracted keywords
    const matchedActions = allActions.filter((action) => {
      const searchableText =
        `${action.id} ${action.actionTitle} ${action.description} ${action.serviceName}`.toLowerCase();

      // Check original search term
      if (searchableText.includes(searchLower)) return true;

      // Check extracted keywords
      return keywords.some((keyword) => searchableText.includes(keyword));
    });

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
        keywords: keywords.slice(0, 5), // Show top 5 keywords used
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
