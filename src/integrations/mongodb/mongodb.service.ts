import { handleUserQuery } from '../../services/mongodb.query.service';
import { logger } from '../../utils/logger';

export const runMongoDbQuery = async (sessionId: string, companyId: string, input: string): Promise<{ success: boolean; data?: any; error?: string; message?: string; logs?: string }> => {
  try {
    const results = await handleUserQuery(input);
    return {
      success: true,
      data: results,
      message: 'Query executed successfully',
      logs: logger.getLogs(),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred',
      message: 'Failed to execute MongoDB query',
      logs: logger.getLogs(),
    };
  } finally {
    logger.clearLogs();
  }
};