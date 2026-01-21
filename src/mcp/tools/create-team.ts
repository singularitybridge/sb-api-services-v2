/**
 * Create Team Tool
 *
 * Creates a new team for the authenticated company
 */

import { z } from 'zod';
import { Team } from '../../models/Team';

/**
 * Input schema for the create_team tool
 */
export const createTeamSchema = z.object({
  name: z.string().describe('Name of the team'),
  description: z.string().describe('Description of the team'),
  icon: z
    .string()
    .optional()
    .describe(
      'Icon for the team. For emoji type: an emoji character. For lucide type: a Lucide icon name (e.g., "users", "folder"). For workspace type: a workspace file path.',
    ),
  iconType: z
    .enum(['emoji', 'lucide', 'workspace'])
    .optional()
    .describe(
      'Type of icon: "emoji" (default) for emoji characters, "lucide" for Lucide icon names, "workspace" for workspace file paths',
    ),
});

export type CreateTeamInput = z.infer<typeof createTeamSchema>;

/**
 * Create a new team
 */
export async function createTeam(
  input: CreateTeamInput,
  companyId: string,
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const team = new Team({
      name: input.name,
      description: input.description,
      icon: input.icon,
      iconType: input.iconType || 'emoji',
      companyId,
    });

    await team.save();

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
    console.error('MCP create team error:', error);

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
                  : 'Failed to create team',
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
export const createTeamTool = {
  name: 'create_team',
  description:
    'Create a new team for organizing agents. Supports emoji, Lucide icons, or workspace file paths for team icons. Returns the created team details including ID.',
  inputSchema: createTeamSchema,
};
