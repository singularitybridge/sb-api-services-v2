/**
 * Delete Team Tool
 *
 * Deletes a team and removes it from all agents
 */

import { z } from 'zod';
import {
  getTeamById,
  deleteTeam as deleteTeamService,
} from '../../services/team.service';

/**
 * Input schema for the delete_team tool
 */
export const deleteTeamSchema = z.object({
  teamId: z.string().describe('The ID of the team to delete'),
});

export type DeleteTeamInput = z.infer<typeof deleteTeamSchema>;

/**
 * Delete a team
 */
export async function deleteTeam(
  input: DeleteTeamInput,
  companyId: string,
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    // Verify team exists and belongs to the company
    const existingTeam = await getTeamById(input.teamId);
    if (!existingTeam) {
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

    if (existingTeam.companyId.toString() !== companyId) {
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

    // Delete the team (service also removes it from all agents)
    await deleteTeamService(input.teamId);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              message: `Team "${existingTeam.name}" deleted successfully`,
              deletedTeamId: input.teamId,
            },
            null,
            2,
          ),
        },
      ],
    };
  } catch (error) {
    console.error('MCP delete team error:', error);

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
                  : 'Failed to delete team',
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
export const deleteTeamTool = {
  name: 'delete_team',
  description:
    'Delete a team. This will also remove the team from all agents that reference it. This action cannot be undone.',
  inputSchema: deleteTeamSchema,
};
