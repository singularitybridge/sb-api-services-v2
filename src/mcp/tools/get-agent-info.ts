/**
 * Get Agent Info Tool
 *
 * Retrieves basic information about a specific agent
 */

import { z } from 'zod';
import { resolveAssistantIdentifier } from '../../services/assistant/assistant-resolver.service';

/**
 * Input schema for the get_agent_info tool
 */
export const getAgentInfoSchema = z.object({
  agentId: z
    .string()
    .describe(
      'The ID or name of the agent to get info for (e.g., "681b41850f470a9a746f280e" or "workspace-agent")',
    ),
});

export type GetAgentInfoInput = z.infer<typeof getAgentInfoSchema>;

/**
 * Get basic agent information
 */
export async function getAgentInfo(
  input: GetAgentInfoInput,
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
              id: agent._id.toString(),
              assistantId: agent.assistantId,
              name: agent.name,
              description: agent.description,
              llmProvider: agent.llmProvider,
              llmModel: agent.llmModel,
              maxTokens: agent.maxTokens,
              voice: agent.voice,
              language: agent.language,
              teams: agent.teams?.map((t) => t.toString()) || [],
              allowedActions: agent.allowedActions || [],
              avatarImage: agent.avatarImage,
              lastAccessedAt: agent.lastAccessedAt,
            },
            null,
            2,
          ),
        },
      ],
    };
  } catch (error) {
    console.error('MCP get agent info error:', error);

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
                  : 'Failed to get agent info',
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
export const getAgentInfoTool = {
  name: 'get_agent_info',
  description:
    'Get basic information about a specific AI agent including ID, name, description, LLM provider, model, max tokens, and configuration. Supports lookup by agent ID or name.',
  inputSchema: getAgentInfoSchema,
};
