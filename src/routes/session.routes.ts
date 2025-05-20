// File: src/routes/session.routes.ts
import { Router, Response, NextFunction } from 'express';
import { getSessionMessages } from '../services/assistant.service';
import { Session } from '../models/Session';
import {
  endSession,
  getSessionOrCreate,
  sessionFriendlyAggreationQuery,
  updateSessionAssistant,
  updateSessionLanguage,
} from '../services/session.service';
import mongoose from 'mongoose';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { getApiKey, validateApiKeys } from '../services/api.key.service';
import { BadRequestError } from '../utils/errors';
import { SupportedLanguage } from '../services/discovery.service';
import { ChannelType } from '../types/ChannelType'; // Added for ChannelType

const sessionRouter = Router();

// Update active session language
sessionRouter.put(
  '/language',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {    
    const { language } = req.body;
    const companyId = req.user?.companyId?.toString();
    const userId = req.user?._id?.toString();

    if (!companyId || !userId) {
      return next(new BadRequestError('User or Company ID not found in request.'));
    }
    if (!language || !['en', 'he'].includes(language)) {
      return res.status(400).json({ error: 'Invalid language. Supported languages are "en" and "he".' });
    }

    try {
      const activeSession = await Session.findOne({ 
        userId: new mongoose.Types.ObjectId(userId), 
        companyId: new mongoose.Types.ObjectId(companyId), 
        channel: ChannelType.WEB, // Assuming WEB channel for active session operations
        active: true 
      });

      if (!activeSession) {
        return res.status(404).json({ error: 'Active session not found.' });
      }

      const updatedSession = await updateSessionLanguage(activeSession._id.toString(), language as SupportedLanguage);
      if (updatedSession) {
        res.status(200).json({ message: 'Active session language updated successfully', language: updatedSession.language });
      } else {
        // This case should ideally not be hit if activeSession was found
        res.status(404).json({ error: 'Session not found during update.' });
      }
    } catch (error) {
      next(error);
    }
  }
);

// Get active session language
sessionRouter.get(
  '/language',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const companyId = req.user?.companyId?.toString();
    const userId = req.user?._id?.toString();

    if (!companyId || !userId) {
      return next(new BadRequestError('User or Company ID not found in request.'));
    }

    try {
      const activeSession = await Session.findOne({ 
        userId: new mongoose.Types.ObjectId(userId), 
        companyId: new mongoose.Types.ObjectId(companyId), 
        channel: ChannelType.WEB, // Assuming WEB channel
        active: true 
      });

      if (!activeSession) {
        return res.status(404).json({ error: 'Active session not found.' });
      }
      res.status(200).json({ language: activeSession.language });
    } catch (error) {
      next(error);
    }
  }
);

// Create session
sessionRouter.post(
  '/',
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const apiKey = await getApiKey(req.company._id, 'openai_api_key');
      
      if (!apiKey) {
        return res.status(200).json({
          message: 'OpenAI API key is not set. Please configure the API key to use this feature.',
          keyMissing: true
        });
      }

      const session = await getSessionOrCreate(
        apiKey, // This apiKey is for downstream services if needed by getSessionOrCreate, not for session creation itself.
        req.user?._id.toString() ?? '',
        req.user?.companyId.toString() ?? '',
        // Assuming ChannelType.WEB as default for this endpoint, can be parameterized if needed
      );
      res.status(200).json(session);
    } catch (error: unknown) {
      console.error('Error handling session:', error);

      if (error instanceof Error) {
        res
          .status(500)
          .json({ message: 'Error handling session', error: error.message });
      } else {
        res.status(500).json({ message: 'An unknown error occurred' });
      }
    }
  },
);

// Clear current session and start a new one
sessionRouter.post(
  '/clear',
  validateApiKeys(['openai_api_key']), 
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const companyId = req.user?.companyId?.toString();
      const userId = req.user?._id?.toString();

      if (!companyId || !userId) {
        throw new BadRequestError('User or Company ID not found in request.');
      }
      
      const apiKey = await getApiKey(companyId, 'openai_api_key');
      if (!apiKey) {
        throw new BadRequestError('Required API key (e.g., openai_api_key) not found for the company.');
      }

      // Find current active session for this user/company/channel (assuming ChannelType.WEB)
      const currentActiveSession = await Session.findOne({ 
        userId: new mongoose.Types.ObjectId(userId), 
        companyId: new mongoose.Types.ObjectId(companyId), 
        channel: ChannelType.WEB, // Assuming WEB channel for this operation
        active: true 
      });

      if (currentActiveSession) {
        console.log(`Clear Session: Ending existing active session ${currentActiveSession._id}`);
        await endSession(apiKey, currentActiveSession._id.toString());
      } else {
        console.log(`Clear Session: No existing active session found for user ${userId} in company ${companyId} on WEB channel.`);
      }

      // Create a new session
      const newSession = await getSessionOrCreate(
        apiKey,
        userId,
        companyId,
        ChannelType.WEB // Assuming WEB channel
      );
      
      res.status(200).json(newSession);
    } catch (error) {
      next(error);
    }
  }
);

