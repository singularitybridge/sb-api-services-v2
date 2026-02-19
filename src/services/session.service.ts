import { ISession, Session } from '../models/Session';
import { Assistant } from '../models/Assistant';
import { User } from '../models/User';
import { CustomError, NotFoundError, BadRequestError } from '../utils/errors';
import { resolveAssistantIdentifier } from './assistant/assistant-resolver.service';
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
  // Look up the current session to get its channel info
  const currentSession = await Session.findOne({
    _id: sessionId,
    companyId: companyId,
  });

  if (!currentSession) {
    throw new NotFoundError('Session not found');
  }

  // Deactivate any existing active session with the target assistant
  // for the same user/channel/channelUserId to avoid unique index conflict
  await Session.updateMany(
    {
      companyId: currentSession.companyId,
      userId: currentSession.userId,
      channel: currentSession.channel || 'web',
      channelUserId: currentSession.channelUserId,
      assistantId: new mongoose.Types.ObjectId(assistantId),
      active: true,
      _id: { $ne: currentSession._id },
    },
    { $set: { active: false } },
  );

  const session = await Session.findOneAndUpdate(
    { _id: sessionId, companyId: companyId },
    { assistantId },
    { new: true },
  );

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
        channelUserId: targetSession.channelUserId || userId,
        assistantId: targetSession.assistantId,
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
    channelUserId: channelInfo?.channelUserId || userId,
  });
};

