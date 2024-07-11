import express from 'express';
import { handleOnboarding } from '../services/onboarding.service';

const onboardingRouter = express.Router();

onboardingRouter.post('/', async (req, res) => {
  try {
    const { current_user, name, description } = req.body;
    const result = await handleOnboarding(current_user, name, description);
    res.json(result);
  } catch (error) {
    console.error('Onboarding error:', error);
    res.status(500).json({ error: 'Failed to complete onboarding' });
  }
});

export { onboardingRouter };
