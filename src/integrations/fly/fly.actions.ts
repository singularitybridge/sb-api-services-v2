import {
  ActionContext,
  FunctionFactory,
  StandardActionResult,
} from '../actions/types';
import { executeAction } from '../actions/executor';
import { ActionValidationError } from '../../utils/actionErrors';
import * as flyService from './fly.service';

// Re-export validateConnection for the Test Connection button
export { validateConnection } from './fly.service';

/**
 * Validate Fly.io app name format
 * Fly.io app names must be lowercase alphanumeric with hyphens, 1-63 chars
 */
function validateAppName(appName: string): void {
  if (!appName || typeof appName !== 'string') {
    throw new ActionValidationError('App name is required.');
  }
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(appName)) {
    throw new ActionValidationError(
      'Invalid app name format. Must be lowercase alphanumeric with hyphens, 1-63 characters, starting with a letter or number.'
    );
  }
}

/**
 * Create Fly.io integration actions
 */
export const createFlyActions = (context: ActionContext): FunctionFactory => ({
  /**
   * List all apps in the organization
   */
  flyListApps: {
    description: 'List all Fly.io apps (sandboxes) in your organization with their status and URLs',
    strict: true,
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    function: async (): Promise<StandardActionResult<{ apps: Array<flyService.FlyApp & { url: string }> }>> => {
      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }

      return executeAction(
        'flyListApps',
        async () => {
          const apps = await flyService.listApps(context.companyId);
          const appsWithUrls = apps.map(app => ({
            ...app,
            url: `https://${app.name}.fly.dev`,
          }));
          return {
            success: true,
            data: { apps: appsWithUrls },
          };
        },
        { serviceName: 'fly' }
      );
    },
  },

  /**
   * Get details about a specific app
   */
  flyGetApp: {
    description: 'Get details about a Fly.io app including its URL, status, and machine count',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        appName: {
          type: 'string',
          description: 'The name of the Fly.io app (e.g., "catvet-records")',
        },
      },
      required: ['appName'],
      additionalProperties: false,
    },
    function: async (args: { appName: string }): Promise<StandardActionResult<{ app: flyService.FlyApp & { hostname: string } }>> => {
      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }

      validateAppName(args.appName);

      return executeAction(
        'flyGetApp',
        async () => {
          const app = await flyService.getApp(context.companyId, args.appName);
          return {
            success: true,
            data: { app },
          };
        },
        { serviceName: 'fly' }
      );
    },
  },

  /**
   * Create a new Fly.io app (sandbox)
   */
  flyCreateApp: {
    description: 'Create a new Fly.io app (sandbox). This creates the app container - use flyDeployApp to add a machine.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        appName: {
          type: 'string',
          description: 'Unique name for the app (will be the subdomain: appname.fly.dev)',
        },
      },
      required: ['appName'],
      additionalProperties: false,
    },
    function: async (args: { appName: string }): Promise<StandardActionResult<{ app: flyService.FlyApp & { hostname: string } }>> => {
      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }

      validateAppName(args.appName);

      return executeAction(
        'flyCreateApp',
        async () => {
          const app = await flyService.createApp(context.companyId, args.appName);
          return {
            success: true,
            message: `App ${args.appName} created. URL: ${app.hostname}`,
            data: { app },
          };
        },
        { serviceName: 'fly' }
      );
    },
  },

  /**
   * Delete a Fly.io app and all its resources
   */
  flyDeleteApp: {
    description: 'Delete a Fly.io app and all its resources (machines, volumes). WARNING: This cannot be undone!',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        appName: {
          type: 'string',
          description: 'Name of the app to delete',
        },
      },
      required: ['appName'],
      additionalProperties: false,
    },
    function: async (args: { appName: string }): Promise<StandardActionResult<{ message: string }>> => {
      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }

      validateAppName(args.appName);

      return executeAction(
        'flyDeleteApp',
        async () => {
          const result = await flyService.deleteApp(context.companyId, args.appName);
          return {
            success: true,
            message: result.message,
            data: result,
          };
        },
        { serviceName: 'fly' }
      );
    },
  },

  /**
   * Deploy to a Fly.io app - creates machine with volume
   */
  flyDeployApp: {
    description: 'Deploy to a Fly.io app - creates a machine with optional volume. Clone from existing app or specify image.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        appName: {
          type: 'string',
          description: 'Name of the app to deploy to',
        },
        sourceApp: {
          type: 'string',
          description: 'Clone configuration from this existing app (e.g., "catvet-records")',
        },
        image: {
          type: 'string',
          description: 'Docker image to deploy (alternative to sourceApp)',
        },
        region: {
          type: 'string',
          description: 'Region to deploy to (default: "fra")',
        },
        volumeSizeGb: {
          type: 'number',
          description: 'Size of volume to create in GB (default: 1). Set to 0 for no volume.',
        },
        volumePath: {
          type: 'string',
          description: 'Mount path for volume (default: "/data")',
        },
        autoStop: {
          type: 'string',
          enum: ['off', 'stop', 'suspend'],
          description: 'Auto-stop behavior: "suspend" (quick wake), "stop" (cold start), "off" (always on)',
        },
      },
      required: ['appName'],
      additionalProperties: false,
    },
    function: async (args: {
      appName: string;
      sourceApp?: string;
      image?: string;
      region?: string;
      volumeSizeGb?: number;
      volumePath?: string;
      autoStop?: 'off' | 'stop' | 'suspend';
    }): Promise<StandardActionResult<{ machine: flyService.FlyMachine; volume?: flyService.FlyVolume; url: string }>> => {
      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }

      validateAppName(args.appName);

      if (!args.sourceApp && !args.image) {
        throw new ActionValidationError('Either sourceApp or image must be provided.');
      }

      return executeAction(
        'flyDeployApp',
        async () => {
          const result = await flyService.deployApp(context.companyId, args.appName, {
            sourceApp: args.sourceApp,
            image: args.image,
            region: args.region,
            volumeName: args.volumeSizeGb !== 0 ? 'data' : undefined,
            volumeSizeGb: args.volumeSizeGb !== 0 ? args.volumeSizeGb : undefined,
            volumePath: args.volumePath,
            autoStop: args.autoStop,
          });
          return {
            success: true,
            message: `Deployed to ${args.appName}. URL: ${result.url}`,
            data: result,
          };
        },
        { serviceName: 'fly' }
      );
    },
  },

  /**
   * Start all machines in an app
   */
  flyStartApp: {
    description: 'Start all machines in a Fly.io app',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        appName: {
          type: 'string',
          description: 'Name of the app to start',
        },
      },
      required: ['appName'],
      additionalProperties: false,
    },
    function: async (args: { appName: string }): Promise<StandardActionResult<{ machineIds: string[] }>> => {
      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }

      return executeAction(
        'flyStartApp',
        async () => {
          const result = await flyService.startApp(context.companyId, args.appName);
          return {
            success: true,
            message: result.message,
            data: { machineIds: result.machineIds },
          };
        },
        { serviceName: 'fly' }
      );
    },
  },

  /**
   * Stop all machines in an app
   */
  flyStopApp: {
    description: 'Stop all machines in a Fly.io app',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        appName: {
          type: 'string',
          description: 'Name of the app to stop',
        },
      },
      required: ['appName'],
      additionalProperties: false,
    },
    function: async (args: { appName: string }): Promise<StandardActionResult<{ machineIds: string[] }>> => {
      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }

      return executeAction(
        'flyStopApp',
        async () => {
          const result = await flyService.stopApp(context.companyId, args.appName);
          return {
            success: true,
            message: result.message,
            data: { machineIds: result.machineIds },
          };
        },
        { serviceName: 'fly' }
      );
    },
  },

  /**
   * Restart all machines in an app
   */
  flyRestartApp: {
    description: 'Restart all machines in a Fly.io app (stop + start)',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        appName: {
          type: 'string',
          description: 'Name of the app to restart',
        },
      },
      required: ['appName'],
      additionalProperties: false,
    },
    function: async (args: { appName: string }): Promise<StandardActionResult<{ machineIds: string[] }>> => {
      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }

      return executeAction(
        'flyRestartApp',
        async () => {
          const result = await flyService.restartApp(context.companyId, args.appName);
          return {
            success: true,
            message: result.message,
            data: { machineIds: result.machineIds },
          };
        },
        { serviceName: 'fly' }
      );
    },
  },

  /**
   * Suspend all machines in an app
   */
  flySuspendApp: {
    description: 'Suspend all machines in a Fly.io app to save costs (quick resume)',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        appName: {
          type: 'string',
          description: 'Name of the app to suspend',
        },
      },
      required: ['appName'],
      additionalProperties: false,
    },
    function: async (args: { appName: string }): Promise<StandardActionResult<{ machineIds: string[] }>> => {
      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }

      return executeAction(
        'flySuspendApp',
        async () => {
          const result = await flyService.suspendApp(context.companyId, args.appName);
          return {
            success: true,
            message: result.message,
            data: { machineIds: result.machineIds },
          };
        },
        { serviceName: 'fly' }
      );
    },
  },

  /**
   * List machines in an app
   */
  flyListMachines: {
    description: 'List all machines (VMs) running in a Fly.io app with their status, region, and IPs',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        appName: {
          type: 'string',
          description: 'The name of the Fly.io app',
        },
      },
      required: ['appName'],
      additionalProperties: false,
    },
    function: async (args: { appName: string }): Promise<StandardActionResult<{ machines: flyService.FlyMachine[] }>> => {
      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }

      validateAppName(args.appName);

      return executeAction(
        'flyListMachines',
        async () => {
          const machines = await flyService.listMachines(context.companyId, args.appName);
          return {
            success: true,
            data: { machines },
          };
        },
        { serviceName: 'fly' }
      );
    },
  },

  /**
   * Get machine details
   */
  flyGetMachine: {
    description: 'Get detailed information about a specific machine including its configuration and state',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        appName: {
          type: 'string',
          description: 'The name of the Fly.io app',
        },
        machineId: {
          type: 'string',
          description: 'The machine ID (e.g., "e784079a449298")',
        },
      },
      required: ['appName', 'machineId'],
      additionalProperties: false,
    },
    function: async (args: { appName: string; machineId: string }): Promise<StandardActionResult<{ machine: flyService.FlyMachine }>> => {
      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }

      validateAppName(args.appName);
      if (!args.machineId) {
        throw new ActionValidationError('Machine ID is required.');
      }

      return executeAction(
        'flyGetMachine',
        async () => {
          const machine = await flyService.getMachine(context.companyId, args.appName, args.machineId);
          return {
            success: true,
            data: { machine },
          };
        },
        { serviceName: 'fly' }
      );
    },
  },

  /**
   * Start a machine
   */
  flyStartMachine: {
    description: 'Start a stopped or suspended machine',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        appName: {
          type: 'string',
          description: 'The name of the Fly.io app',
        },
        machineId: {
          type: 'string',
          description: 'The machine ID to start',
        },
      },
      required: ['appName', 'machineId'],
      additionalProperties: false,
    },
    function: async (args: { appName: string; machineId: string }): Promise<StandardActionResult<{ message: string }>> => {
      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }

      validateAppName(args.appName);
      if (!args.machineId) {
        throw new ActionValidationError('Machine ID is required.');
      }

      return executeAction(
        'flyStartMachine',
        async () => {
          const result = await flyService.startMachine(context.companyId, args.appName, args.machineId);
          return {
            success: true,
            message: result.message,
            data: result,
          };
        },
        { serviceName: 'fly' }
      );
    },
  },

  /**
   * Stop a machine
   */
  flyStopMachine: {
    description: 'Stop a running machine (it can be started again later)',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        appName: {
          type: 'string',
          description: 'The name of the Fly.io app',
        },
        machineId: {
          type: 'string',
          description: 'The machine ID to stop',
        },
      },
      required: ['appName', 'machineId'],
      additionalProperties: false,
    },
    function: async (args: { appName: string; machineId: string }): Promise<StandardActionResult<{ message: string }>> => {
      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }

      validateAppName(args.appName);
      if (!args.machineId) {
        throw new ActionValidationError('Machine ID is required.');
      }

      return executeAction(
        'flyStopMachine',
        async () => {
          const result = await flyService.stopMachine(context.companyId, args.appName, args.machineId);
          return {
            success: true,
            message: result.message,
            data: result,
          };
        },
        { serviceName: 'fly' }
      );
    },
  },

  /**
   * Restart a machine
   */
  flyRestartMachine: {
    description: 'Restart a machine (stops and starts it). Useful for applying configuration changes or recovering from issues.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        appName: {
          type: 'string',
          description: 'The name of the Fly.io app',
        },
        machineId: {
          type: 'string',
          description: 'The machine ID to restart',
        },
      },
      required: ['appName', 'machineId'],
      additionalProperties: false,
    },
    function: async (args: { appName: string; machineId: string }): Promise<StandardActionResult<{ message: string }>> => {
      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }

      validateAppName(args.appName);
      if (!args.machineId) {
        throw new ActionValidationError('Machine ID is required.');
      }

      return executeAction(
        'flyRestartMachine',
        async () => {
          const result = await flyService.restartMachine(context.companyId, args.appName, args.machineId);
          return {
            success: true,
            message: result.message,
            data: result,
          };
        },
        { serviceName: 'fly' }
      );
    },
  },

  /**
   * Suspend a machine
   */
  flySuspendMachine: {
    description: 'Suspend a machine to save costs. The machine state is preserved and can be resumed quickly with start.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        appName: {
          type: 'string',
          description: 'The name of the Fly.io app',
        },
        machineId: {
          type: 'string',
          description: 'The machine ID to suspend',
        },
      },
      required: ['appName', 'machineId'],
      additionalProperties: false,
    },
    function: async (args: { appName: string; machineId: string }): Promise<StandardActionResult<{ message: string }>> => {
      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }

      validateAppName(args.appName);
      if (!args.machineId) {
        throw new ActionValidationError('Machine ID is required.');
      }

      return executeAction(
        'flySuspendMachine',
        async () => {
          const result = await flyService.suspendMachine(context.companyId, args.appName, args.machineId);
          return {
            success: true,
            message: result.message,
            data: result,
          };
        },
        { serviceName: 'fly' }
      );
    },
  },

  /**
   * Wait for machine state
   */
  flyWaitForMachine: {
    description: 'Wait for a machine to reach a specific state (started, stopped, or suspended). Useful after start/stop operations.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        appName: {
          type: 'string',
          description: 'The name of the Fly.io app',
        },
        machineId: {
          type: 'string',
          description: 'The machine ID to wait for',
        },
        state: {
          type: 'string',
          enum: ['started', 'stopped', 'suspended'],
          description: 'The desired state to wait for',
        },
      },
      required: ['appName', 'machineId', 'state'],
      additionalProperties: false,
    },
    function: async (args: { appName: string; machineId: string; state: 'started' | 'stopped' | 'suspended' }): Promise<StandardActionResult<{ state: string }>> => {
      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }

      validateAppName(args.appName);
      if (!args.machineId || !args.state) {
        throw new ActionValidationError('Machine ID and state are required.');
      }

      return executeAction(
        'flyWaitForMachine',
        async () => {
          const result = await flyService.waitForMachine(
            context.companyId,
            args.appName,
            args.machineId,
            args.state
          );
          return {
            success: true,
            message: `Machine reached ${result.state} state`,
            data: result,
          };
        },
        { serviceName: 'fly' }
      );
    },
  },

  /**
   * Delete a machine
   */
  flyDeleteMachine: {
    description: 'Permanently delete a machine. WARNING: This cannot be undone. The machine will be force-stopped if running.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        appName: {
          type: 'string',
          description: 'The name of the Fly.io app',
        },
        machineId: {
          type: 'string',
          description: 'The machine ID to delete',
        },
      },
      required: ['appName', 'machineId'],
      additionalProperties: false,
    },
    function: async (args: { appName: string; machineId: string }): Promise<StandardActionResult<{ message: string }>> => {
      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }

      validateAppName(args.appName);
      if (!args.machineId) {
        throw new ActionValidationError('Machine ID is required.');
      }

      return executeAction(
        'flyDeleteMachine',
        async () => {
          const result = await flyService.deleteMachine(context.companyId, args.appName, args.machineId);
          return {
            success: true,
            message: result.message,
            data: result,
          };
        },
        { serviceName: 'fly' }
      );
    },
  },

  /**
   * Create a new machine
   */
  flyCreateMachine: {
    description: 'Create a new machine in an app. Can optionally attach a volume and set auto-stop behavior.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        appName: {
          type: 'string',
          description: 'The name of the Fly.io app',
        },
        name: {
          type: 'string',
          description: 'Optional name for the machine (auto-generated if not provided)',
        },
        region: {
          type: 'string',
          description: 'Region (e.g., "fra", "lax", "ord"). Defaults to app\'s primary region.',
        },
        volumeId: {
          type: 'string',
          description: 'Optional volume ID to attach. Create a volume first with flyCreateVolume.',
        },
        volumePath: {
          type: 'string',
          description: 'Mount path for the volume (default: "/data")',
        },
        autoStop: {
          type: 'string',
          enum: ['off', 'stop', 'suspend'],
          description: 'Auto-stop behavior: "suspend" (quick wake ~300ms), "stop" (cold start), "off" (always running)',
        },
      },
      required: ['appName'],
      additionalProperties: false,
    },
    function: async (args: {
      appName: string;
      name?: string;
      region?: string;
      volumeId?: string;
      volumePath?: string;
      autoStop?: 'off' | 'stop' | 'suspend';
    }): Promise<StandardActionResult<{ machine: flyService.FlyMachine; url: string }>> => {
      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }

      validateAppName(args.appName);

      return executeAction(
        'flyCreateMachine',
        async () => {
          const machine = await flyService.createMachine(context.companyId, args.appName, {
            name: args.name,
            region: args.region,
            volumeId: args.volumeId,
            volumePath: args.volumePath,
            autoStop: args.autoStop,
          });
          return {
            success: true,
            message: `Machine ${machine.id} created`,
            data: {
              machine,
              url: `https://${args.appName}.fly.dev`,
            },
          };
        },
        { serviceName: 'fly' }
      );
    },
  },

  /**
   * Scale machines
   */
  flyScaleMachines: {
    description: 'Scale an app to a specific number of machines. Creates new machines or deletes excess ones as needed. Note: For apps with volumes, use flyScaleWithVolumes instead.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        appName: {
          type: 'string',
          description: 'The name of the Fly.io app',
        },
        count: {
          type: 'number',
          description: 'Target number of machines (e.g., 2 for two machines)',
        },
        region: {
          type: 'string',
          description: 'Region for new machines (e.g., "fra", "lax"). Only used when scaling up.',
        },
      },
      required: ['appName', 'count'],
      additionalProperties: false,
    },
    function: async (args: { appName: string; count: number; region?: string }): Promise<StandardActionResult<{ machines: Array<{ id: string; name: string; state: string; region: string; url: string }> }>> => {
      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }

      validateAppName(args.appName);
      if (args.count === undefined) {
        throw new ActionValidationError('Count is required.');
      }

      if (args.count < 0) {
        throw new ActionValidationError('Count must be 0 or greater.');
      }

      return executeAction(
        'flyScaleMachines',
        async () => {
          const result = await flyService.scaleMachines(
            context.companyId,
            args.appName,
            args.count,
            args.region
          );
          const machinesWithUrls = result.machines.map(m => ({
            id: m.id,
            name: m.name,
            state: m.state,
            region: m.region,
            url: `https://${args.appName}.fly.dev`,
          }));
          return {
            success: true,
            message: result.message,
            data: { machines: machinesWithUrls },
          };
        },
        { serviceName: 'fly' }
      );
    },
  },

  /**
   * List volumes
   */
  flyListVolumes: {
    description: 'List all volumes for a Fly.io app with their size, region, and attached machine',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        appName: {
          type: 'string',
          description: 'The name of the Fly.io app',
        },
      },
      required: ['appName'],
      additionalProperties: false,
    },
    function: async (args: { appName: string }): Promise<StandardActionResult<{ volumes: flyService.FlyVolume[] }>> => {
      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }

      validateAppName(args.appName);

      return executeAction(
        'flyListVolumes',
        async () => {
          const volumes = await flyService.listVolumes(context.companyId, args.appName);
          return {
            success: true,
            data: { volumes },
          };
        },
        { serviceName: 'fly' }
      );
    },
  },

  /**
   * Create volume
   */
  flyCreateVolume: {
    description: 'Create a new persistent volume for a Fly.io app',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        appName: {
          type: 'string',
          description: 'The name of the Fly.io app',
        },
        name: {
          type: 'string',
          description: 'Name for the volume (e.g., "data", "catvet_data")',
        },
        region: {
          type: 'string',
          description: 'Region for the volume (e.g., "fra", "lax"). Must match machine region.',
        },
        sizeGb: {
          type: 'number',
          description: 'Size in GB (default: 1)',
        },
      },
      required: ['appName', 'name', 'region'],
      additionalProperties: false,
    },
    function: async (args: { appName: string; name: string; region: string; sizeGb?: number }): Promise<StandardActionResult<{ volume: flyService.FlyVolume }>> => {
      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }

      validateAppName(args.appName);
      if (!args.name || !args.region) {
        throw new ActionValidationError('Volume name and region are required.');
      }

      return executeAction(
        'flyCreateVolume',
        async () => {
          const volume = await flyService.createVolume(context.companyId, args.appName, {
            name: args.name,
            region: args.region,
            sizeGb: args.sizeGb,
          });
          return {
            success: true,
            message: `Volume ${volume.id} created`,
            data: { volume },
          };
        },
        { serviceName: 'fly' }
      );
    },
  },

  /**
   * Delete volume
   */
  flyDeleteVolume: {
    description: 'Delete a volume. WARNING: This permanently deletes the volume and all data.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        appName: {
          type: 'string',
          description: 'The name of the Fly.io app',
        },
        volumeId: {
          type: 'string',
          description: 'The volume ID to delete',
        },
      },
      required: ['appName', 'volumeId'],
      additionalProperties: false,
    },
    function: async (args: { appName: string; volumeId: string }): Promise<StandardActionResult<{ message: string }>> => {
      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }

      validateAppName(args.appName);
      if (!args.volumeId) {
        throw new ActionValidationError('Volume ID is required.');
      }

      return executeAction(
        'flyDeleteVolume',
        async () => {
          const result = await flyService.deleteVolume(context.companyId, args.appName, args.volumeId);
          return {
            success: true,
            message: result.message,
            data: result,
          };
        },
        { serviceName: 'fly' }
      );
    },
  },

  /**
   * Update machine config
   */
  flyUpdateMachineConfig: {
    description: 'Update a machine\'s configuration including environment variables, resources, and services. Machine will be restarted to apply changes.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        appName: {
          type: 'string',
          description: 'The name of the Fly.io app',
        },
        machineId: {
          type: 'string',
          description: 'The machine ID to update',
        },
        env: {
          type: 'object',
          description: 'Environment variables to set or update (merged with existing). Use null to delete a key.',
          additionalProperties: { type: 'string' },
        },
        cpus: {
          type: 'number',
          description: 'Number of CPUs (e.g., 1, 2, 4)',
        },
        memoryMb: {
          type: 'number',
          description: 'Memory in MB (e.g., 256, 512, 1024)',
        },
        autoStop: {
          type: 'string',
          enum: ['off', 'stop', 'suspend'],
          description: 'Auto-stop behavior: "suspend" (quick wake), "stop" (cold start), "off" (always on)',
        },
      },
      required: ['appName', 'machineId'],
      additionalProperties: false,
    },
    function: async (args: {
      appName: string;
      machineId: string;
      env?: Record<string, string>;
      cpus?: number;
      memoryMb?: number;
      autoStop?: 'off' | 'stop' | 'suspend';
    }): Promise<StandardActionResult<{ machine: flyService.FlyMachine }>> => {
      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }

      validateAppName(args.appName);
      if (!args.machineId) {
        throw new ActionValidationError('Machine ID is required.');
      }

      return executeAction(
        'flyUpdateMachineConfig',
        async () => {
          const configUpdates: Partial<flyService.FlyMachineConfig> = {};

          if (args.env) {
            configUpdates.env = args.env;
          }

          if (args.cpus || args.memoryMb) {
            configUpdates.guest = {};
            if (args.cpus) configUpdates.guest.cpus = args.cpus;
            if (args.memoryMb) configUpdates.guest.memory_mb = args.memoryMb;
          }

          if (args.autoStop) {
            // Will need to update services - fetch current first
            const currentMachine = await flyService.getMachine(context.companyId, args.appName, args.machineId);
            if (currentMachine.config.services) {
              configUpdates.services = currentMachine.config.services.map(service => ({
                ...service,
                autostop: args.autoStop,
                autostart: args.autoStop !== 'off',
              }));
            }
          }

          const machine = await flyService.updateMachineConfig(
            context.companyId,
            args.appName,
            args.machineId,
            configUpdates
          );

          return {
            success: true,
            message: `Machine ${machine.id} configuration updated`,
            data: { machine },
          };
        },
        { serviceName: 'fly' }
      );
    },
  },

  /**
   * List secrets
   */
  flyListSecrets: {
    description: 'List all secrets for a Fly.io app (names only, values are not shown for security)',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        appName: {
          type: 'string',
          description: 'The name of the Fly.io app',
        },
      },
      required: ['appName'],
      additionalProperties: false,
    },
    function: async (args: { appName: string }): Promise<StandardActionResult<{ secrets: flyService.FlySecret[] }>> => {
      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }

      validateAppName(args.appName);

      return executeAction(
        'flyListSecrets',
        async () => {
          const secrets = await flyService.listSecrets(context.companyId, args.appName);
          return {
            success: true,
            data: { secrets },
          };
        },
        { serviceName: 'fly' }
      );
    },
  },

  /**
   * Set secrets
   */
  flySetSecrets: {
    description: 'Set secrets for a Fly.io app. Machines must be restarted to use new secret values.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        appName: {
          type: 'string',
          description: 'The name of the Fly.io app',
        },
        secrets: {
          type: 'object',
          description: 'Key-value pairs of secrets to set (e.g., {"API_KEY": "value", "DATABASE_URL": "postgres://..."})',
          additionalProperties: { type: 'string' },
        },
        restartMachines: {
          type: 'boolean',
          description: 'Whether to automatically restart all machines after setting secrets (default: false)',
        },
      },
      required: ['appName', 'secrets'],
      additionalProperties: false,
    },
    function: async (args: {
      appName: string;
      secrets: Record<string, string>;
      restartMachines?: boolean;
    }): Promise<StandardActionResult<{ message: string; restartedMachines?: string[] }>> => {
      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }

      validateAppName(args.appName);
      if (!args.secrets || Object.keys(args.secrets).length === 0) {
        throw new ActionValidationError('At least one secret is required.');
      }

      return executeAction(
        'flySetSecrets',
        async () => {
          const result = await flyService.setSecrets(context.companyId, args.appName, args.secrets);

          let restartedMachines: string[] | undefined;
          if (args.restartMachines) {
            // Restart all machines to apply secrets
            const machines = await flyService.listMachines(context.companyId, args.appName);
            restartedMachines = [];
            for (const machine of machines) {
              if (machine.state === 'started') {
                await flyService.restartMachine(context.companyId, args.appName, machine.id);
                restartedMachines.push(machine.id);
              }
            }
          }

          return {
            success: true,
            message: result.message + (restartedMachines?.length ? ` Restarted ${restartedMachines.length} machine(s).` : ' Restart machines to apply.'),
            data: {
              message: result.message,
              restartedMachines,
            },
          };
        },
        { serviceName: 'fly' }
      );
    },
  },

  /**
   * Unset secrets
   */
  flyUnsetSecrets: {
    description: 'Remove secrets from a Fly.io app. Machines must be restarted to remove secret values from memory.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        appName: {
          type: 'string',
          description: 'The name of the Fly.io app',
        },
        secretNames: {
          type: 'array',
          items: { type: 'string' },
          description: 'Names of secrets to remove (e.g., ["OLD_API_KEY", "DEPRECATED_TOKEN"])',
        },
        restartMachines: {
          type: 'boolean',
          description: 'Whether to automatically restart all machines after removing secrets (default: false)',
        },
      },
      required: ['appName', 'secretNames'],
      additionalProperties: false,
    },
    function: async (args: {
      appName: string;
      secretNames: string[];
      restartMachines?: boolean;
    }): Promise<StandardActionResult<{ message: string; restartedMachines?: string[] }>> => {
      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }

      validateAppName(args.appName);
      if (!args.secretNames || args.secretNames.length === 0) {
        throw new ActionValidationError('At least one secret name is required.');
      }

      return executeAction(
        'flyUnsetSecrets',
        async () => {
          const result = await flyService.unsetSecrets(context.companyId, args.appName, args.secretNames);

          let restartedMachines: string[] | undefined;
          if (args.restartMachines) {
            const machines = await flyService.listMachines(context.companyId, args.appName);
            restartedMachines = [];
            for (const machine of machines) {
              if (machine.state === 'started') {
                await flyService.restartMachine(context.companyId, args.appName, machine.id);
                restartedMachines.push(machine.id);
              }
            }
          }

          return {
            success: true,
            message: result.message + (restartedMachines?.length ? ` Restarted ${restartedMachines.length} machine(s).` : ' Restart machines to apply.'),
            data: {
              message: result.message,
              restartedMachines,
            },
          };
        },
        { serviceName: 'fly' }
      );
    },
  },

  /**
   * Execute command on machine
   */
  flyExecCommand: {
    description: 'Execute a command on a Fly.io app. If machineId is not provided, automatically selects the first running machine.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        appName: {
          type: 'string',
          description: 'The name of the Fly.io app',
        },
        machineId: {
          type: 'string',
          description: 'Optional: specific machine ID. If not provided, uses first running machine.',
        },
        command: {
          type: 'array',
          items: { type: 'string' },
          description: 'Command as array (e.g., ["ls", "-la", "/data"] or ["sh", "-c", "echo hello"])',
        },
        timeout: {
          type: 'number',
          description: 'Command timeout in seconds (default: 30, max: 300)',
        },
      },
      required: ['appName', 'command'],
      additionalProperties: false,
    },
    function: async (args: {
      appName: string;
      machineId?: string;
      command: string[];
      timeout?: number;
    }): Promise<StandardActionResult<flyService.FlyExecResult>> => {
      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }

      validateAppName(args.appName);
      if (!args.command || args.command.length === 0) {
        throw new ActionValidationError('Command is required.');
      }

      const timeout = Math.min(args.timeout || 30, 300); // Cap at 5 minutes

      return executeAction(
        'flyExecCommand',
        async () => {
          const result = await flyService.execCommand(
            context.companyId,
            args.appName,
            args.machineId || null,
            args.command,
            { timeout }
          );

          return {
            success: result.exit_code === 0,
            message: result.exit_code === 0 ? 'Command executed successfully' : `Command failed with exit code ${result.exit_code}`,
            data: result,
          };
        },
        { serviceName: 'fly' }
      );
    },
  },

  /**
   * Scale with volumes
   */
  flyScaleWithVolumes: {
    description: 'Scale an app that uses volumes. Creates matching volumes for each new machine, or deletes machines and their volumes when scaling down.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        appName: {
          type: 'string',
          description: 'The name of the Fly.io app',
        },
        count: {
          type: 'number',
          description: 'Target number of machines (e.g., 2 for two machines with two volumes)',
        },
        region: {
          type: 'string',
          description: 'Region for new machines/volumes (e.g., "fra", "lax")',
        },
        volumeSizeGb: {
          type: 'number',
          description: 'Size for new volumes in GB (default: 1)',
        },
      },
      required: ['appName', 'count'],
      additionalProperties: false,
    },
    function: async (args: { appName: string; count: number; region?: string; volumeSizeGb?: number }): Promise<StandardActionResult<{
      machines: Array<{ id: string; name: string; state: string; region: string; url: string }>;
      volumes: Array<{ id: string; name: string; size_gb: number; region: string; attached_machine_id: string | null }>;
    }>> => {
      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }

      validateAppName(args.appName);
      if (args.count === undefined) {
        throw new ActionValidationError('Count is required.');
      }

      if (args.count < 0) {
        throw new ActionValidationError('Count must be 0 or greater.');
      }

      return executeAction(
        'flyScaleWithVolumes',
        async () => {
          const result = await flyService.scaleWithVolumes(
            context.companyId,
            args.appName,
            args.count,
            {
              region: args.region,
              volumeSizeGb: args.volumeSizeGb,
            }
          );
          const machinesWithUrls = result.machines.map(m => ({
            id: m.id,
            name: m.name,
            state: m.state,
            region: m.region,
            url: `https://${args.appName}.fly.dev`,
          }));
          const volumeSummary = result.volumes.map(v => ({
            id: v.id,
            name: v.name,
            size_gb: v.size_gb,
            region: v.region,
            attached_machine_id: v.attached_machine_id,
          }));
          return {
            success: true,
            message: result.message,
            data: { machines: machinesWithUrls, volumes: volumeSummary },
          };
        },
        { serviceName: 'fly' }
      );
    },
  },

  /**
   * List IP addresses for an app
   */
  flyListIPs: {
    description: 'List all IP addresses allocated to a Fly.io app',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        appName: {
          type: 'string',
          description: 'The name of the Fly.io app',
        },
      },
      required: ['appName'],
      additionalProperties: false,
    },
    function: async (args: { appName: string }): Promise<StandardActionResult<{ ips: flyService.FlyIPAddress[] }>> => {
      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }

      validateAppName(args.appName);

      return executeAction(
        'flyListIPs',
        async () => {
          const ips = await flyService.listIPs(context.companyId, args.appName);
          return {
            success: true,
            data: { ips },
          };
        },
        { serviceName: 'fly' }
      );
    },
  },

  /**
   * Allocate IP addresses for an app (makes it publicly accessible)
   */
  flyAllocateIPs: {
    description: 'Allocate IP addresses for a Fly.io app to make it publicly accessible. Allocates shared IPv4 (free) and dedicated IPv6 (free).',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        appName: {
          type: 'string',
          description: 'The name of the Fly.io app',
        },
        skipV4: {
          type: 'boolean',
          description: 'Skip IPv4 allocation (default: false)',
        },
        skipV6: {
          type: 'boolean',
          description: 'Skip IPv6 allocation (default: false)',
        },
      },
      required: ['appName'],
      additionalProperties: false,
    },
    function: async (args: { appName: string; skipV4?: boolean; skipV6?: boolean }): Promise<StandardActionResult<{ ips: flyService.FlyIPAddress[]; hostname: string }>> => {
      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }

      validateAppName(args.appName);

      return executeAction(
        'flyAllocateIPs',
        async () => {
          const result = await flyService.allocateIPs(context.companyId, args.appName, {
            skipV4: args.skipV4,
            skipV6: args.skipV6,
          });
          return {
            success: result.success,
            message: result.message,
            data: { ips: result.ips, hostname: `https://${args.appName}.fly.dev` },
          };
        },
        { serviceName: 'fly' }
      );
    },
  },

  /**
   * Release an IP address from an app
   */
  flyReleaseIP: {
    description: 'Release an IP address from a Fly.io app',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        appName: {
          type: 'string',
          description: 'The name of the Fly.io app',
        },
        ipId: {
          type: 'string',
          description: 'The IP address ID to release (from flyListIPs)',
        },
      },
      required: ['appName', 'ipId'],
      additionalProperties: false,
    },
    function: async (args: { appName: string; ipId: string }): Promise<StandardActionResult<null>> => {
      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }

      validateAppName(args.appName);
      if (!args.ipId) {
        throw new ActionValidationError('IP ID is required.');
      }

      return executeAction(
        'flyReleaseIP',
        async () => {
          const result = await flyService.releaseIP(context.companyId, args.appName, args.ipId);
          return {
            success: result.success,
            message: result.message,
            data: null,
          };
        },
        { serviceName: 'fly' }
      );
    },
  },
});
