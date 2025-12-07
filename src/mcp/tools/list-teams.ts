/**
 * List Teams Tool
 *
 * Lists all teams for the authenticated company
 */

import { z } from 'zod';
import { Team } from '../../models/Team';

/**
 * Input schema for the list_teams tool
 */
export const listTeamsSchema = z.object({
  limit: z
    .number()
    .optional()
    .describe('Maximum number of teams to return (default: 50)'),
  offset: z
    .number()
    .optional()
    .describe('Number of teams to skip for pagination (default: 0)'),
});

export type ListTeamsInput = z.infer<typeof listTeamsSchema>;

/**
 * List all teams for a company
 */
export async function listTeams(
  input: ListTeamsInput,
  companyId: string,
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const limit = input.limit || 50;
    const offset = input.offset || 0;

    const teams = await Team.find({ companyId })
      .select('_id name description icon')
      .limit(limit)
      .skip(offset)
      .sort({ name: 1 })
      .lean();

    const total = await Team.countDocuments({ companyId });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              teams: teams.map((team) => ({
                id: team._id.toString(),
                name: team.name,
                description: team.description,
                icon: team.icon,
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
    console.error('MCP list teams error:', error);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              error: true,
              message:
                error instanceof Error ? error.message : 'Failed to list teams',
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
export const listTeamsTool = {
  name: 'list_teams',
  description:
    'List all teams for the authenticated company. Returns team ID, name, description, and icon.',
  inputSchema: listTeamsSchema,
};
