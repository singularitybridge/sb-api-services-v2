/**
 * Update Team Tool
 *
 * Updates an existing team's attributes
 */

import { z } from 'zod';
import {
  getTeamById,
  updateTeam as updateTeamService,
} from '../../services/team.service';

/**
 * Input schema for the update_team tool
 */
export const updateTeamSchema = z.object({
  teamId: z.string().describe('The ID of the team to update'),
  name: z.string().optional().describe('New name for the team'),
  description: z.string().optional().describe('New description for the team'),
  icon: z
    .string()
    .optional()
    .describe(
      'New icon for the team. For emoji type: an emoji character. For lucide type: a Lucide icon name. For workspace type: a workspace file path.',
    ),
  iconType: z
    .enum(['emoji', 'lucide', 'workspace'])
    .optional()
    .describe('Type of icon: "emoji", "lucide", or "workspace"'),
});

export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;

/**
 * Update an existing team
 */
export async function updateTeam(
  input: UpdateTeamInput,
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

    // Build update object with only provided fields
    const updateData: Partial<{
      name: string;
      description: string;
      icon: string;
      iconType: 'emoji' | 'lucide' | 'workspace';
    }> = {};

    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined)
      updateData.description = input.description;
    if (input.icon !== undefined) updateData.icon = input.icon;
    if (input.iconType !== undefined) updateData.iconType = input.iconType;

    const updatedTeam = await updateTeamService(input.teamId, updateData);

    if (!updatedTeam) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                error: true,
                message: 'Failed to update team',
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
                id: updatedTeam._id.toString(),
                name: updatedTeam.name,
                description: updatedTeam.description,
                icon: updatedTeam.icon,
                iconType: updatedTeam.iconType,
              },
            },
            null,
            2,
          ),
        },
      ],
    };
  } catch (error) {
    console.error('MCP update team error:', error);

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
                  : 'Failed to update team',
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
export const updateTeamTool = {
  name: 'update_team',
  description:
    "Update an existing team's attributes including name, description, icon, and icon type. Only provided fields will be updated.",
  inputSchema: updateTeamSchema,
};
