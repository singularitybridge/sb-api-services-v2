/**
 * Get Team Tool
 *
 * Gets a single team by ID
 */

import { z } from 'zod';
import { getTeamById } from '../../services/team.service';

/**
 * Input schema for the get_team tool
 */
export const getTeamSchema = z.object({
  teamId: z.string().describe('The ID of the team to retrieve'),
});

export type GetTeamInput = z.infer<typeof getTeamSchema>;

/**
 * Get a team by ID
 */
export async function getTeam(
  input: GetTeamInput,
  companyId: string,
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const team = await getTeamById(input.teamId);

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

    // Verify team belongs to the company
    if (team.companyId.toString() !== companyId) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                error: true,
                message: 'Access denied: Team belongs to a different company',
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
              team: {
                id: team._id.toString(),
                name: team.name,
                description: team.description,
                icon: team.icon,
                iconType: team.iconType,
              },
            },
            null,
            2,
          ),
        },
      ],
    };
  } catch (error) {
    console.error('MCP get team error:', error);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              error: true,
              message:
                error instanceof Error ? error.message : 'Failed to get team',
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
export const getTeamTool = {
  name: 'get_team',
  description:
    'Get detailed information about a specific team by its ID, including name, description, icon, and icon type.',
  inputSchema: getTeamSchema,
};
