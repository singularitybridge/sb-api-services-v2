/**
 * Agent Tasks Actions
 *
 * Enables any agent to create, track, and manage background tasks
 * executed by other agents. Tasks run stateless via /execute.
 *
 * Actions:
 *   createTasks  — create one or more tasks in a group
 *   listTasks    — list tasks by group or creator
 *   getTaskGroup — get summary of a task group (progress, results)
 *   cancelTasks  — cancel pending tasks in a group
 */

import {
  ActionContext,
  FunctionFactory,
  StandardActionResult,
} from '../actions/types';
import { executeAction } from '../actions/executor';
import { ActionValidationError } from '../../utils/actionErrors';
import {
  createTask,
  createTaskBatch,
  listTasksByGroup,
  listTasksByCreator,
  getTaskGroupSummary,
  cancelTask,
  cancelTaskGroup,
  validateConnection,
} from './agent_tasks.service';
import { startTaskRunner } from './agent_tasks.runner';

export { validateConnection };

// Lazy-start: runner boots on first integration use — no Agent Hub code changes needed
let runnerStarted = false;

export const createAgentTasksActions = (
  context: ActionContext,
): FunctionFactory => {
  if (!runnerStarted) {
    runnerStarted = true;
    startTaskRunner();
  }

  return {

  // ── Create Tasks ──────────────────────────────────────────────

  createTasks: {
    description:
      'Create one or more background tasks to be executed by a specified handler agent. ' +
      'Tasks run in parallel, each as a stateless agent execution. ' +
      'Use groupId to track related tasks together. ' +
      'Optionally set onGroupComplete to trigger a callback when all tasks in the group finish.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        groupId: {
          type: 'string',
          description:
            'Unique identifier grouping related tasks (e.g. "trip-gen-rome-abc123"). ' +
            'Use the same groupId for all tasks that belong to one workflow.',
        },
        tasks: {
          type: 'array',
          description: 'Array of tasks to create. Each task runs independently in parallel.',
          items: {
            type: 'object',
            properties: {
              handlerAgentId: {
                type: 'string',
                description:
                  'ID of the agent that will execute this task (stateless /execute mode). ' +
                  'Can be any agent the creator has access to.',
              },
              input: {
                type: 'string',
                description:
                  'The instruction/prompt for the handler agent. ' +
                  'This becomes the userInput in the stateless execution.',
              },
              metadata: {
                type: 'object',
                description: 'Optional key-value metadata for tracking (e.g. { dayNum: 1, phase: "enrich" })',
                properties: {},
                additionalProperties: true,
              },
            },
            required: ['handlerAgentId', 'input'],
            additionalProperties: false,
          },
        },
        onGroupComplete: {
          type: 'object',
          description:
            'Optional callback triggered when ALL tasks in the group complete. ' +
            'Use "execute_agent" to call another agent with the results, ' +
            '"integration_action" to trigger an integration action, ' +
            'or "webhook" to POST to a URL.',
          properties: {
            type: {
              type: 'string',
              enum: ['execute_agent', 'integration_action', 'webhook'],
              description: 'Callback type',
            },
            agentId: {
              type: 'string',
              description: 'For execute_agent: ID of the agent to call with results',
            },
            input: {
              type: 'string',
              description: 'For execute_agent: instruction template. Task results will be appended.',
            },
            integration: {
              type: 'string',
              description: 'For integration_action: integration name (e.g. "trip_os")',
            },
            action: {
              type: 'string',
              description: 'For integration_action: action name (e.g. "updateTrip")',
            },
            params: {
              type: 'object',
              description: 'For integration_action: action parameters',
              properties: {},
              additionalProperties: true,
            },
            url: {
              type: 'string',
              description: 'For webhook: URL to POST results to',
            },
          },
          required: ['type'],
          additionalProperties: false,
        },
        maxRetries: {
          type: 'number',
          description: 'Max retry attempts per task on failure (default: 2)',
        },
      },
      required: ['groupId', 'tasks'],
      additionalProperties: false,
    },
    function: async (args: {
      groupId: string;
      tasks: { handlerAgentId: string; input: string; metadata?: Record<string, any> }[];
      onGroupComplete?: {
        type: 'execute_agent' | 'integration_action' | 'webhook';
        agentId?: string;
        input?: string;
        integration?: string;
        action?: string;
        params?: Record<string, any>;
        url?: string;
      };
      maxRetries?: number;
    }): Promise<StandardActionResult> => {
      if (!context.companyId) throw new ActionValidationError('Company ID is missing.');
      if (!context.assistantId) throw new ActionValidationError('Assistant ID is missing.');
      if (!args.tasks || args.tasks.length === 0) {
        throw new ActionValidationError('At least one task is required.');
      }
      if (args.tasks.length > 50) {
        throw new ActionValidationError('Maximum 50 tasks per batch.');
      }

      return executeAction('createTasks', async () => {
        const tasks = await createTaskBatch({
          groupId: args.groupId,
          creatorAgentId: context.assistantId!,
          companyId: context.companyId,
          tasks: args.tasks,
          maxRetries: args.maxRetries,
          onGroupComplete: args.onGroupComplete,
        });

        return {
          success: true,
          data: {
            groupId: args.groupId,
            created: tasks.length,
            taskIds: tasks.map((t) => String(t._id)),
          },
          description: `Created ${tasks.length} tasks in group "${args.groupId}". They will execute in the background.`,
        };
      }, { serviceName: 'agentTasks' });
    },
  },

  // ── List Tasks ────────────────────────────────────────────────

  listTasks: {
    description:
      'List tasks. Filter by groupId to see tasks in a specific workflow, ' +
      'or omit groupId to see all tasks created by the current agent.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        groupId: {
          type: 'string',
          description: 'Filter by task group ID',
        },
        status: {
          type: 'string',
          enum: ['pending', 'running', 'completed', 'failed', 'cancelled'],
          description: 'Filter by task status',
        },
        limit: {
          type: 'number',
          description: 'Max tasks to return (default: 50)',
        },
      },
      required: [],
      additionalProperties: false,
    },
    function: async (args: {
      groupId?: string;
      status?: string;
      limit?: number;
    }): Promise<StandardActionResult> => {
      if (!context.companyId) throw new ActionValidationError('Company ID is missing.');

      return executeAction('listTasks', async () => {
        let tasks;
        if (args.groupId) {
          tasks = await listTasksByGroup(args.groupId, context.companyId);
        } else {
          tasks = await listTasksByCreator(
            context.assistantId || '',
            context.companyId,
            args.status as any,
            args.limit || 50,
          );
        }

        return {
          success: true,
          data: tasks.map((t) => ({
            taskId: String(t._id),
            groupId: t.groupId,
            handlerAgentId: t.handlerAgentId,
            status: t.status,
            input: t.input.substring(0, 200) + (t.input.length > 200 ? '...' : ''),
            output: t.output,
            error: t.error,
            metadata: t.metadata,
            createdAt: t.createdAt,
            startedAt: t.startedAt,
            completedAt: t.completedAt,
          })),
          description: `Found ${tasks.length} tasks`,
        };
      }, { serviceName: 'agentTasks' });
    },
  },

  // ── Get Task Group Summary ────────────────────────────────────

  getTaskGroup: {
    description:
      'Get a summary of all tasks in a group: how many are pending, running, completed, failed. ' +
      'Also returns the output/error of each task. Use this to check progress of a workflow.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        groupId: {
          type: 'string',
          description: 'The task group ID to summarize',
        },
      },
      required: ['groupId'],
      additionalProperties: false,
    },
    function: async (args: { groupId: string }): Promise<StandardActionResult> => {
      if (!context.companyId) throw new ActionValidationError('Company ID is missing.');

      return executeAction('getTaskGroup', async () => {
        const summary = await getTaskGroupSummary(args.groupId, context.companyId);
        return {
          success: true,
          data: summary,
          description: summary.allDone
            ? `Group "${args.groupId}": all ${summary.total} tasks done (${summary.completed} completed, ${summary.failed} failed)`
            : `Group "${args.groupId}": ${summary.completed + summary.failed}/${summary.total} done (${summary.running} running, ${summary.pending} pending)`,
        };
      }, { serviceName: 'agentTasks' });
    },
  },

  // ── Cancel Tasks ──────────────────────────────────────────────

  cancelTasks: {
    description:
      'Cancel pending tasks. Provide a taskId to cancel a single task, or a groupId to cancel all pending tasks in a group. Running tasks cannot be cancelled.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'Cancel a specific task by ID',
        },
        groupId: {
          type: 'string',
          description: 'Cancel all pending tasks in this group',
        },
      },
      required: [],
      additionalProperties: false,
    },
    function: async (args: {
      taskId?: string;
      groupId?: string;
    }): Promise<StandardActionResult> => {
      if (!context.companyId) throw new ActionValidationError('Company ID is missing.');
      if (!args.taskId && !args.groupId) {
        throw new ActionValidationError('Provide either taskId or groupId.');
      }

      return executeAction('cancelTasks', async () => {
        if (args.taskId) {
          const task = await cancelTask(args.taskId);
          return {
            success: true,
            data: { cancelled: task ? 1 : 0 },
            description: task
              ? `Cancelled task ${args.taskId}`
              : `Task ${args.taskId} not found or not in pending status`,
          };
        }

        const count = await cancelTaskGroup(args.groupId!, context.companyId);
        return {
          success: true,
          data: { cancelled: count },
          description: `Cancelled ${count} pending tasks in group "${args.groupId}"`,
        };
      }, { serviceName: 'agentTasks' });
    },
  },
  };
};
