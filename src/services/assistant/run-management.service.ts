import { getOpenAIClient } from './openai-client.service';
import { submitToolOutputs } from '../oai.thread.service';
import { publishActionMessage } from '../../integrations/actions/publishers';
import { v4 as uuidv4 } from 'uuid';

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
  console.log(`Step ID: ${step.id}, Type: ${step.type}, Status: ${step.status}`);
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
  console.log(`Checking ${runSteps.data.length} steps for file tool usage`);
  runSteps.data.forEach((step: RunStep) => {
    logRunStep(step);
    if (step.step_details.tool_calls?.some(call => call.type === 'retrieval' || call.type === 'file_search')) {
      fileToolUsed = true;
      console.log('File tool usage detected in step:', step.id);
    }
  });
  return fileToolUsed;
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
  const fileSearchNotificationId = uuidv4();
  let fileSearchNotificationSent = false;

  while (Date.now() - startTime < timeout) {
    const openaiClient = getOpenAIClient(apiKey);
    const run = await openaiClient.beta.threads.runs.retrieve(threadId, runId);
    console.log(`Run ID: ${runId}, Status: ${run.status}`);

    const fileToolUsed = await checkFileToolUsage(openaiClient, threadId, runId);
    if (fileToolUsed && !fileSearchNotificationSent) {
      console.log(`File tool usage confirmed for run id: ${runId}`);
      await publishActionMessage(sessionId, 'started', {
        id: fileSearchNotificationId,
        actionId: 'file_search_notification',
        serviceName: 'File Search Notification',
        actionTitle: 'File Search In Progress',
        actionDescription: 'File search operation in progress',
        icon: 'search',
        args: {},
        originalActionId: 'file_search_notification',
        language: 'en',
        input: { message: 'File search in progress. Retrieving relevant information...' }
      });
      fileSearchNotificationSent = true;
    }

    const completedStatuses = ['completed', 'cancelled', 'failed', 'expired'];
    if (completedStatuses.includes(run.status)) {
      if (run.usage && run.usage.prompt_tokens) {
        console.log(`Run id: ${runId} used ${run.usage.prompt_tokens} prompt tokens`);
      }

      if (fileSearchNotificationSent) {
        await publishActionMessage(sessionId, 'completed', {
          id: fileSearchNotificationId,
          actionId: 'file_search_notification',
          serviceName: 'File Search Notification',
          actionTitle: 'File Search Completed',
          actionDescription: 'File search operation completed',
          icon: 'search',
          args: {},
          originalActionId: 'file_search_notification',
          language: 'en',
          input: { message: 'File search completed. Results retrieved.' }
        });
      }

      return run;
    }

    if (
      run.status === 'requires_action' &&
      run.required_action?.type === 'submit_tool_outputs'
    ) {
      console.log(`Tool outputs submission required for run id: ${runId}`);
      
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
