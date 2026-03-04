/**
 * Agent Tasks Service
 *
 * Internal service for task CRUD operations.
 * No external API keys needed — operates directly on MongoDB.
 */

import mongoose from 'mongoose';
import { Task, ITask, ITaskCallback, TaskStatus } from './task.model';
import { TestConnectionResult } from '../../services/integration-config.service';

// ── Connection Validation ───────────────────────────────────────

export async function validateConnection(): Promise<TestConnectionResult> {
  // Internal integration — always connected if DB is up
  return { success: true, message: 'Agent Tasks integration is ready' };
}

// ── Task CRUD ───────────────────────────────────────────────────

export interface CreateTaskInput {
  groupId: string;
  creatorAgentId: string;
  handlerAgentId: string;
  companyId: string;
  input: string;
  maxRetries?: number;
  onGroupComplete?: ITaskCallback;
  metadata?: Record<string, any>;
}

export async function createTask(input: CreateTaskInput): Promise<ITask> {
  const task = await Task.create({
    groupId: input.groupId,
    creatorAgentId: input.creatorAgentId,
    handlerAgentId: input.handlerAgentId,
    companyId: input.companyId,
    input: input.input,
    status: 'pending',
    retryCount: 0,
    maxRetries: input.maxRetries ?? 2,
    onGroupComplete: input.onGroupComplete,
    metadata: input.metadata,
  });
  return task;
}

export interface CreateBatchInput {
  groupId: string;
  creatorAgentId: string;
  companyId: string;
  tasks: {
    handlerAgentId: string;
    input: string;
    metadata?: Record<string, any>;
  }[];
  maxRetries?: number;
  onGroupComplete?: ITaskCallback;
}

export async function createTaskBatch(input: CreateBatchInput): Promise<ITask[]> {
  const docs = input.tasks.map((t, i) => ({
    groupId: input.groupId,
    creatorAgentId: input.creatorAgentId,
    handlerAgentId: t.handlerAgentId,
    companyId: input.companyId,
    input: t.input,
    status: 'pending' as TaskStatus,
    retryCount: 0,
    maxRetries: input.maxRetries ?? 2,
    // Store callback only on first task to avoid duplication
    ...(i === 0 && input.onGroupComplete ? { onGroupComplete: input.onGroupComplete } : {}),
    metadata: t.metadata,
  }));
  const tasks = await Task.insertMany(docs);
  return tasks as ITask[];
}

export async function getTask(taskId: string): Promise<any | null> {
  if (!mongoose.Types.ObjectId.isValid(taskId)) return null;
  return Task.findById(taskId).lean();
}

export async function listTasksByGroup(
  groupId: string,
  companyId: string,
): Promise<any[]> {
  return Task.find({ groupId, companyId }).sort({ createdAt: 1 }).lean();
}

export async function listTasksByCreator(
  creatorAgentId: string,
  companyId: string,
  status?: TaskStatus,
  limit = 50,
): Promise<any[]> {
  const query: Record<string, any> = { creatorAgentId, companyId };
  if (status) query.status = status;
  return Task.find(query).sort({ createdAt: -1 }).limit(limit).lean();
}

export interface TaskGroupSummary {
  groupId: string;
  total: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
  cancelled: number;
  allDone: boolean;
  results: { taskId: string; status: TaskStatus; output?: any; error?: string }[];
}

export async function getTaskGroupSummary(
  groupId: string,
  companyId: string,
): Promise<TaskGroupSummary> {
  const tasks = await Task.find({ groupId, companyId }).lean();

  const counts = { pending: 0, running: 0, completed: 0, failed: 0, cancelled: 0 };
  for (const t of tasks) {
    counts[t.status as keyof typeof counts]++;
  }

  return {
    groupId,
    total: tasks.length,
    ...counts,
    allDone: counts.pending === 0 && counts.running === 0,
    results: tasks.map((t) => ({
      taskId: String(t._id),
      status: t.status,
      output: t.output,
      error: t.error,
    })),
  };
}

export async function cancelTask(taskId: string): Promise<any | null> {
  return Task.findOneAndUpdate(
    { _id: taskId, status: { $in: ['pending'] } },
    { $set: { status: 'cancelled', completedAt: new Date() } },
    { new: true },
  ).lean();
}

export async function cancelTaskGroup(
  groupId: string,
  companyId: string,
): Promise<number> {
  const result = await Task.updateMany(
    { groupId, companyId, status: { $in: ['pending'] } },
    { $set: { status: 'cancelled', completedAt: new Date() } },
  );
  return result.modifiedCount;
}
