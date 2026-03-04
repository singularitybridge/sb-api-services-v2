import { CostTracking, ICostTracking } from '../models/CostTracking';
import {
  ToolCostTracking,
  IToolCostTracking,
} from '../models/ToolCostTracking';
import mongoose from 'mongoose';
import { CostTrackingInfo } from '../utils/cost-tracking';
import { ToolCostInfo } from '../integrations/actions/types';

/**
 * Helper function to safely extract assistant ID and name from a record
 * Handles all edge cases: null, undefined, populated objects, ObjectIds
 */
function extractAssistantInfo(assistantIdField: any): {
  id: string;
  name: string;
} {
  const defaultResult = { id: 'unknown', name: 'Deleted Assistant' };

  // Handle null, undefined, or falsy values
  if (assistantIdField == null) {
    return defaultResult;
  }

  // Handle populated object with _id and name (from Mongoose populate)
  if (
    typeof assistantIdField === 'object' &&
    assistantIdField !== null &&
    assistantIdField._id
  ) {
    return {
      id: String(assistantIdField._id),
      name: assistantIdField.name || 'Unknown',
    };
  }

  // Handle ObjectId or any object with toString method
  if (
    assistantIdField != null &&
    typeof assistantIdField.toString === 'function'
  ) {
    try {
      return {
        id: String(assistantIdField),
        name: 'Unknown',
      };
    } catch {
      return defaultResult;
    }
  }

  return defaultResult;
}

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
  sessionId?: string;
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
      userId: mongoose.Types.ObjectId.isValid(costInfo.userId)
        ? new mongoose.Types.ObjectId(costInfo.userId)
        : undefined,
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
    // Cost tracking saved successfully
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
 * Result type for getCostRecords with total count for pagination
 */
export interface CostRecordsResult {
  records: any[]; // Records with populated assistantName
  totalCount: number;
}

/**
 * Get cost records with filtering and assistant names populated
 */
export async function getCostRecords(
  query: CostQuery,
): Promise<CostRecordsResult> {
  const filter: any = {};

  if (query.companyId) {
    filter.companyId = new mongoose.Types.ObjectId(query.companyId);
  }
  if (query.assistantId) {
    filter.assistantId = new mongoose.Types.ObjectId(query.assistantId);
  }
  if (query.sessionId) {
    filter.sessionId = new mongoose.Types.ObjectId(query.sessionId);
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
      // Set to end-of-day so date-only strings like "2026-02-13" include the full day
      const endOfDay = new Date(query.endDate);
      endOfDay.setUTCHours(23, 59, 59, 999);
      filter.timestamp.$lte = endOfDay;
    }
  }

  // Get total count for pagination (before limit/skip)
  const totalCount = await CostTracking.countDocuments(filter);

  // Get records with assistant name populated
  const records = await CostTracking.find(filter)
    .populate('assistantId', 'name')
    .sort({ timestamp: -1 })
    .limit(query.limit || 100)
    .skip(query.skip || 0)
    .lean();

  // Transform records to include assistantName at top level
  const transformedRecords = records.map((record: any) => {
    const { id: assistantId, name: assistantName } = extractAssistantInfo(
      record.assistantId,
    );
    return {
      ...record,
      assistantId,
      assistantName,
    };
  });

  return { records: transformedRecords, totalCount };
}

/**
 * Get cost summary for a company
 */
