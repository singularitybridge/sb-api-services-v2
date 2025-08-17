import { CostTracking, ICostTracking } from '../models/CostTracking';
import mongoose from 'mongoose';
import { CostTrackingInfo } from '../utils/cost-tracking';

export interface CostSummary {
  totalCost: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalRequests: number;
  averageDuration: number;
  byModel: Record<
    string,
    {
      cost: number;
      requests: number;
      tokens: number;
    }
  >;
  byProvider: Record<
    string,
    {
      cost: number;
      requests: number;
      tokens: number;
    }
  >;
  byAssistant: Array<{
    assistantId: string;
    assistantName?: string;
    cost: number;
    requests: number;
    tokens: number;
  }>;
}

export interface CostQuery {
  companyId?: string;
  assistantId?: string;
  userId?: string;
  provider?: string;
  model?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  skip?: number;
}

/**
 * Save cost tracking information to MongoDB
 */
export async function saveCostTracking(
  costInfo: CostTrackingInfo,
): Promise<ICostTracking> {
  try {
    const costRecord = new CostTracking({
      companyId: new mongoose.Types.ObjectId(costInfo.companyId),
      assistantId: new mongoose.Types.ObjectId(costInfo.assistantId),
      sessionId:
        costInfo.sessionId &&
        costInfo.sessionId !== 'stateless' &&
        costInfo.sessionId !== 'stateless-json'
          ? new mongoose.Types.ObjectId(costInfo.sessionId)
          : undefined,
      userId: new mongoose.Types.ObjectId(costInfo.userId),
      provider: costInfo.provider,
      modelName: costInfo.model,
      inputTokens: costInfo.inputTokens,
      outputTokens: costInfo.outputTokens,
      totalTokens: costInfo.totalTokens,
      inputCost: costInfo.inputCost,
      outputCost: costInfo.outputCost,
      totalCost: costInfo.totalCost,
      duration: costInfo.duration || 0,
      toolCalls: costInfo.toolCalls || 0,
      cached: costInfo.cached || false,
      requestType:
        costInfo.requestType ||
        (costInfo.sessionId === 'stateless' ||
        costInfo.sessionId === 'stateless-json'
          ? 'stateless'
          : 'non-streaming'),
      timestamp: costInfo.timestamp,
    });

    const saved = await costRecord.save();
    console.log(
      `[COST_TRACKING_SAVED] Cost record saved to DB. ID: ${saved._id} | Total: $${costInfo.totalCost}`,
    );
    return saved;
  } catch (error) {
    console.error(
      '[COST_TRACKING_ERROR] Failed to save cost tracking to DB:',
      error,
    );
    throw error;
  }
}

/**
 * Get cost records with filtering
 */
export async function getCostRecords(
  query: CostQuery,
): Promise<ICostTracking[]> {
  const filter: any = {};

  if (query.companyId) {
    filter.companyId = new mongoose.Types.ObjectId(query.companyId);
  }
  if (query.assistantId) {
    filter.assistantId = new mongoose.Types.ObjectId(query.assistantId);
  }
  if (query.userId) {
    filter.userId = new mongoose.Types.ObjectId(query.userId);
  }
  if (query.provider) {
    filter.provider = query.provider;
  }
  if (query.model) {
    filter.modelName = query.model;
  }
  if (query.startDate || query.endDate) {
    filter.timestamp = {};
    if (query.startDate) {
      filter.timestamp.$gte = query.startDate;
    }
    if (query.endDate) {
      filter.timestamp.$lte = query.endDate;
    }
  }

  const queryBuilder = CostTracking.find(filter)
    .sort({ timestamp: -1 })
    .limit(query.limit || 100)
    .skip(query.skip || 0);

  return queryBuilder.exec();
}

/**
 * Get cost summary for a company
 */
