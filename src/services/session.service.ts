import { ISession, Session } from '../models/Session';
import { Assistant } from '../models/Assistant';
import { User } from '../models/User';
import { CustomError, NotFoundError, BadRequestError } from '../utils/errors';
import mongoose from 'mongoose';

export interface ChannelInfo {
  channel?: string;
  channelUserId?: string;
  channelMetadata?: Record<string, any>;
}

export const sessionFriendlyAggreationQuery = [
  {
    $lookup: {
      from: 'users',
      localField: 'userId',
      foreignField: '_id',
      as: 'userDetails',
    },
  },
  {
    $unwind: '$userDetails',
  },
  {
    $lookup: {
      from: 'assistants',
      localField: 'assistantId',
      foreignField: '_id',
      as: 'assistantDetails',
    },
  },
  {
    $unwind: '$assistantDetails',
  },
  {
    $lookup: {
      from: 'companies',
      localField: 'companyId',
      foreignField: '_id',
      as: 'companyDetails',
    },
  },
  {
    $unwind: '$companyDetails',
  },
  {
    $project: {
      assistantId: 1,
      userId: 1,
      companyId: 1,
      userName: '$userDetails.name',
      assistantName: '$assistantDetails.name',
      companyName: '$companyDetails.name',
      threadId: 1,
      active: 1,
      channel: 1,
      channelUserId: 1,
      channelMetadata: 1,
      lastActivityAt: 1,
    },
  },
];

export const updateSessionAssistant = async (
  sessionId: string,
  assistantId: string,
  companyId: string,
): Promise<ISession | null> => {
  const session = await Session.findOneAndUpdate(
    { _id: sessionId, companyId: companyId },
    { assistantId },
    { new: true },
  );

  if (!session) {
    throw new NotFoundError('Session not found');
  }

  return session;
};

export const activateSession = async (
  sessionId: string,
  userId: string,
  companyId: string,
): Promise<ISession> => {
  const sessionObjectId = new mongoose.Types.ObjectId(sessionId);
  const userObjectId = new mongoose.Types.ObjectId(userId);
  const companyObjectId = new mongoose.Types.ObjectId(companyId);

  const targetSession = await Session.findOne({
    _id: sessionObjectId,
    userId: userObjectId,
    companyId: companyObjectId,
  });

  if (!targetSession) {
    throw new NotFoundError('Session not found');
  }

  if (!targetSession.active) {
    await Session.updateMany(
      {
        userId: userObjectId,
        companyId: companyObjectId,
        channel: targetSession.channel || 'web',
        channelUserId: targetSession.channelUserId || '',
        active: true,
        _id: { $ne: sessionObjectId },
      },
      { $set: { active: false } },
    );

    targetSession.active = true;
    await targetSession.save();
  }

  return targetSession;
};

export const getSessionById = async (sessionId: string): Promise<ISession> => {
  const session = await Session.findById(sessionId);
  if (!session) {
    throw new NotFoundError('Session not found');
  }
  return session;
};

export const getCurrentSession = async (
  userId: string,
  companyId: string,
  channelInfo?: ChannelInfo,
): Promise<ISession | null> => {
  return await Session.findOne({
    userId,
    companyId,
    active: true,
    channel: channelInfo?.channel || 'web',
    channelUserId: channelInfo?.channelUserId || '',
  });
};

