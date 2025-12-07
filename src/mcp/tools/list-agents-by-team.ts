/**
 * List Agents By Team Tool
 *
 * Lists AI assistants/agents that belong to a specific team
 */

import { z } from 'zod';
import { Assistant } from '../../models/Assistant';
import { Team } from '../../models/Team';
import mongoose from 'mongoose';

/**
 * Input schema for the list_agents_by_team tool
 */
export const listAgentsByTeamSchema = z.object({
  teamId: z.string().describe('The ID of the team to list agents for'),
  limit: z
    .number()
    .optional()
    .describe('Maximum number of agents to return (default: 50)'),
  offset: z
    .number()
    .optional()
    .describe('Number of agents to skip for pagination (default: 0)'),
});

export type ListAgentsByTeamInput = z.infer<typeof listAgentsByTeamSchema>;

/**
 * List all agents for a specific team
 */
export async function listAgentsByTeam(
  input: ListAgentsByTeamInput,
  companyId: string,
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const limit = input.limit || 50;
    const offset = input.offset || 0;

    // Validate team exists and belongs to company
    const team = await Team.findOne({
      _id: new mongoose.Types.ObjectId(input.teamId),
      companyId,
    });

    if (!team) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                error: true,
                message: `Team not found: ${input.teamId}`,
              },
              null,
              2,
            ),
          },
        ],
      };
    }

    const agents = await Assistant.find({
      companyId,
      teams: new mongoose.Types.ObjectId(input.teamId),
    })
      .select(
        '_id assistantId name description llmProvider llmModel maxTokens teams lastAccessedAt',
      )
      .limit(limit)
      .skip(offset)
      .sort({ name: 1 })
      .lean();

    const total = await Assistant.countDocuments({
      companyId,
      teams: new mongoose.Types.ObjectId(input.teamId),
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              team: {
                id: team._id.toString(),
                name: team.name,
                description: team.description,
              },
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
    console.error('MCP list agents by team error:', error);

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
                  : 'Failed to list agents by team',
              teamId: input.teamId,
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
export const listAgentsByTeamTool = {
  name: 'list_agents_by_team',
  description:
    'List all AI agents/assistants that belong to a specific team. Returns agent details including ID, name, description, LLM configuration, and team associations.',
  inputSchema: listAgentsByTeamSchema,
};
