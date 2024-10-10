import { Router } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { getAssistants } from '../../services/assistant.service';
import { Assistant } from '../../models/Assistant';

const router = Router();

router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const assistants = await getAssistants(req.user!.companyId.toString());
    res.send(assistants);
  } catch (error) {
    res.status(500).send({ message: 'Error retrieving assistants' });
  }
});

router.get('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const assistant = await Assistant.findOne({
      _id: req.params.id,
      companyId:
        req.user?.role === 'Admin' ? { $exists: true } : req.user?.companyId,
    });
    if (!assistant) {
      return res.status(404).send({ message: 'Assistant not found' });
    }
    res.send(assistant);
  } catch (error) {
    res.status(500).send({ message: 'Error retrieving assistant' });
  }
});

export default router;
