/**
 * Trigger Integration Action Tool
 *
 * Executes any integration action for testing/debugging purposes
 */

import { z } from 'zod';
import { triggerIntegrationAction as triggerAction } from '../../integrations/debug/debug.service';
import { Session } from '../../models/Session';
import { Assistant } from '../../models/Assistant';

/**
 * Input schema for the trigger_integration_action tool
 */
export const triggerIntegrationActionSchema = z.object({
  integrationName: z
    .string()
    .describe(
      'The name of the integration to trigger (e.g., "jira", "openai", "sendgrid")',
    ),
  actionName: z
    .string()
    .describe(
      'The action/service name within the integration (e.g., "createIssue", "searchIssues")',
    ),
  requestData: z
    .any()
    .describe(
      'The request data/parameters for the action. Can be a JSON object or string.',
    ),
  sessionId: z
    .string()
    .optional()
    .describe(
      'Optional session ID to use for execution context. If not provided, a temporary session will be created.',
    ),
});

export type TriggerIntegrationActionInput = z.infer<
  typeof triggerIntegrationActionSchema
>;

/**
 * Create a temporary session for MCP action execution
 */
async function getOrCreateSession(
  companyId: string,
  userId: string,
  providedSessionId?: string,
): Promise<string> {
  // If session ID provided, verify it exists
  if (providedSessionId) {
    const existingSession = await Session.findById(providedSessionId);
    if (existingSession && existingSession.companyId.toString() === companyId) {
      return providedSessionId;
    }
  }

  // Find an existing active session for this user
  const existingSession = await Session.findOne({
    userId,
    companyId,
    active: true,
  }).sort({ createdAt: -1 });

  if (existingSession) {
    return existingSession._id.toString();
  }

  // Create a temporary session using the first available assistant
  const assistant = await Assistant.findOne({ companyId }).sort({
    createdAt: -1,
  });

  if (!assistant) {
    throw new Error(
      'No assistant found for this company. Please create an assistant first.',
    );
  }

  const newSession = await Session.create({
    userId,
    assistantId: assistant._id,
    threadId: `mcp-debug-${Date.now()}`,
    active: true,
    companyId,
    language: 'en',
  });

  return newSession._id.toString();
}

/**
 * Trigger an integration action for testing
 */
export async function triggerIntegrationAction(
  input: TriggerIntegrationActionInput,
  companyId: string,
  userId: string,
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    // Get or create a session for execution
    const sessionId = await getOrCreateSession(
      companyId,
      userId,
      input.sessionId,
    );

    // Parse request data if it's a string
    let parsedData = input.requestData;
    if (typeof input.requestData === 'string') {
      try {
        parsedData = JSON.parse(input.requestData);
      } catch {
        // Keep as string if not valid JSON
        parsedData = input.requestData;
      }
    }

    // Trigger the action
    const result = await triggerAction(
      sessionId,
      companyId,
      input.integrationName,
      input.actionName,
      parsedData,
    );

    if (!result.success) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                error: true,
                message: result.error || 'Action execution failed',
                integration: input.integrationName,
                action: input.actionName,
              },
              null,
              2,
            ),
          },
        ],
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              message: `Successfully executed ${input.integrationName}.${input.actionName}`,
              integration: input.integrationName,
              action: input.actionName,
              sessionId,
              result: result.data,
            },
            null,
            2,
          ),
        },
      ],
    };
  } catch (error) {
    console.error('MCP trigger integration action error:', error);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              error: true,
              message:
                error instanceof Error
                  ? error.message
                  : 'Failed to trigger integration action',
              integration: input.integrationName,
              action: input.actionName,
            },
            null,
            2,
          ),
        },
      ],
    };
  }
}

/**
 * Tool metadata for registration
 */
export const triggerIntegrationActionTool = {
  name: 'trigger_integration_action',
  description:
    'Execute any integration action for testing and debugging. Specify the integration name, action name, and request data. Returns the action result or error details. Use list_integrations and get_integration_details to discover available actions.',
  inputSchema: triggerIntegrationActionSchema,
};
