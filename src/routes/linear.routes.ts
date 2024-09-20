import { Router } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import * as linearService from '../services/linear.service';
import { validateApiKeys } from '../services/api.key.service';

const router = Router();

router.use(validateApiKeys(['linear']));

router.get('/issues', async (req: AuthenticatedRequest, res) => {
  try {
    const issues = await linearService.fetchIssues(req.company._id, 10);
    res.json(issues);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching issues' });
  }
});

router.post('/issues', async (req: AuthenticatedRequest, res) => {
  try {
    const { title, description, teamId } = req.body;
    const newIssue = await linearService.createIssue(req.company._id, title, description, teamId);
    res.status(201).json(newIssue);
  } catch (error) {
    res.status(500).json({ error: 'Error creating issue' });
  }
});

router.put('/issues/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { title, status } = req.body;
    await linearService.updateIssue(req.company._id, id, { title, status });
    res.status(200).json({ message: 'Issue updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Error updating issue' });
  }
});

router.delete('/issues/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    await linearService.deleteIssue(req.company._id, id);
    res.status(200).json({ message: 'Issue deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting issue' });
  }
});

router.get('/issues/all', async (req: AuthenticatedRequest, res) => {
  try {
    const allIssues = await linearService.fetchAllIssues(req.company._id);
    res.json(allIssues);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching all issues' });
  }
});

router.get('/issues/user/:userId', async (req: AuthenticatedRequest, res) => {
  try {
    const { userId } = req.params;
    const issues = await linearService.fetchIssuesByUser(req.company._id, userId);
    res.json(issues);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching issues by user' });
  }
});

router.get('/issues/recent/:days', async (req: AuthenticatedRequest, res) => {
  try {
    const { days } = req.params;
    const issues = await linearService.fetchIssuesByDate(req.company._id, parseInt(days, 10));
    res.json(issues);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching issues by date' });
  }
});

router.get('/users', async (req: AuthenticatedRequest, res) => {
  try {
    const users = await linearService.fetchUserList(req.company._id);
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching user list' });
  }
});

router.get('/issues/statuses', async (req: AuthenticatedRequest, res) => {
  try {
    const statuses = await linearService.fetchIssueStatuses(req.company._id);
    res.json(statuses);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching issue statuses' });
  }
});

export default router;