import express from 'express';
import { getOnboardingStatus, updateOnboardingStatus } from '../services/onboarding.service';
import { verifyTokenMiddleware, AuthenticatedRequest } from '../middleware/auth.middleware';
import { updateCompanyOnboarding } from '../services/company.service';

const onboardingRouter = express.Router();

onboardingRouter.get('/status', verifyTokenMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const companyId = req.company._id;
    const onboardingStatus = await getOnboardingStatus(companyId);
    res.json(onboardingStatus);
  } catch (error) {
    console.error('Error fetching onboarding status:', error);
    if (error instanceof Error) {
      res.status(error.name === 'NotFoundError' ? 404 : 500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'An unexpected error occurred' });
    }
  }
});

onboardingRouter.post('/refresh', verifyTokenMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const companyId = req.company._id;
    const updatedCompany = await updateOnboardingStatus(companyId);
    res.json({
      onboardingStatus: updatedCompany.onboardingStatus,
      onboardedModules: updatedCompany.onboardedModules
    });
  } catch (error) {
    console.error('Error refreshing onboarding status:', error);
    if (error instanceof Error) {
      res.status(error.name === 'NotFoundError' ? 404 : 500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'An unexpected error occurred' });
    }
  }
});

onboardingRouter.post('/update-info', verifyTokenMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const companyId = req.company._id;
    const { companyName, companyDescription, userNickname } = req.body;
    
    const updatedCompany = await updateCompanyOnboarding(companyId, {
      name: companyName,
      description: companyDescription,
      userNickname: userNickname
    });

    res.json({
      message: 'Onboarding information updated successfully',
      company: {
        name: updatedCompany.name,
        description: updatedCompany.description,
        onboardingStatus: updatedCompany.onboardingStatus,
        onboardedModules: updatedCompany.onboardedModules
      }
    });
  } catch (error) {
    console.error('Error updating onboarding information:', error);
    if (error instanceof Error) {
      res.status(error.name === 'NotFoundError' ? 404 : 500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'An unexpected error occurred' });
    }
  }
});

export { onboardingRouter };
