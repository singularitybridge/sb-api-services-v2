/**
 * List Agents Tool
 *
 * Lists all AI assistants/agents for the authenticated company
 */

import { z } from 'zod';
import { Assistant } from '../../models/Assistant';

/**
 * Input schema for the list_agents tool
 */
export const listAgentsSchema = z.object({
  limit: z
    .number()
    .optional()
    .describe('Maximum number of agents to return (default: 50)'),
  offset: z
    .number()
    .optional()
    .describe('Number of agents to skip for pagination (default: 0)'),
});

export type ListAgentsInput = z.infer<typeof listAgentsSchema>;

/**
 * List all agents for a company
 */
export async function listAgents(
  input: ListAgentsInput,
  companyId: string,
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const limit = input.limit || 50;
    const offset = input.offset || 0;

    const agents = await Assistant.find({ companyId })
      .select(
        '_id assistantId name description llmProvider llmModel maxTokens teams lastAccessedAt',
      )
      .limit(limit)
      .skip(offset)
      .sort({ name: 1 })
      .lean();

    const total = await Assistant.countDocuments({ companyId });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              agents: agents.map((agent) => ({
                id: agent._id.toString(),
                assistantId: agent.assistantId,
                name: agent.name,
                description: agent.description,
                llmProvider: agent.llmProvider,
                llmModel: agent.llmModel,
                maxTokens: agent.maxTokens,
                teams: agent.teams?.map((t) => t.toString()) || [],
                lastAccessedAt: agent.lastAccessedAt,
              })),
              pagination: {
                total,
                limit,
                offset,
                hasMore: offset + limit < total,
              },
            },
            null,
            2,
          ),
        },
      ],
    };
  } catch (error) {
    console.error('MCP list agents error:', error);

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
                  : 'Failed to list agents',
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
export const listAgentsTool = {
  name: 'list_agents',
  description:
    'List all AI agents/assistants for the authenticated company. Returns agent ID, name, description, LLM provider, model, max tokens, and team associations.',
  inputSchema: listAgentsSchema,
};
