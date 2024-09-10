import { Router } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { LinearService } from '../services/linear.service';
import { getApiKey, validateApiKeys } from '../services/api.key.service';

const router = Router();

router.use(validateApiKeys(['linear']));

router.get('/issues', async (req: AuthenticatedRequest, res) => {
  try {
    const apiKey = await getApiKey(req.company._id, 'linear');
    if (!apiKey) {
      return res.status(400).json({ error: 'Linear API key not found' });
    }
    const linearService = new LinearService(apiKey);
    const issues = await linearService.fetchIssues(10);
    res.json(issues);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching issues' });
  }
});

router.post('/issues', async (req: AuthenticatedRequest, res) => {
  try {
    const apiKey = await getApiKey(req.company._id, 'linear');
    if (!apiKey) {
      return res.status(400).json({ error: 'Linear API key not found' });
    }
    const linearService = new LinearService(apiKey);
    const { title, description, teamId } = req.body;
    const newIssue = await linearService.createIssue(title, description, teamId);
    res.status(201).json(newIssue);
  } catch (error) {
    res.status(500).json({ error: 'Error creating issue' });
  }
});

router.put('/issues/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const apiKey = await getApiKey(req.company._id, 'linear');
    if (!apiKey) {
      return res.status(400).json({ error: 'Linear API key not found' });
    }
    const linearService = new LinearService(apiKey);
    const { id } = req.params;
    const { title, state } = req.body;
    await linearService.updateIssue(id, { title, state });
    res.status(200).json({ message: 'Issue updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Error updating issue' });
  }
});

router.delete('/issues/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const apiKey = await getApiKey(req.company._id, 'linear');
    if (!apiKey) {
      return res.status(400).json({ error: 'Linear API key not found' });
    }
    const linearService = new LinearService(apiKey);
    const { id } = req.params;
    await linearService.deleteIssue(id);
    res.status(200).json({ message: 'Issue deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting issue' });
  }
});

router.get('/issues/all', async (req: AuthenticatedRequest, res) => {
  try {
    const apiKey = await getApiKey(req.company._id, 'linear');
    if (!apiKey) {
      return res.status(400).json({ error: 'Linear API key not found' });
    }
    const linearService = new LinearService(apiKey);
    const allIssues = await linearService.fetchAllIssues();
    res.json(allIssues);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching all issues' });
  }
});

// New route: Fetch Issues by User
router.get('/issues/user/:userId', async (req: AuthenticatedRequest, res) => {
  try {
    const apiKey = await getApiKey(req.company._id, 'linear');
    if (!apiKey) {
      return res.status(400).json({ error: 'Linear API key not found' });
    }
    const linearService = new LinearService(apiKey);
    const { userId } = req.params;
    const issues = await linearService.fetchIssuesByUser(userId);
    res.json(issues);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching issues by user' });
  }
});

// New route: Fetch Issues by Date
router.get('/issues/recent/:days', async (req: AuthenticatedRequest, res) => {
  try {
    const apiKey = await getApiKey(req.company._id, 'linear');
    if (!apiKey) {
      return res.status(400).json({ error: 'Linear API key not found' });
    }
    const linearService = new LinearService(apiKey);
    const { days } = req.params;
    const issues = await linearService.fetchIssuesByDate(parseInt(days, 10));
    res.json(issues);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching issues by date' });
  }
});

// New route: Fetch User List
router.get('/users', async (req: AuthenticatedRequest, res) => {
  try {
    const apiKey = await getApiKey(req.company._id, 'linear');
    if (!apiKey) {
      return res.status(400).json({ error: 'Linear API key not found' });
    }
    const linearService = new LinearService(apiKey);
    const users = await linearService.fetchUserList();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching user list' });
  }
});

export default router;