export const getSessionOrCreate = async (
  apiKey: string,
  userId: string,
  companyId: string,
  lastAssistantId?: string,
  channelInfo?: ChannelInfo,
) => {
  const channel = channelInfo?.channel || 'web';
  const channelUserId = channelInfo?.channelUserId || '';

  const findSession = async () => {
    const session = await Session.findOne({
      userId,
      companyId,
      active: true,
      channel,
      channelUserId,
    });
    if (session) {
      return session;
    }
    return null;
  };

  let session = await findSession();

  // Check TTL expiry — if the assistant has sessionTtlHours configured
  // and the session has been inactive longer than that, expire it
  if (session) {
    const assistant = await Assistant.findById(session.assistantId);
    if (assistant?.sessionTtlHours) {
      const lastActivity = session.lastActivityAt || session.createdAt;
      const ttlMs = assistant.sessionTtlHours * 60 * 60 * 1000;
      const elapsed = Date.now() - lastActivity.getTime();
      if (elapsed > ttlMs) {
        console.log(
          `Session ${session._id} expired (inactive ${Math.round(elapsed / 3600000)}h, TTL ${assistant.sessionTtlHours}h). Rotating.`,
        );
        // Carry over channelMetadata from expired session if not provided by caller
        if (channelInfo && !channelInfo.channelMetadata && (session as any).channelMetadata) {
          channelInfo.channelMetadata = (session as any).channelMetadata;
        }
        session.active = false;
        await session.save();
        session = null;
      }
    }
  }

  if (session) {
    // Touch lastActivityAt to keep session alive
    session.lastActivityAt = new Date();
    await session.save();
    return {
      _id: session._id,
      assistantId: session.assistantId,
    };
  }

  console.log('No existing session found. Attempting to create a new one.');

  let assistantToUseId;
  if (lastAssistantId) {
    // Validate if the lastAssistantId is a valid assistant for the company
    const assistant = await Assistant.findOne({
      _id: lastAssistantId,
      companyId,
    });
    if (assistant) {
      assistantToUseId = assistant._id;
    } else {
      console.warn(
        `Last assistant ID ${lastAssistantId} not found or not valid for company ${companyId}. Falling back to default.`,
      );
    }
  }

  if (!assistantToUseId) {
    const defaultAssistant = await Assistant.findOne({ companyId });
    if (!defaultAssistant) {
      throw new BadRequestError(
        'No default assistant available for this company. Please configure a default assistant.',
      );
    }
    assistantToUseId = defaultAssistant._id;
  }

  // Generate a unique ID for threadId instead of getting it from OpenAI
  const threadId = new mongoose.Types.ObjectId().toString();

  // Build channelMetadata — use provided data, or auto-populate for web from User model
  let channelMetadata = channelInfo?.channelMetadata;
  if (!channelMetadata && channel === 'web') {
    const user = await User.findById(userId);
    if (user) {
      channelMetadata = {
        name: user.name || '',
        email: user.email || '',
        phone: '',
      };
    }
  }

  try {
    session = await Session.create({
      userId,
      companyId,
      assistantId: assistantToUseId, // Use determined assistantId
      active: true,
      threadId,
      channel,
      channelUserId,
      ...(channelMetadata && { channelMetadata }),
    });
    console.log(
      `New session created: ${session._id} with assistant ${assistantToUseId}`,
    );
  } catch (error: any) {
    if (error.code === 11000) {
      console.log(
        'Duplicate key error encountered. Attempting to fetch existing session.',
      );
      session = await findSession();
      if (!session) {
        console.error('Failed to retrieve session after duplicate key error');
        throw new Error(
          'Failed to create or retrieve session after duplicate key error',
        );
      }
      console.log(
        `Existing session retrieved after duplicate key error: ${session._id}`,
      );
    } else {
      console.error('Error creating session:', error);
      throw error;
    }
  }

  return {
    _id: session._id,
    assistantId: session.assistantId,
  };
};

export const endSession = async (
  apiKey: string,
  sessionId: string,
): Promise<boolean> => {
  const session = await Session.findOne({ _id: sessionId, active: true });

  if (!session) {
    throw new NotFoundError('Active session');
  }

  try {
    // OpenAI thread deletion removed as it's deprecated in favor of Vercel AI
    session.active = false;
    await session.save();

    console.log(
      `Session ended locally, sessionId: ${sessionId}, userId: ${session.userId}`,
    );
    return true;
  } catch (error: any) {
    console.error('Error ending session:', error);
    throw new CustomError('Failed to end session', 500);
  }
};

// Function to ensure the correct index is created
export const ensureSessionIndex = async () => {
  try {
    // Backfill existing sessions missing channel fields
    const backfillResult = await Session.updateMany(
      { $or: [{ channel: { $exists: false } }, { channelUserId: { $exists: false } }] },
      { $set: { channel: 'web', channelUserId: '' } },
    );
    if (backfillResult.modifiedCount > 0) {
      console.log(`Backfilled ${backfillResult.modifiedCount} sessions with channel defaults`);
    }

    // Drop any stale indexes that don't match the target 4-field compound index
    const indexes = await Session.collection.indexes();
    for (const idx of indexes) {
      if (!idx.unique || idx.name === '_id_') continue;
      const keys = Object.keys(idx.key || {});
      // Keep the correct 4-field index, drop any other unique indexes on companyId+userId
      if (
        idx.key?.companyId === 1 &&
        idx.key?.userId === 1 &&
        !(keys.length === 4 && idx.key?.channel === 1 && idx.key?.channelUserId === 1)
      ) {
        await Session.collection.dropIndex(idx.name!);
        console.log(`Dropped stale session index: ${idx.name}`);
      }
    }

    // Create new channel-aware unique index
    await Session.collection.createIndex(
      { companyId: 1, userId: 1, channel: 1, channelUserId: 1 },
      { unique: true, partialFilterExpression: { active: true } },
    );
    console.log('Session index updated successfully (channel-aware)');
  } catch (error) {
    console.error('Error updating session index:', error);
  }
};

