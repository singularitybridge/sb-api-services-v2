/**
 * Delete Agent Tool
 *
 * Deletes an AI agent/assistant
 */

import { z } from 'zod';
import { Assistant } from '../../models/Assistant';
import { resolveAssistantIdentifier } from '../../services/assistant/assistant-resolver.service';

/**
 * Input schema for the delete_agent tool
 */
export const deleteAgentSchema = z.object({
  agentId: z.string().describe('Agent ID, name, or URL to delete'),
});

export type DeleteAgentInput = z.infer<typeof deleteAgentSchema>;

/**
 * Delete an agent
 */
export async function deleteAgent(
  input: DeleteAgentInput,
  companyId: string,
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
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

    // Delete the agent
    await Assistant.findByIdAndDelete(agent._id);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              message: `Agent "${agent.name}" deleted successfully`,
              deletedAgentId: agent._id.toString(),
            },
            null,
            2,
          ),
        },
      ],
    };
  } catch (error) {
    console.error('MCP delete agent error:', error);

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
                  : 'Failed to delete agent',
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
export const deleteAgentTool = {
  name: 'delete_agent',
  description:
    'Delete an AI agent/assistant. The agent can be specified by ID, name, or URL. This action cannot be undone.',
  inputSchema: deleteAgentSchema,
};
