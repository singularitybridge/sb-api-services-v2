import { getOpenAIClient } from './openai-client.service';
import { submitToolOutputs } from '../oai.thread.service';
import { publishActionMessage } from '../../integrations/actions/publishers';
import { getSessionById } from '../../services/session.service';
import { SupportedLanguage } from '../../services/discovery.service';
import { v4 as uuidv4 } from 'uuid';
import heKnowledgeRetrieval from '../../translations/he-knowledge-retrieval';

interface RunStep {
  id: string;
  type: string;
  status: string;
  step_details: {
    type: string;
    tool_calls?: ToolCall[];
  };
}

interface ToolCall {
  id: string;
  type: string;
  function?: {
    name: string;
    arguments: string;
  };
}

class StatusLogger {
  private lastStatus: string = '';
  private lastLine: number = 0;

  constructor() {
    // Move cursor to new line initially
    process.stdout.write('\n');
    this.lastLine = 1;
  }

  private clearLine() {
    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
  }

  updateStatus(status: string) {
    // Clear the previous status line
    this.clearLine();
    // Write the new status
    process.stdout.write(`Run Status: ${status}`);
    this.lastStatus = status;
  }

  info(message: string) {
    // Move to new line, print message, then return to status line
    this.clearLine();
    console.log(message);
    process.stdout.write(`Run Status: ${this.lastStatus}`);
  }

  succeed(message: string, tokens?: number) {
    this.clearLine();
    const tokenInfo = tokens ? ` (${tokens} tokens used)` : '';
    console.log(`✓ ${message}${tokenInfo}`);
  }

  fail(message: string) {
    this.clearLine();
    console.log(`✗ ${message}`);
  }
}



const checkFileToolUsage = async (openaiClient: any, threadId: string, runId: string, logger: StatusLogger): Promise<boolean> => {
  const runSteps = await openaiClient.beta.threads.runs.steps.list(threadId, runId);
  let fileToolUsed = false;
  
  runSteps.data.forEach((step: RunStep) => {
    if (step.step_details.tool_calls?.some(call => call.type === 'retrieval' || call.type === 'file_search')) {
      fileToolUsed = true;
      logger.info('File tool usage detected in step: ' + step.id);
    }
  });
  return fileToolUsed;
};

const getTranslation = (language: SupportedLanguage, key: string, defaultValue: string): string => {
  if (language === 'he' && key in heKnowledgeRetrieval) {
    return heKnowledgeRetrieval[key as keyof typeof heKnowledgeRetrieval];
  }
  return defaultValue;
};

export const pollRunStatus = async (
  apiKey: string,
  threadId: string,
  runId: string,
  sessionId: string,
  companyId: string,
  allowedActions: string[],
  timeout: number = 180000, // 3 minutes
) => {
  const startTime = Date.now();
  let lastRun;
  const knowledgeRetrievalNotificationId = uuidv4();
  let knowledgeRetrievalNotificationSent = false;

  // Get session language
  const session = await getSessionById(sessionId);
  const sessionLanguage = session.language as SupportedLanguage;

  // Create status logger
  const logger = new StatusLogger();

  while (Date.now() - startTime < timeout) {
    const openaiClient = getOpenAIClient(apiKey);
    const run = await openaiClient.beta.threads.runs.retrieve(threadId, runId);
    
    // Update status
    logger.updateStatus(run.status);

    const fileToolUsed = await checkFileToolUsage(openaiClient, threadId, runId, logger);
    if (fileToolUsed && !knowledgeRetrievalNotificationSent) {
      logger.info(`File tool usage confirmed for run id: ${runId}`);
      await publishActionMessage(sessionId, 'started', {
        id: knowledgeRetrievalNotificationId,
        actionId: 'knowledge_retrieval_notification',
        serviceName: getTranslation(sessionLanguage, 'knowledge', 'Knowledge'),
        actionTitle: getTranslation(sessionLanguage, 'knowledge_retrieval_in_progress', 'Knowledge Retrieval In Progress'),
        actionDescription: getTranslation(sessionLanguage, 'knowledge_retrieval_in_progress_description', 'Knowledge retrieval operation in progress'),
        icon: 'book-text',
        args: {},
        originalActionId: 'knowledge_retrieval_notification',
        language: sessionLanguage,
        input: { 
          message: getTranslation(sessionLanguage, 'knowledge_retrieval_in_progress_message', 'Knowledge retrieval in progress. Retrieving relevant information...')
        }
      });
      knowledgeRetrievalNotificationSent = true;
    }

    const completedStatuses = ['completed', 'cancelled', 'failed', 'expired'];
    if (completedStatuses.includes(run.status)) {
      if (knowledgeRetrievalNotificationSent) {
        await publishActionMessage(sessionId, 'completed', {
          id: knowledgeRetrievalNotificationId,
          actionId: 'knowledge_retrieval_notification',
          serviceName: getTranslation(sessionLanguage, 'knowledge', 'Knowledge'),
          actionTitle: getTranslation(sessionLanguage, 'knowledge_retrieval_completed', 'Knowledge Retrieval Completed'),
          actionDescription: getTranslation(sessionLanguage, 'knowledge_retrieval_completed_description', 'Knowledge retrieval operation completed'),
          icon: 'book-text',
          args: {},
          originalActionId: 'knowledge_retrieval_notification',
          language: sessionLanguage,
          input: { 
            message: getTranslation(sessionLanguage, 'knowledge_retrieval_completed_message', 'Knowledge retrieval completed. Results retrieved.')
          }
        });
      }

      logger.succeed(`Run completed > ${run.status}`, run.usage?.prompt_tokens);
      return run;
    }

    if (
      run.status === 'requires_action' &&
      run.required_action?.type === 'submit_tool_outputs'
    ) {
      await submitToolOutputs(
        openaiClient,
        threadId,
        runId,
        run.required_action.submit_tool_outputs.tool_calls,
        sessionId,
        companyId,
        allowedActions
      );
            
    }

    lastRun = run;
    await new Promise((resolve) =>
      setTimeout(resolve, Math.min(500, timeout - (Date.now() - startTime))),
    );
  }

  logger.fail('Timeout exceeded while waiting for run to complete');
  throw new Error('Timeout exceeded while waiting for run to complete');
};