export async function getCostSummary(
  companyId: string,
  startDate?: Date,
  endDate?: Date,
): Promise<CostSummary> {
  const filter: any = {
    companyId: new mongoose.Types.ObjectId(companyId),
  };

  if (startDate || endDate) {
    filter.timestamp = {};
    if (startDate) {
      filter.timestamp.$gte = startDate;
    }
    if (endDate) {
      filter.timestamp.$lte = endDate;
    }
  }

  const records = await CostTracking.find(filter).populate(
    'assistantId',
    'name',
  );

  const summary: CostSummary = {
    totalCost: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalRequests: records.length,
    averageDuration: 0,
    byModel: {},
    byProvider: {},
    byAssistant: [],
  };

  const assistantMap: Record<
    string,
    { cost: number; requests: number; tokens: number; name?: string }
  > = {};
  let totalDuration = 0;

  for (const record of records) {
    summary.totalCost += record.totalCost;
    summary.totalInputTokens += record.inputTokens;
    summary.totalOutputTokens += record.outputTokens;
    totalDuration += record.duration;

    // By Model
    if (!summary.byModel[record.modelName]) {
      summary.byModel[record.modelName] = { cost: 0, requests: 0, tokens: 0 };
    }
    summary.byModel[record.modelName].cost += record.totalCost;
    summary.byModel[record.modelName].requests += 1;
    summary.byModel[record.modelName].tokens += record.totalTokens;

    // By Provider
    if (!summary.byProvider[record.provider]) {
      summary.byProvider[record.provider] = { cost: 0, requests: 0, tokens: 0 };
    }
    summary.byProvider[record.provider].cost += record.totalCost;
    summary.byProvider[record.provider].requests += 1;
    summary.byProvider[record.provider].tokens += record.totalTokens;

    // By Assistant
    // Handle both populated and non-populated assistantId
    let assistantId: string;
    let assistantName: string | undefined;
    
    if (typeof record.assistantId === 'object' && record.assistantId !== null) {
      // Populated assistant object
      const assistantObj = record.assistantId as any;
      assistantId = assistantObj._id?.toString() || assistantObj.toString();
      assistantName = assistantObj.name;
    } else {
      // Just the ID string
      assistantId = (record.assistantId as any).toString();
      assistantName = undefined;
    }
    
    if (!assistantMap[assistantId]) {
      assistantMap[assistantId] = {
        cost: 0,
        requests: 0,
        tokens: 0,
        name: assistantName,
      };
    }
    assistantMap[assistantId].cost += record.totalCost;
    assistantMap[assistantId].requests += 1;
    assistantMap[assistantId].tokens += record.totalTokens;
  }

  // Convert assistant map to array
  summary.byAssistant = Object.entries(assistantMap).map(([id, data]) => ({
    assistantId: id,
    assistantName: data.name,
    cost: data.cost,
    requests: data.requests,
    tokens: data.tokens,
  }));

  // Sort by cost descending
  summary.byAssistant.sort((a, b) => b.cost - a.cost);

  summary.averageDuration =
    records.length > 0 ? totalDuration / records.length : 0;

  return summary;
}

/**
 * Get daily cost breakdown for a company
 */
export async function getDailyCosts(
  companyId: string,
  days: number = 30,
): Promise<
  Array<{ date: string; cost: number; requests: number; tokens: number }>
> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const result = await CostTracking.aggregate([
    {
      $match: {
        companyId: new mongoose.Types.ObjectId(companyId),
        timestamp: { $gte: startDate },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$timestamp' },
        },
        cost: { $sum: '$totalCost' },
        requests: { $sum: 1 },
        tokens: { $sum: '$totalTokens' },
      },
    },
    {
      $sort: { _id: 1 },
    },
  ]);

  return result.map((item) => ({
    date: item._id,
    cost: item.cost,
    requests: item.requests,
    tokens: item.tokens,
  }));
}

/**
 * Delete old cost records (retention policy)
 */
export async function deleteOldCostRecords(
  daysToKeep: number = 90,
): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  const result = await CostTracking.deleteMany({
    timestamp: { $lt: cutoffDate },
  });

  console.log(
    `[COST_TRACKING_CLEANUP] Deleted ${result.deletedCount} old cost records`,
  );
  return result.deletedCount;
}
