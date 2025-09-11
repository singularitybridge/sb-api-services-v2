import mongoose from 'mongoose';
import PromptHistory, { IPromptHistory } from '../models/PromptHistory';
import { Assistant } from '../models/Assistant';
import { logger } from '../utils/logger';

export interface PromptHistoryOptions {
  assistantId: string;
  companyId: string;
  promptContent: string;
  changeType?: 'initial' | 'update' | 'rollback';
  changeDescription?: string;
  previousPrompt?: string;
  userId?: string;
  tags?: string[];
}

export interface PromptHistoryQuery {
  assistantId?: string;
  companyId?: string;
  limit?: number;
  offset?: number;
  startDate?: Date;
  endDate?: Date;
}

class PromptHistoryService {
  /**
   * Save a new prompt version to history
   */
  async savePromptVersion(
    options: PromptHistoryOptions,
  ): Promise<IPromptHistory> {
    try {
      const {
        assistantId,
        companyId,
        promptContent,
        changeType = 'update',
        changeDescription,
        userId,
        tags,
      } = options;

      // Get the latest version for this assistant
      const latestVersion = await this.getLatestVersion(assistantId);
      const newVersion = latestVersion ? latestVersion.version + 1 : 1;

      // Create the history entry
      const historyEntry = new PromptHistory({
        assistantId: new mongoose.Types.ObjectId(assistantId),
        companyId: new mongoose.Types.ObjectId(companyId),
        version: newVersion,
        promptContent,
        changeType,
        changeDescription: changeDescription || 'Prompt updated',
        previousVersion: latestVersion?.version,
        userId: userId ? new mongoose.Types.ObjectId(userId) : undefined,
        metadata: {
          tags: tags || [],
        },
      });

      const savedEntry = await historyEntry.save();
      logger.info(
        `Prompt history saved for assistant ${assistantId}, version ${newVersion}`,
      );

      return savedEntry;
    } catch (error) {
      logger.error('Error saving prompt history:', error);
      throw error;
    }
  }

  /**
   * Get the latest version for an assistant
   */
  async getLatestVersion(assistantId: string): Promise<IPromptHistory | null> {
    try {
      return await PromptHistory.findOne({
        assistantId: new mongoose.Types.ObjectId(assistantId),
      }).sort({ version: -1 });
    } catch (error) {
      logger.error('Error getting latest version:', error);
      throw error;
    }
  }

  /**
   * Get prompt history for an assistant
   */
  async getPromptHistory(query: PromptHistoryQuery): Promise<{
    history: IPromptHistory[];
    total: number;
    hasMore: boolean;
  }> {
    try {
      const {
        assistantId,
        companyId,
        limit = 20,
        offset = 0,
        startDate,
        endDate,
      } = query;

      const filter: any = {};
      if (assistantId)
        filter.assistantId = new mongoose.Types.ObjectId(assistantId);
      if (companyId) filter.companyId = new mongoose.Types.ObjectId(companyId);
      if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) filter.createdAt.$gte = startDate;
        if (endDate) filter.createdAt.$lte = endDate;
      }

      const [history, total] = await Promise.all([
        PromptHistory.find(filter)
          .sort({ version: -1 })
          .skip(offset)
          .limit(limit)
          .populate('userId', 'name email')
          .lean(),
        PromptHistory.countDocuments(filter),
      ]);

