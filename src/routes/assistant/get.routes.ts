import { Router } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import {
  getAssistants,
  getAssistantById,
} from '../../services/assistant/assistant-management.service';
import { getAssistantsByTeam, getTeamById } from '../../services/team.service';
import { Assistant } from '../../models/Assistant';
import { validateObjectId } from '../../utils/validation';

const router = Router();

router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const sortBy = (req.query.sortBy as string) || 'name';
    const companyId = req.user!.companyId.toString();

    let assistants;
    if (sortBy === 'lastUsed') {
      assistants = await Assistant.find({ companyId })
        .sort({ lastAccessedAt: -1, name: 1 })
        .lean();
    } else {
      assistants = await Assistant.find({ companyId }).sort({ name: 1 }).lean();
    }

    res.send(assistants);
  } catch (error) {
    console.error('Error retrieving assistants:', error);
    res.status(500).send({ message: 'Error retrieving assistants' });
  }
});

router.get(
  '/:id',
  validateObjectId('id'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const assistant = await getAssistantById(req.params.id);
      if (!assistant) {
        return res.status(404).send({ message: 'Assistant not found' });
      }

      // Check if the assistant belongs to the user's company or if the user is an Admin
      if (
        req.user?.role !== 'Admin' &&
        assistant.companyId.toString() !== req.user?.companyId.toString()
      ) {
        return res.status(403).send({ message: 'Access denied' });
      }

      res.send(assistant);
    } catch (error) {
      console.error('Error retrieving assistant:', error);
      res.status(500).send({ message: 'Error retrieving assistant' });
    }
  },
);

// Get assistants by team
router.get('/by-team/:teamId', async (req: AuthenticatedRequest, res) => {
  try {
    const { teamId } = req.params;

    // Verify the team belongs to the user's company
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

    const assistants = await getAssistantsByTeam(teamId);
    res.send(assistants);
  } catch (error) {
    console.error('Error retrieving assistants by team:', error);
    res.status(500).send({ message: 'Error retrieving assistants by team' });
  }
});

export default router;
