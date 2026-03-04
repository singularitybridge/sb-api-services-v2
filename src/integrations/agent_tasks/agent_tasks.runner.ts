/**
 * Agent Tasks Runner
 *
 * Background service that polls for pending tasks and executes them
 * via stateless agent execution. Runs inside the Agent Hub process.
 *
 * Features:
 * - Polls every POLL_INTERVAL_MS for pending tasks
 * - Executes up to MAX_CONCURRENT tasks in parallel
 * - Retries failed tasks with exponential backoff
 * - Fires onGroupComplete callbacks when all tasks in a group finish
 * - Stale task recovery: marks tasks stuck in "running" as failed
 */

import mongoose from 'mongoose';
import { Task, ITask, ITaskCallback } from './task.model';
import { Assistant } from '../../models/Assistant';
import { executeAssistantStateless } from '../../services/assistant/stateless-execution.service';
import axios from 'axios';

// ── Configuration ────────────────────────────────────────────────

const POLL_INTERVAL_MS = 2_000;        // Poll every 2 seconds
const MAX_CONCURRENT = 15;             // Max parallel task executions
const STALE_TIMEOUT_MS = 10 * 60_000;  // 10 minutes — mark running tasks as stale
const BACKOFF_BASE_MS = 5_000;          // 5 second base for retry backoff

// ── State ────────────────────────────────────────────────────────

let isRunning = false;
let pollTimer: NodeJS.Timeout | null = null;
let activeCount = 0;

// ── Public API ──────────────────────────────────────────────────

export function startTaskRunner(): void {
  if (isRunning) {
    console.log('[task-runner] Already running');
    return;
  }

  isRunning = true;
  console.log('[task-runner] Started (poll=%dms, maxConcurrent=%d)', POLL_INTERVAL_MS, MAX_CONCURRENT);

  pollTimer = setInterval(pollAndExecute, POLL_INTERVAL_MS);

  // Run once immediately
  pollAndExecute();
}

export function stopTaskRunner(): void {
  if (!isRunning) return;
  isRunning = false;
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  console.log('[task-runner] Stopped');
}

export function getTaskRunnerStatus(): { running: boolean; activeCount: number } {
  return { running: isRunning, activeCount };
}

// ── Poll Loop ───────────────────────────────────────────────────

async function pollAndExecute(): Promise<void> {
  if (!isRunning) return;

  try {
    const slots = MAX_CONCURRENT - activeCount;
    if (slots <= 0) return;

    // Recover stale tasks (stuck in "running" for too long)
    await recoverStaleTasks();

    // Atomic claim: findOneAndUpdate prevents double-pickup
    const tasks: ITask[] = [];
    const now = new Date();
    for (let i = 0; i < slots; i++) {
      const task = await Task.findOneAndUpdate(
        {
          status: 'pending',
          $or: [
            { retryAfter: { $exists: false } },  // New task, no backoff
            { retryAfter: null },
            { retryAfter: { $lte: now } },        // Backoff period elapsed
          ],
        },
        {
          $set: { status: 'running', startedAt: new Date() },
        },
        {
          new: true,
          sort: { createdAt: 1 }, // FIFO
        },
      );

      if (!task) break;
      tasks.push(task);
    }

    if (tasks.length === 0) return;

    console.log(`[task-runner] Picked up ${tasks.length} tasks`);

    for (const task of tasks) {
      activeCount++;
      executeTask(task)
        .catch((err) => console.error(`[task-runner] Unhandled error for task ${task._id}:`, err))
        .finally(() => { activeCount--; });
    }
  } catch (err) {
    console.error('[task-runner] Poll error:', err);
  }
}

// ── Task Execution ──────────────────────────────────────────────