      return {
        history,
        total,
        hasMore: offset + limit < total,
      };
    } catch (error) {
      logger.error('Error getting prompt history:', error);
      throw error;
    }
  }

  /**
   * Get a specific version of a prompt
   */
  async getPromptByVersion(
    assistantId: string,
    version: number,
  ): Promise<IPromptHistory | null> {
    try {
      return await PromptHistory.findOne({
        assistantId: new mongoose.Types.ObjectId(assistantId),
        version,
      }).populate('userId', 'name email');
    } catch (error) {
      logger.error('Error getting prompt by version:', error);
      throw error;
    }
  }

  /**
   * Compare two versions of a prompt
   */
  async compareVersions(
    assistantId: string,
    version1: number,
    version2: number,
  ): Promise<{
    version1: IPromptHistory | null;
    version2: IPromptHistory | null;
    differences: {
      addedLines: number;
      removedLines: number;
      characterDiff: number;
    };
  }> {
    try {
      const [v1, v2] = await Promise.all([
        this.getPromptByVersion(assistantId, version1),
        this.getPromptByVersion(assistantId, version2),
      ]);

      if (!v1 || !v2) {
        throw new Error('One or both versions not found');
      }

      const lines1 = v1.promptContent.split('\n');
      const lines2 = v2.promptContent.split('\n');

      return {
        version1: v1,
        version2: v2,
        differences: {
          addedLines: Math.max(0, lines2.length - lines1.length),
          removedLines: Math.max(0, lines1.length - lines2.length),
          characterDiff: v2.promptContent.length - v1.promptContent.length,
        },
      };
    } catch (error) {
      logger.error('Error comparing versions:', error);
      throw error;
    }
  }

  /**
   * Rollback to a specific version
   */
  async rollbackToVersion(
    assistantId: string,
    targetVersion: number,
    companyId: string,
    userId?: string,
  ): Promise<{
    success: boolean;
    newVersion: IPromptHistory | null;
    updatedAssistant: any;
  }> {
    try {
      // Get the target version
      const targetPrompt = await this.getPromptByVersion(
        assistantId,
        targetVersion,
      );
      if (!targetPrompt) {
        throw new Error(
          `Version ${targetVersion} not found for assistant ${assistantId}`,
        );
      }

      // Update the assistant with the old prompt
      const updatedAssistant = await Assistant.findByIdAndUpdate(
        assistantId,
        {
          llmPrompt: targetPrompt.promptContent,
          lastModifiedAt: new Date(),
        },
        { new: true },
      );

      if (!updatedAssistant) {
        throw new Error(`Assistant ${assistantId} not found`);
      }

      // Create a new history entry for the rollback
      const newVersion = await this.savePromptVersion({
        assistantId,
        companyId,
        promptContent: targetPrompt.promptContent,
        changeType: 'rollback',
        changeDescription: `Rolled back to version ${targetVersion}`,
        userId,
      });

      logger.info(
        `Assistant ${assistantId} rolled back to version ${targetVersion}`,
      );

      return {
        success: true,
        newVersion,
        updatedAssistant,
      };
    } catch (error) {
      logger.error('Error rolling back version:', error);
      throw error;
    }
  }

  /**
   * Delete old versions (for cleanup)
   */
  async deleteOldVersions(
    assistantId: string,
    keepVersions: number = 10,
  ): Promise<number> {
    try {
      // Get all versions sorted by version number
      const allVersions = await PromptHistory.find({
        assistantId: new mongoose.Types.ObjectId(assistantId),
      }).sort({ version: -1 });

      if (allVersions.length <= keepVersions) {
        return 0;
      }

      // Delete older versions
      const versionsToDelete = allVersions.slice(keepVersions);
      const versionNumbers = versionsToDelete.map((v) => v.version);

      const result = await PromptHistory.deleteMany({
        assistantId: new mongoose.Types.ObjectId(assistantId),
        version: { $in: versionNumbers },
      });

      logger.info(
        `Deleted ${result.deletedCount} old versions for assistant ${assistantId}`,
      );
      return result.deletedCount;
    } catch (error) {
      logger.error('Error deleting old versions:', error);
      throw error;
    }
  }

  /**
   * Get version statistics for an assistant
   */
  async getVersionStatistics(assistantId: string): Promise<{
    totalVersions: number;
    firstVersion: IPromptHistory | null;
    latestVersion: IPromptHistory | null;
    averagePromptLength: number;
    changeFrequency: {
      daily: number;
      weekly: number;
      monthly: number;
    };
  }> {
    try {
      const [totalVersions, firstVersion, latestVersion, allVersions] =
        await Promise.all([
          PromptHistory.countDocuments({
            assistantId: new mongoose.Types.ObjectId(assistantId),
          }),
          PromptHistory.findOne({
            assistantId: new mongoose.Types.ObjectId(assistantId),
          }).sort({ version: 1 }),
          PromptHistory.findOne({
            assistantId: new mongoose.Types.ObjectId(assistantId),
          }).sort({ version: -1 }),
          PromptHistory.find({
            assistantId: new mongoose.Types.ObjectId(assistantId),
          }).select('promptContent createdAt'),
        ]);

      const averagePromptLength =
        allVersions.length > 0
          ? allVersions.reduce((sum, v) => sum + v.promptContent.length, 0) /
            allVersions.length
          : 0;

      // Calculate change frequency
      const now = new Date();
      const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const dailyChanges = allVersions.filter(
        (v) => v.createdAt >= dayAgo,
      ).length;
      const weeklyChanges = allVersions.filter(
        (v) => v.createdAt >= weekAgo,
      ).length;
      const monthlyChanges = allVersions.filter(
        (v) => v.createdAt >= monthAgo,
      ).length;

      return {
        totalVersions,
        firstVersion,
        latestVersion,
        averagePromptLength: Math.round(averagePromptLength),
        changeFrequency: {
          daily: dailyChanges,
          weekly: weeklyChanges,
          monthly: monthlyChanges,
        },
      };
    } catch (error) {
      logger.error('Error getting version statistics:', error);
      throw error;
    }
  }
}

export const promptHistoryService = new PromptHistoryService();
export default promptHistoryService;