// Get active session messages
sessionRouter.get(
  '/messages',
  validateApiKeys(['openai_api_key']),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const companyId = req.user?.companyId?.toString();
    const userId = req.user?._id?.toString();

    if (!companyId || !userId) {
      return next(new BadRequestError('User or Company ID not found in request.'));
    }
    
    const apiKey = await getApiKey(companyId, 'openai_api_key');
    if (!apiKey) {
      // Forward to error handler if API key is missing
      return next(new BadRequestError('API key not found for company.'));
    }

    try {
      const activeSession = await Session.findOne({ 
        userId: new mongoose.Types.ObjectId(userId), 
        companyId: new mongoose.Types.ObjectId(companyId), 
        channel: ChannelType.WEB, // Assuming WEB channel
        active: true 
      });

      if (!activeSession) {
        return res.status(404).json({ error: 'Active session not found.' });
      }
      
      const messages = await getSessionMessages(apiKey, activeSession._id.toString());
      res.status(200).send(messages);
    } catch (error) {
      console.error('Specific error in GET /session/messages:', error); // Added for debugging
      next(error); // Centralized error handling
    }
  }
);

// Get all sessions (admin only) - Placed before parameterized routes like /:id
sessionRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const sessions = await Session.find();
    res.status(200).send(sessions);
  } catch (error) {
    res.status(500).send({ error: 'Error getting sessions' });
  }
});

// Update session assistant (still requires :id as assistant is a property of a specific session)
sessionRouter.put(
  '/:id/assistant',
  validateApiKeys(['openai_api_key']),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { assistantId } = req.body;
    const companyId = req.user?.companyId;

    if (!companyId) {
      return res.status(400).send({ error: 'Company ID not found' });
    }

    try {
      const updatedSession = await updateSessionAssistant(id, assistantId, companyId.toString());
      if (updatedSession) {
        res.status(200).send(updatedSession);
      } else {
        res.status(404).send({ error: 'Session not found' });
      }
    } catch (error) {
      next(error);
    }
  },
);

// End session
sessionRouter.delete(
  '/:id',
  validateApiKeys(['openai_api_key']),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;

    try {
      const apiKey = await getApiKey(req.company._id, 'openai_api_key');

      if (!apiKey) {
        throw new BadRequestError('OpenAI API key not found');
      }

      await endSession(apiKey, id);
      res.status(200).json({ message: 'Session ended successfully' });
    } catch (error) {
      next(error);
    }
  },
);

// Get friendly sessions for a company
sessionRouter.get(
  '/friendly/:companyId',
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { companyId } = req.params;
      if (
        req.user?.role !== 'Admin' &&
        req.user?.companyId.toString() !== companyId
      ) {
        return res.status(403).send({ error: 'Access denied' });
      }

      const sessions = await Session.aggregate([
        {
          $match: {
            companyId: new mongoose.Types.ObjectId(companyId),
            active: true,
          },
        },
        ...sessionFriendlyAggreationQuery,
      ]);

      res.status(200).send(sessions);
    } catch (error) {
      res.status(500).send({ error: 'Error getting sessions' });
    }
  },
);

// Get session by ID
sessionRouter.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const sessions = await Session.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(id),
          companyId:
            req.user?.role === 'Admin'
              ? { $exists: true }
              : new mongoose.Types.ObjectId(req.user?.companyId),
        },
      },
      ...sessionFriendlyAggreationQuery,
    ]);

    if (sessions.length === 0) {
      return res.status(404).send({ error: 'Session not found' });
    }

    const session = sessions[0];
    res.status(200).send(session);
  } catch (error) {
    res.status(500).send({ error: 'Error getting session' });
  }
});

// Get session messages by specific ID (keeping this for direct access if needed, e.g. admin or specific use cases)
sessionRouter.get(
  '/:id/messages',
  validateApiKeys(['openai_api_key']),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const companyId = req.user?.companyId?.toString(); // Get companyId from authenticated user

    if (!companyId) {
      return next(new BadRequestError('Company ID not found in request.'));
    }
    const apiKey = await getApiKey(companyId, 'openai_api_key');
     if (!apiKey) {
      return next(new BadRequestError('API key not found for company.'));
    }

    try {
      // Ensure the session belongs to the user's company if not an admin
      const query: any = { _id: new mongoose.Types.ObjectId(id) };
      if (req.user?.role !== 'Admin') {
        query.companyId = new mongoose.Types.ObjectId(companyId);
      }

      const session = await Session.findOne(query);
      if (!session) {
        return res.status(404).send({ error: 'Session not found or access denied' });
      }
      const messages = await getSessionMessages(apiKey, id);
      res.status(200).send(messages);
    } catch (error) {
      next(error);
    }
  },
);

export { sessionRouter };