export const getSessionOrCreate = async (
  userId: string,
  companyId: string,
  lastAssistantId?: string,
  channelInfo?: ChannelInfo,
) => {
  const channel = channelInfo?.channel || 'web';
  const channelUserId = channelInfo?.channelUserId || userId;

  const findSession = async (assistantId?: string) => {
    const query: Record<string, any> = {
      userId,
      companyId,
      active: true,
      channel,
      channelUserId,
    };
    if (assistantId) query.assistantId = assistantId;
    return await Session.findOne(query);
  };

  let session = await findSession(lastAssistantId);

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
      session = await findSession(lastAssistantId);
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

export interface EnrichedSession {
  sessionId: string;
  agentId: string;
  agentName: string;
  active: boolean;
  channel: string;
  channelUserId: string;
  messageCount: number;
  lastMessageAt: string | null;
  createdAt: string;
  totalCost: number;
  llmModel: string | null;
}

export async function listSessionsEnriched(
  companyId: string,
  filters: {
    agentId?: string;
    status?: 'active' | 'inactive';
    channel?: string;
    channelUserId?: string;
    limit?: number;
    offset?: number;
  },
): Promise<{ sessions: EnrichedSession[]; total: number }> {
  const limit = filters.limit || 20;
  const offset = filters.offset || 0;

  // Build match stage
  const match: any = { companyId: new mongoose.Types.ObjectId(companyId) };

  if (filters.agentId) {
    const assistant = await resolveAssistantIdentifier(filters.agentId, companyId);
    if (!assistant) {
      throw new Error(`Assistant not found: ${filters.agentId}`);
    }
    match.assistantId = assistant._id;
  }

  if (filters.status) {
    match.active = filters.status === 'active';
  }

  if (filters.channel) {
    match.channel = filters.channel;
  }

  if (filters.channelUserId) {
    match.channelUserId = filters.channelUserId;
  }

  // Single aggregation: $facet for count + paginated data with $lookup joins
  const result = await Session.aggregate([
    { $match: match },
    {
      $facet: {
        metadata: [{ $count: 'total' }],
        sessions: [
          // Join message stats early so we can sort by last activity
          {
            $lookup: {
              from: 'messages',
              localField: '_id',
              foreignField: 'sessionId',
              pipeline: [
                {
                  $group: {
                    _id: null,
                    totalCount: { $sum: 1 },
                    // Only count user-visible messages (user + assistant)
                    visibleCount: {
                      $sum: {
                        $cond: [{ $in: ['$sender', ['user', 'assistant']] }, 1, 0],
                      },
                    },
                    lastTimestamp: { $max: '$timestamp' },
                  },
                },
              ],
              as: '_messageStats',
            },
          },
          // Sort by last message time (falling back to createdAt for sessions with no messages)
          {
            $addFields: {
              _sortDate: {
                $ifNull: [{ $arrayElemAt: ['$_messageStats.lastTimestamp', 0] }, '$createdAt'],
              },
            },
          },
          { $sort: { _sortDate: -1 } },
          { $skip: offset },
          { $limit: limit },
          // Join assistant name
          {
            $lookup: {
              from: 'assistants',
              localField: 'assistantId',
              foreignField: '_id',
              pipeline: [{ $project: { name: 1 } }],
              as: '_assistant',
            },
          },
          // Join LLM costs and get the most-used model for this session
          {
            $lookup: {
              from: 'costtrackings',
              localField: '_id',
              foreignField: 'sessionId',
              pipeline: [
                {
                  $group: {
                    _id: '$modelName',
                    totalCost: { $sum: '$totalCost' },
                    count: { $sum: 1 },
                  },
                },
                { $sort: { count: -1 } },
              ],
              as: '_llmCosts',
            },
          },
          // Join tool costs
          {
            $lookup: {
              from: 'toolcosttrackings',
              localField: '_id',
              foreignField: 'sessionId',
              pipeline: [{ $group: { _id: null, totalCost: { $sum: '$cost' } } }],
              as: '_toolCosts',
            },
          },
          // Project final shape
          {
            $project: {
              sessionId: { $toString: '$_id' },
              agentId: { $toString: '$assistantId' },
              agentName: {
                $ifNull: [{ $arrayElemAt: ['$_assistant.name', 0] }, 'Unknown'],
              },
              active: 1,
              channel: { $ifNull: ['$channel', 'web'] },
              channelUserId: { $ifNull: ['$channelUserId', ''] },
              messageCount: {
                $ifNull: [{ $arrayElemAt: ['$_messageStats.visibleCount', 0] }, 0],
              },
              lastMessageAt: {
                $arrayElemAt: ['$_messageStats.lastTimestamp', 0],
              },
              // Most-used model from cost tracking (actual model used, not current agent model)
              llmModel: {
                $ifNull: [{ $arrayElemAt: ['$_llmCosts._id', 0] }, null],
              },
              totalCost: {
                $round: [{
                  $add: [
                    { $ifNull: [{ $sum: '$_llmCosts.totalCost' }, 0] },
                    { $ifNull: [{ $arrayElemAt: ['$_toolCosts.totalCost', 0] }, 0] },
                  ],
                }, 6],
              },
              createdAt: '$createdAt',
            },
          },
        ],
      },
    },
  ]);

  const total = result[0]?.metadata[0]?.total || 0;
  const sessions: EnrichedSession[] = (result[0]?.sessions || []).map((s: any) => ({
    sessionId: s.sessionId,
    agentId: s.agentId || '',
    agentName: s.agentName,
    active: s.active,
    channel: s.channel,
    channelUserId: s.channelUserId,
    messageCount: s.messageCount,
    lastMessageAt: s.lastMessageAt ? new Date(s.lastMessageAt).toISOString() : null,
    createdAt: s.createdAt ? new Date(s.createdAt).toISOString() : new Date().toISOString(),
    totalCost: s.totalCost || 0,
    llmModel: s.llmModel || null,
  }));

  return { sessions, total };
}

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

    // Drop any stale unique indexes on companyId+userId that don't match the target 5-field index
    // Must happen BEFORE backfills that may create temporary duplicates under the old index
    const indexes = await Session.collection.indexes();
    const TARGET_KEYS = ['companyId', 'userId', 'channel', 'channelUserId', 'assistantId'];
    for (const idx of indexes) {
      if (!idx.unique || idx.name === '_id_') continue;
      const keys = Object.keys(idx.key || {});
      if (idx.key?.companyId === 1 && idx.key?.userId === 1) {
        const isTarget = keys.length === TARGET_KEYS.length && TARGET_KEYS.every(k => idx.key?.[k] === 1);
        if (!isTarget) {
          await Session.collection.dropIndex(idx.name!);
          console.log(`Dropped stale session index: ${idx.name}`);
        }
      }
    }

    // Backfill web sessions that have empty channelUserId → set to userId
    const webBackfill = await Session.updateMany(
      { channel: 'web', channelUserId: '' },
      [{ $set: { channelUserId: { $toString: '$userId' } } }],
    );
    if (webBackfill.modifiedCount > 0) {
      console.log(`Backfilled ${webBackfill.modifiedCount} web sessions with userId as channelUserId`);
    }

    // Strip :agentId suffix from Telegram channelUserIds (migration from composite to raw IDs)
    const telegramSessions = await Session.find({
      channel: 'telegram',
      channelUserId: { $regex: ':' },
    });
    for (const s of telegramSessions) {
      const rawId = s.channelUserId.split(':')[0];
      s.channelUserId = rawId;
      await s.save();
    }
    if (telegramSessions.length > 0) {
      console.log(`Stripped agentId suffix from ${telegramSessions.length} Telegram session channelUserIds`);
    }

    // Create new 5-field unique index (includes assistantId for per-agent session isolation)
    await Session.collection.createIndex(
      { companyId: 1, userId: 1, channel: 1, channelUserId: 1, assistantId: 1 },
      { unique: true, partialFilterExpression: { active: true } },
    );
    console.log('Session index updated successfully (channel + assistant aware)');
  } catch (error) {
    console.error('Error updating session index:', error);
  }
};

