/**
 * Get Agent Prompt Tool
 *
 * Retrieves the system prompt for a specific agent (supports ID or name)
 */

import { z } from 'zod';
import { resolveAssistantIdentifier } from '../../services/assistant/assistant-resolver.service';

/**
 * Input schema for the get_agent_prompt tool
 */
export const getAgentPromptSchema = z.object({
  agentId: z
    .string()
    .describe(
      'The ID or name of the agent to get the prompt for (e.g., "681b41850f470a9a746f280e" or "workspace-agent")',
    ),
});

export type GetAgentPromptInput = z.infer<typeof getAgentPromptSchema>;

/**
 * Get an agent's system prompt
 */
export async function getAgentPrompt(
  input: GetAgentPromptInput,
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

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              agent: {
                id: agent._id.toString(),
                name: agent.name,
                description: agent.description,
              },
              prompt: agent.llmPrompt || '',
            },
            null,
            2,
          ),
        },
      ],
    };
  } catch (error) {
    console.error('MCP get agent prompt error:', error);

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
                  : 'Failed to get agent prompt',
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
export const getAgentPromptTool = {
  name: 'get_agent_prompt',
  description:
    "Get the system prompt for a specific AI agent. Supports lookup by agent ID or name. Returns the agent's current system prompt/instructions.",
  inputSchema: getAgentPromptSchema,
};
