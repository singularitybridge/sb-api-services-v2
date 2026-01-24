/**
 * Update Agent Actions Tool
 *
 * Enable or disable integration actions for a specific agent.
 * Supports setting, adding, or removing actions.
 */

import { z } from 'zod';
import { resolveAssistantIdentifier } from '../../services/assistant/assistant-resolver.service';
import { updateAllowedActions } from '../../services/allowed-actions.service';

/**
 * Input schema for the update_agent_actions tool
 */
export const updateAgentActionsSchema = z.object({
  agentId: z
    .string()
    .describe(
      'The ID or name of the agent to update (e.g., "681b41850f470a9a746f280e" or "workspace-agent")',
    ),
  setActions: z
    .array(z.string())
    .optional()
    .describe(
      'Set the agent\'s allowed actions to exactly this list (replaces all existing). Use action IDs like "jira.createTicket", "openai.webSearch"',
    ),
  addActions: z
    .array(z.string())
    .optional()
    .describe(
      'Add these actions to the agent\'s existing allowed actions. Use action IDs like "jira.createTicket", "openai.webSearch"',
    ),
  removeActions: z
    .array(z.string())
    .optional()
    .describe(
      "Remove these actions from the agent's allowed actions. Use action IDs.",
    ),
});

export type UpdateAgentActionsInput = z.infer<typeof updateAgentActionsSchema>;

/**
 * Update an agent's allowed actions
 */
export async function updateAgentActions(
  input: UpdateAgentActionsInput,
  companyId: string,
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    // Validate that at least one operation is provided
    if (!input.setActions && !input.addActions && !input.removeActions) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                error: true,
                message:
                  'At least one of setActions, addActions, or removeActions must be provided',
              },
              null,
              2,
            ),
          },
        ],
      };
    }

    // Resolve agent by ID or name
    const agent = await resolveAssistantIdentifier(input.agentId, companyId);

    if (!agent) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                error: true,
                message: `Agent not found: ${input.agentId}`,
              },
              null,
              2,
            ),
          },
        ],
      };
    }

    // Get current actions
    let currentActions = agent.allowedActions || [];
    const originalActions = [...currentActions];

    // Apply operations in order: set > add > remove
    if (input.setActions) {
      // Replace all actions
      currentActions = [...input.setActions];
    }

    if (input.addActions) {
      // Add new actions (avoid duplicates)
      const actionsToAdd = input.addActions.filter(
        (a) => !currentActions.includes(a),
      );
      currentActions = [...currentActions, ...actionsToAdd];
    }

    if (input.removeActions) {
      // Remove specified actions
      currentActions = currentActions.filter(
        (a) => !input.removeActions!.includes(a),
      );
    }

    // Update the agent's allowed actions
    await updateAllowedActions(agent._id.toString(), currentActions);

    // Calculate what changed
    const added = currentActions.filter((a) => !originalActions.includes(a));
    const removed = originalActions.filter((a) => !currentActions.includes(a));

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              agent: {
                id: agent._id.toString(),
                name: agent.name,
              },
              allowedActions: currentActions,
              changes: {
                added: added.length > 0 ? added : undefined,
                removed: removed.length > 0 ? removed : undefined,
                totalActions: currentActions.length,
              },
              message: `Agent actions updated successfully. ${added.length} added, ${removed.length} removed.`,
            },
            null,
            2,
          ),
        },
      ],
    };
  } catch (error) {
    console.error('MCP update agent actions error:', error);

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
                  : 'Failed to update agent actions',
              agentId: input.agentId,
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
export const updateAgentActionsTool = {
  name: 'update_agent_actions',
  description:
    'Enable or disable integration actions for an AI agent. Use setActions to replace all actions, addActions to enable additional actions, or removeActions to disable specific actions. Action IDs are in the format "integrationId.actionName" (e.g., "jira.createTicket", "openai.webSearch"). Use list_integrations to see available actions.',
  inputSchema: updateAgentActionsSchema,
};
