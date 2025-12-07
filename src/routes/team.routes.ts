import express from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import {
  getTeams,
  getTeamById,
  createTeam,
  updateTeam,
  deleteTeam,
  assignAssistantToTeam,
  removeAssistantFromTeam,
  getAssistantsByTeam,
} from '../services/team.service';
import { Team } from '../models/Team';

const router = express.Router();

// Get all teams for a company
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const teams = await getTeams(req.user!.companyId.toString());
    res.send(teams);
  } catch (error) {
    console.error('Error retrieving teams:', error);
    res.status(500).send({ message: 'Error retrieving teams' });
  }
});

// Get team by ID
router.get('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const team = await getTeamById(req.params.id);
    if (!team) {
      return res.status(404).send({ message: 'Team not found' });
    }

    // Check if the team belongs to the user's company or if the user is an Admin
    if (
      req.user?.role !== 'Admin' &&
      team.companyId.toString() !== req.user?.companyId.toString()
    ) {
      return res.status(403).send({ message: 'Access denied' });
    }

    res.send(team);
  } catch (error) {
    console.error('Error retrieving team:', error);
    res.status(500).send({ message: 'Error retrieving team' });
  }
});

// Create a new team
router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const teamData = {
      ...req.body,
      companyId: req.user?.companyId,
    };

    const team = await createTeam(teamData);
    res.status(201).send(team);
  } catch (error) {
    console.error('Error creating team:', error);
    res.status(500).send({ message: 'Error creating team' });
  }
});

// Update a team
router.put('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const teamData = req.body;

    // Ensure the team belongs to the user's company
    const team = await getTeamById(id);
    if (!team) {
      return res.status(404).send({ message: 'Team not found' });
    }

    if (
      req.user?.role !== 'Admin' &&
      team.companyId.toString() !== req.user?.companyId.toString()
    ) {
      return res.status(403).send({ message: 'Access denied' });
    }

    const updatedTeam = await updateTeam(id, teamData);
    res.send(updatedTeam);
  } catch (error) {
    console.error('Error updating team:', error);
    res.status(500).send({ message: 'Error updating team' });
  }
});

// Delete a team
router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    // Ensure the team belongs to the user's company
    const team = await getTeamById(id);
    if (!team) {
      return res.status(404).send({ message: 'Team not found' });
    }

    if (
      req.user?.role !== 'Admin' &&
      team.companyId.toString() !== req.user?.companyId.toString()
    ) {
      return res.status(403).send({ message: 'Access denied' });
    }

    await deleteTeam(id);
    res.send({ message: 'Team deleted successfully' });
  } catch (error) {
    console.error('Error deleting team:', error);
    res.status(500).send({ message: 'Error deleting team' });
  }
});

// Get assistants by team
router.get('/:id/assistants', async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    // Ensure the team belongs to the user's company
    const team = await getTeamById(id);
    if (!team) {
      return res.status(404).send({ message: 'Team not found' });
    }

    if (
      req.user?.role !== 'Admin' &&
      team.companyId.toString() !== req.user?.companyId.toString()
    ) {
      return res.status(403).send({ message: 'Access denied' });
    }

    const assistants = await getAssistantsByTeam(id);
    res.send(assistants);
  } catch (error) {
    console.error('Error retrieving assistants by team:', error);
    res.status(500).send({ message: 'Error retrieving assistants by team' });
  }
});

// Assign assistant to team
router.post(
  '/:teamId/assistants/:assistantId',
  async (req: AuthenticatedRequest, res) => {
    try {
      const { teamId, assistantId } = req.params;

      // Ensure the team belongs to the user's company
      const team = await getTeamById(teamId);
      if (!team) {
        return res.status(404).send({ message: 'Team not found' });
      }

      if (
        req.user?.role !== 'Admin' &&
        team.companyId.toString() !== req.user?.companyId.toString()
      ) {
        return res.status(403).send({ message: 'Access denied' });
      }

      await assignAssistantToTeam(assistantId, teamId);
      res.send({ message: 'Assistant assigned to team successfully' });
    } catch (error) {
      console.error('Error assigning assistant to team:', error);
      res.status(500).send({ message: 'Error assigning assistant to team' });
    }
  },
);

// Remove assistant from team
router.delete(
  '/:teamId/assistants/:assistantId',
  async (req: AuthenticatedRequest, res) => {
    try {
      const { teamId, assistantId } = req.params;

      // Ensure the team belongs to the user's company
      const team = await getTeamById(teamId);
      if (!team) {
        return res.status(404).send({ message: 'Team not found' });
      }

      if (
        req.user?.role !== 'Admin' &&
        team.companyId.toString() !== req.user?.companyId.toString()
      ) {
        return res.status(403).send({ message: 'Access denied' });
      }

      await removeAssistantFromTeam(assistantId, teamId);
      res.send({ message: 'Assistant removed from team successfully' });
    } catch (error) {
      console.error('Error removing assistant from team:', error);
      res.status(500).send({ message: 'Error removing assistant from team' });
    }
  },
);

export { router as teamRouter };
