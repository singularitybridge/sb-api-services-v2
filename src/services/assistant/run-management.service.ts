import { getOpenAIClient } from './openai-client.service';
import { submitToolOutputs } from '../oai.thread.service';

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

  while (Date.now() - startTime < timeout) {
    const openaiClient = getOpenAIClient(apiKey);
    const run = await openaiClient.beta.threads.runs.retrieve(threadId, runId);
    console.log(`check run id:${runId} status: ${run.status}`);
    lastRun = run;

    const completedStatuses = ['completed', 'cancelled', 'failed', 'expired'];
    if (completedStatuses.includes(run.status)) {
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

    await new Promise((resolve) =>
      setTimeout(resolve, Math.min(500, timeout - (Date.now() - startTime))),
    );
  }

  throw new Error('Timeout exceeded while waiting for run to complete');
};