export async function getCostSummary(
  companyId: string,
  startDate?: Date,
  endDate?: Date,
  provider?: string,
  sessionId?: string,
): Promise<CostSummary> {
  const filter: any = {
    companyId: new mongoose.Types.ObjectId(companyId),
  };

  if (sessionId) {
    filter.sessionId = new mongoose.Types.ObjectId(sessionId);
  }

  if (startDate || endDate) {
    filter.timestamp = {};
    if (startDate) {
      filter.timestamp.$gte = startDate;
    }
    if (endDate) {
      const endOfDay = new Date(endDate);
      endOfDay.setUTCHours(23, 59, 59, 999);
      filter.timestamp.$lte = endOfDay;
    }
  }

  if (provider) {
    filter.provider = provider;
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

    // By Assistant - using helper function for safe extraction
    const { id: assistantId, name: assistantName } = extractAssistantInfo(
      record.assistantId,
    );

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
  startDate?: Date,
  endDate?: Date,
  provider?: string,
  sessionId?: string,
): Promise<
  Array<{ date: string; cost: number; requests: number; tokens: number }>
> {
  // Build match filter
  const matchFilter: any = {
    companyId: new mongoose.Types.ObjectId(companyId),
  };

  if (sessionId) {
    matchFilter.sessionId = new mongoose.Types.ObjectId(sessionId);
  }

  // Use provided dates or default to last N days
  if (startDate || endDate) {
    matchFilter.timestamp = {};
    if (startDate) {
      matchFilter.timestamp.$gte = startDate;
    }
    if (endDate) {
      const endOfDay = new Date(endDate);
      endOfDay.setUTCHours(23, 59, 59, 999);
      matchFilter.timestamp.$lte = endOfDay;
    }
  } else {
    const defaultStartDate = new Date();
    defaultStartDate.setDate(defaultStartDate.getDate() - days);
    matchFilter.timestamp = { $gte: defaultStartDate };
  }

  // Add provider filter if specified
  if (provider) {
    matchFilter.provider = provider;
  }

  const result = await CostTracking.aggregate([
    {
      $match: matchFilter,
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

// ── Tool Cost Tracking ──────────────────────────────────────────────

export interface ToolCostTrackingInput {
  companyId: string;
  assistantId: string;
  sessionId?: string;
  userId?: string;
  actionId: string;
  costInfo: ToolCostInfo;
  timestamp: Date;
}

export async function saveToolCostTracking(
  input: ToolCostTrackingInput,
): Promise<IToolCostTracking> {
  const record = new ToolCostTracking({
    companyId: new mongoose.Types.ObjectId(input.companyId),
    assistantId: mongoose.Types.ObjectId.isValid(input.assistantId)
      ? new mongoose.Types.ObjectId(input.assistantId)
      : undefined,
    sessionId:
      input.sessionId &&
      input.sessionId !== 'stateless' &&
      input.sessionId !== 'stateless_execution' &&
      mongoose.Types.ObjectId.isValid(input.sessionId)
        ? new mongoose.Types.ObjectId(input.sessionId)
        : undefined,
    userId: input.userId
      ? new mongoose.Types.ObjectId(input.userId)
      : undefined,
    provider: input.costInfo.provider,
    service: input.costInfo.service,
    actionId: input.actionId,
    modelName: input.costInfo.model,
    cost: input.costInfo.cost,
    inputTokens: input.costInfo.inputTokens,
    outputTokens: input.costInfo.outputTokens,
    totalTokens: input.costInfo.totalTokens,
    units: input.costInfo.units,
    unitType: input.costInfo.unitType,
    timestamp: input.timestamp,
  });

  const saved = await record.save();
  console.log(
    `[TOOL_COST] ${input.costInfo.provider}/${input.costInfo.service}: $${input.costInfo.cost.toFixed(6)} (${input.actionId})`,
  );
  return saved;
}

export interface ToolCostSummary {
  totalToolCost: number;
  totalToolRequests: number;
  byProvider: Record<
    string,
    { cost: number; requests: number; services: string[] }
  >;
  byAssistant: Array<{
    assistantId: string;
    assistantName?: string;
    cost: number;
    requests: number;
  }>;
}

export async function getToolCostSummary(
  companyId: string,
  startDate?: Date,
  endDate?: Date,
  sessionId?: string,
): Promise<ToolCostSummary> {
  const filter: any = {
    companyId: new mongoose.Types.ObjectId(companyId),
  };

  if (sessionId) {
    filter.sessionId = new mongoose.Types.ObjectId(sessionId);
  }

  if (startDate || endDate) {
    filter.timestamp = {};
    if (startDate) filter.timestamp.$gte = startDate;
    if (endDate) {
      const endOfDay = new Date(endDate);
      endOfDay.setUTCHours(23, 59, 59, 999);
      filter.timestamp.$lte = endOfDay;
    }
  }

  const records = await ToolCostTracking.find(filter).populate(
    'assistantId',
    'name',
  );

  const summary: ToolCostSummary = {
    totalToolCost: 0,
    totalToolRequests: records.length,
    byProvider: {},
    byAssistant: [],
  };

  const assistantMap: Record<
    string,
    { cost: number; requests: number; name?: string }
  > = {};

  for (const record of records) {
    summary.totalToolCost += record.cost;

    // By provider
    if (!summary.byProvider[record.provider]) {
      summary.byProvider[record.provider] = {
        cost: 0,
        requests: 0,
        services: [],
      };
    }
    summary.byProvider[record.provider].cost += record.cost;
    summary.byProvider[record.provider].requests += 1;
    if (
      !summary.byProvider[record.provider].services.includes(record.service)
    ) {
      summary.byProvider[record.provider].services.push(record.service);
    }

    // By assistant
    const { id: assistantId, name: assistantName } = extractAssistantInfo(
      record.assistantId,
    );
    if (!assistantMap[assistantId]) {
      assistantMap[assistantId] = { cost: 0, requests: 0, name: assistantName };
    }
    assistantMap[assistantId].cost += record.cost;
    assistantMap[assistantId].requests += 1;
  }

  summary.byAssistant = Object.entries(assistantMap)
    .map(([id, data]) => ({
      assistantId: id,
      assistantName: data.name,
      cost: data.cost,
      requests: data.requests,
    }))
    .sort((a, b) => b.cost - a.cost);

  return summary;
}

export async function getDailyToolCosts(
  companyId: string,
  days: number = 30,
  startDate?: Date,
  endDate?: Date,
  sessionId?: string,
): Promise<
  Array<{ date: string; cost: number; requests: number }>
> {
  const matchFilter: any = {
    companyId: new mongoose.Types.ObjectId(companyId),
  };

  if (sessionId) {
    matchFilter.sessionId = new mongoose.Types.ObjectId(sessionId);
  }

  if (startDate || endDate) {
    matchFilter.timestamp = {};
    if (startDate) matchFilter.timestamp.$gte = startDate;
    if (endDate) {
      const endOfDay = new Date(endDate);
      endOfDay.setUTCHours(23, 59, 59, 999);
      matchFilter.timestamp.$lte = endOfDay;
    }
  } else {
    const defaultStartDate = new Date();
    defaultStartDate.setDate(defaultStartDate.getDate() - days);
    matchFilter.timestamp = { $gte: defaultStartDate };
  }

  const result = await ToolCostTracking.aggregate([
    { $match: matchFilter },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$timestamp' },
        },
        cost: { $sum: '$cost' },
        requests: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return result.map((item) => ({
    date: item._id,
    cost: item.cost,
    requests: item.requests,
  }));
}
