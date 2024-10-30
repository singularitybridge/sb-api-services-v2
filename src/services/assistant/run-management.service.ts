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

const logRunStep = (step: RunStep) => {  
  if (step.step_details.tool_calls) {
    step.step_details.tool_calls.forEach((call: ToolCall) => {
      console.log(`  Tool Call: ${call.type}, Function: ${call.function?.name || 'N/A'}`);
      if (call.function?.arguments) {
        console.log(`  Arguments: ${call.function.arguments}`);
      }
    });
  }
};

const checkFileToolUsage = async (openaiClient: any, threadId: string, runId: string): Promise<boolean> => {
  const runSteps = await openaiClient.beta.threads.runs.steps.list(threadId, runId);
  let fileToolUsed = false;
  
  runSteps.data.forEach((step: RunStep) => {
    logRunStep(step);
    if (step.step_details.tool_calls?.some(call => call.type === 'retrieval' || call.type === 'file_search')) {
      fileToolUsed = true;
      console.log('File tool usage detected in step:', step.id);
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
  timeout: number = 90000,
) => {
  const startTime = Date.now();
  let lastRun;
  const knowledgeRetrievalNotificationId = uuidv4();
  let knowledgeRetrievalNotificationSent = false;

  // Get session language
  const session = await getSessionById(sessionId);
  const sessionLanguage = session.language as SupportedLanguage;

  while (Date.now() - startTime < timeout) {
    const openaiClient = getOpenAIClient(apiKey);
    const run = await openaiClient.beta.threads.runs.retrieve(threadId, runId);
    console.log(`Run ID: ${runId}, Status: ${run.status}`);

    const fileToolUsed = await checkFileToolUsage(openaiClient, threadId, runId);
    if (fileToolUsed && !knowledgeRetrievalNotificationSent) {
      console.log(`File tool usage confirmed for run id: ${runId}`);
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
      if (run.usage && run.usage.prompt_tokens) {
        console.log(`Run id: ${runId} used ${run.usage.prompt_tokens} prompt tokens`);
      }

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
      
      console.log(`Completed tool outputs submission for run id: ${runId}`);
    }

    lastRun = run;
    await new Promise((resolve) =>
      setTimeout(resolve, Math.min(500, timeout - (Date.now() - startTime))),
    );
  }

  throw new Error('Timeout exceeded while waiting for run to complete');
};
