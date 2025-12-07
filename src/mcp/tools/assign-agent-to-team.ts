/**
 * Assign Agent to Team Tool
 *
 * Assigns an existing agent to one or more teams
 */

import { z } from 'zod';
import { Assistant } from '../../models/Assistant';
import { Team } from '../../models/Team';
import mongoose from 'mongoose';
import { resolveAssistantIdentifier } from '../../services/assistant/assistant-resolver.service';

/**
 * Input schema for the assign_agent_to_team tool
 */
export const assignAgentToTeamSchema = z.object({
  agentId: z.string().describe('Agent ID, name, or URL to assign'),
  teamIds: z
    .array(z.string())
    .describe('Array of team IDs to assign the agent to'),
  append: z
    .boolean()
    .optional()
    .describe(
      'If true, append to existing teams. If false, replace teams (default: true)',
    ),
});

export type AssignAgentToTeamInput = z.infer<typeof assignAgentToTeamSchema>;

/**
 * Assign agent to teams
 */
export async function assignAgentToTeam(
  input: AssignAgentToTeamInput,
  companyId: string,
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    // Resolve agent by ID, name, or URL
    const agent = await resolveAssistantIdentifier(input.agentId, companyId);

    if (!agent) {
      throw new Error(`Agent not found: ${input.agentId}`);
    }

    // Verify all team IDs exist and belong to the company
    const teamObjectIds = input.teamIds.map(
      (id) => new mongoose.Types.ObjectId(id),
    );
    const teams = await Team.find({
      _id: { $in: teamObjectIds },
      companyId,
    });

    if (teams.length !== input.teamIds.length) {
      throw new Error(
        'One or more team IDs are invalid or do not belong to your company',
      );
    }

    // Update agent's teams
    const append = input.append !== false; // Default to true
    if (append) {
      // Append to existing teams (avoid duplicates)
      const existingTeams = agent.teams || [];
      const newTeams = teamObjectIds.filter(
        (teamId) =>
          !existingTeams.some(
            (existing) => existing.toString() === teamId.toString(),
          ),
      );
      agent.teams = [...existingTeams, ...newTeams] as any;
    } else {
      // Replace teams
      agent.teams = teamObjectIds as any;
    }

    await agent.save();

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              agent: {
                id: agent._id.toString(),
                name: agent.name,
                teams: agent.teams?.map((t) => t.toString()) || [],
              },
              operation: append ? 'appended' : 'replaced',
              assignedTeams: teams.map((t) => ({
                id: t._id.toString(),
                name: t.name,
              })),
            },
            null,
            2,
          ),
        },
      ],
    };
  } catch (error) {
    console.error('MCP assign agent to team error:', error);

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
                  : 'Failed to assign agent to team',
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
export const assignAgentToTeamTool = {
  name: 'assign_agent_to_team',
  description:
    'Assign an agent to one or more teams. Can append to existing teams or replace them. Returns the updated agent with team assignments.',
  inputSchema: assignAgentToTeamSchema,
};