async function executeTask(task: ITask): Promise<void> {
  const taskId = String(task._id);

  try {
    if (!mongoose.Types.ObjectId.isValid(task.handlerAgentId)) {
      await markTaskFailed(taskId, `Invalid handler agent ID: ${task.handlerAgentId}`);
      await checkGroupCompletion(task.groupId, task.companyId);
      return;
    }

    const assistant = await Assistant.findById(task.handlerAgentId);
    if (!assistant) {
      await markTaskFailed(taskId, `Handler agent ${task.handlerAgentId} not found`);
      await checkGroupCompletion(task.groupId, task.companyId);
      return;
    }

    console.log(
      `[task-runner] Executing task ${taskId} (group=${task.groupId}) via agent "${assistant.name}"`,
    );

    const result = await executeAssistantStateless(
      assistant,
      task.input,
      task.companyId,
      'task-runner',
      undefined,                 // attachments
      { type: 'json_object' },   // responseFormat
      undefined,                 // metadata
      undefined,                 // promptOverride
    );

    // Parse result — extract just the data, strip message envelope
    let output: any;
    if (typeof result === 'string') {
      try { output = JSON.parse(result); } catch { output = { text: result }; }
    } else if (result && typeof result === 'object') {
      const r = result as any;
      // executeAssistantStateless with json_object returns { data: { json: {...} } }
      if (r.data?.json) {
        output = r.data.json;
      } else if (r.content?.[0]?.text) {
        // Text response wrapped in message envelope
        const text = typeof r.content[0].text === 'string' ? r.content[0].text : r.content[0].text?.value;
        try { output = JSON.parse(text); } catch { output = { text }; }
      } else {
        output = result;
      }
    } else {
      output = { text: String(result) };
    }

    await Task.findByIdAndUpdate(taskId, {
      $set: { status: 'completed', output, completedAt: new Date() },
    });

    console.log(`[task-runner] Task ${taskId} completed`);

    await checkGroupCompletion(task.groupId, task.companyId);
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    console.error(`[task-runner] Task ${taskId} failed:`, errorMsg);

    const currentRetry = (task.retryCount || 0) + 1;
    if (currentRetry <= task.maxRetries) {
      const backoffMs = BACKOFF_BASE_MS * Math.pow(2, currentRetry - 1); // 5s, 10s, 20s...
      const retryAfter = new Date(Date.now() + backoffMs);
      console.log(`[task-runner] Task ${taskId} retry ${currentRetry}/${task.maxRetries} (backoff ${backoffMs}ms)`);
      await Task.findByIdAndUpdate(taskId, {
        $set: { status: 'pending', error: errorMsg, retryAfter },
        $inc: { retryCount: 1 },
      });
    } else {
      await markTaskFailed(taskId, errorMsg);
      await checkGroupCompletion(task.groupId, task.companyId);
    }
  }
}

// ── Group Completion ────────────────────────────────────────────

async function checkGroupCompletion(groupId: string, companyId: string): Promise<void> {
  const remaining = await Task.countDocuments({
    groupId,
    companyId,
    status: { $in: ['pending', 'running'] },
  });

  if (remaining > 0) return;

  // Atomic claim: $unset the callback so only one concurrent caller wins
  const claimed = await Task.findOneAndUpdate(
    { groupId, companyId, onGroupComplete: { $exists: true, $ne: null } },
    { $unset: { onGroupComplete: 1 } },
    { new: false },  // return the doc BEFORE the unset so we get the callback data
  ).lean();

  if (!claimed?.onGroupComplete) return;

  console.log(`[task-runner] Group "${groupId}" complete — firing callback`);

  const tasks = await Task.find({ groupId, companyId }).lean();
  const results = tasks.map((t) => ({
    status: t.status,
    output: t.output,
    error: t.error,
    metadata: t.metadata,
  }));

  try {
    await fireCallback(claimed.onGroupComplete, results, companyId);
  } catch (err: any) {
    console.error(`[task-runner] Group "${groupId}" callback failed:`, err?.message || err);
  }
}

async function fireCallback(
  callback: ITaskCallback,
  results: any[],
  companyId: string,
): Promise<void> {
  switch (callback.type) {
    case 'execute_agent': {
      if (!callback.agentId) {
        console.warn('[task-runner] execute_agent callback missing agentId');
        return;
      }
      const assistant = await Assistant.findById(callback.agentId);
      if (!assistant) {
        console.warn(`[task-runner] Callback agent ${callback.agentId} not found`);
        return;
      }

      const input = (callback.input || 'Task group completed. Results:') +
        '\n\n' + JSON.stringify(results);

      await executeAssistantStateless(assistant, input, companyId, 'task-runner');
      console.log(`[task-runner] Callback: executed agent ${assistant.name}`);
      break;
    }

    case 'webhook': {
      if (!callback.url) {
        console.warn('[task-runner] webhook callback missing url');
        return;
      }
      await axios.post(callback.url, { results }, {
        headers: { 'Content-Type': 'application/json', ...(callback.headers || {}) },
        timeout: 30_000,
      });
      console.log(`[task-runner] Callback: webhook POST to ${callback.url}`);
      break;
    }

    case 'integration_action': {
      // TODO: wire up integration action execution via action loader
      console.log(
        `[task-runner] Callback: integration_action ${callback.integration}.${callback.action} — not yet implemented`,
      );
      break;
    }
  }
}

// ── Helpers ─────────────────────────────────────────────────────

async function markTaskFailed(taskId: string, error: string): Promise<void> {
  await Task.findByIdAndUpdate(taskId, {
    $set: { status: 'failed', error, completedAt: new Date() },
  });
}

async function recoverStaleTasks(): Promise<void> {
  const staleThreshold = new Date(Date.now() - STALE_TIMEOUT_MS);
  const result = await Task.updateMany(
    { status: 'running', startedAt: { $lt: staleThreshold } },
    { $set: { status: 'failed', error: 'Task execution timed out (stale)', completedAt: new Date() } },
  );
  if (result.modifiedCount > 0) {
    console.warn(`[task-runner] Recovered ${result.modifiedCount} stale tasks`);
  }
}
