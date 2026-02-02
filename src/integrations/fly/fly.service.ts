import axios from 'axios';
import { getApiKey } from '../../services/api.key.service';

const FLY_API_BASE = 'https://api.machines.dev/v1';

// Types
export interface FlyVolume {
  id: string;
  name: string;
  state: string;
  size_gb: number;
  region: string;
  zone: string;
  encrypted: boolean;
  attached_machine_id: string | null;
  created_at: string;
}

export interface FlyApp {
  id: string;
  name: string;
  organization: {
    slug: string;
    name: string;
  };
  status: string;
  machine_count?: number;
  volume_count?: number;
}

export interface FlyMachineMount {
  volume: string;
  path: string;
  name: string;
  size_gb?: number;
  encrypted?: boolean;
}

export interface FlyMachineService {
  ports: Array<{
    port: number;
    handlers: string[];
    force_https?: boolean;
  }>;
  protocol: string;
  internal_port: number;
  autostop?: 'off' | 'stop' | 'suspend';
  autostart?: boolean;
  min_machines_running?: number;
}

export interface FlyMachineConfig {
  image: string;
  env?: Record<string, string>;
  services?: FlyMachineService[];
  mounts?: FlyMachineMount[];
  guest?: {
    cpu_kind?: string;
    cpus?: number;
    memory_mb?: number;
  };
  init?: Record<string, any>;
  metadata?: Record<string, string>;
  restart?: {
    policy: string;
    max_retries?: number;
  };
}

export interface FlyMachine {
  id: string;
  name: string;
  state: string;
  region: string;
  instance_id: string;
  private_ip: string;
  config: FlyMachineConfig;
  created_at: string;
  updated_at: string;
}

export interface FlyMachineEvent {
  type: string;
  status: string;
  source: string;
  timestamp: number;
}

// Helper to get credentials
async function getCredentials(companyId: string): Promise<{ token: string; orgSlug: string }> {
  const token = await getApiKey(companyId, 'fly_api_token');
  const orgSlug = await getApiKey(companyId, 'fly_org_slug');

  if (!token) {
    throw new Error('Missing Fly.io API token. Please configure fly_api_token.');
  }

  return { token, orgSlug: orgSlug || 'personal' };
}

// Create axios instance with auth
function createClient(token: string) {
  return axios.create({
    baseURL: FLY_API_BASE,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    timeout: 30000,
  });
}

/**
 * List all apps in the organization
 */
export async function listApps(companyId: string): Promise<FlyApp[]> {
  const { token, orgSlug } = await getCredentials(companyId);
  const client = createClient(token);

  try {
    const response = await client.get(`/apps`, {
      params: { org_slug: orgSlug },
    });
    return response.data.apps || [];
  } catch (error: any) {
    console.error('Error listing Fly.io apps:', error.message);
    throw new Error(
      error.response?.data?.error || error.message || 'Failed to list apps'
    );
  }
}

/**
 * Get app details including URL
 */
export async function getApp(companyId: string, appName: string): Promise<FlyApp & { hostname: string }> {
  const { token } = await getCredentials(companyId);
  const client = createClient(token);

  try {
    const response = await client.get(`/apps/${appName}`);
    return {
      ...response.data,
      hostname: `https://${appName}.fly.dev`,
    };
  } catch (error: any) {
    console.error('Error getting Fly.io app:', error.message);
    throw new Error(
      error.response?.data?.error || error.message || 'Failed to get app details'
    );
  }
}

/**
 * Create a new Fly.io app (sandbox)
 */
export async function createApp(
  companyId: string,
  appName: string,
  options?: {
    region?: string;
  }
): Promise<FlyApp & { hostname: string }> {
  const { token, orgSlug } = await getCredentials(companyId);
  const client = createClient(token);

  try {
    const response = await client.post('/apps', {
      app_name: appName,
      org_slug: orgSlug,
    });

    return {
      ...response.data,
      hostname: `https://${appName}.fly.dev`,
    };
  } catch (error: any) {
    console.error('Error creating Fly.io app:', error.message);
    throw new Error(
      error.response?.data?.error || error.message || 'Failed to create app'
    );
  }
}

/**
 * Delete a Fly.io app and all its resources
 */
export async function deleteApp(
  companyId: string,
  appName: string
): Promise<{ success: boolean; message: string }> {
  const { token } = await getCredentials(companyId);
  const client = createClient(token);

  try {
    // First, delete all machines (force)
    const machinesResponse = await client.get(`/apps/${appName}/machines`);
    const machines = machinesResponse.data || [];

    for (const machine of machines) {
      await client.delete(`/apps/${appName}/machines/${machine.id}`, {
        params: { force: true },
      });
    }

    // Delete all volumes
    const volumesResponse = await client.get(`/apps/${appName}/volumes`);
    const volumes = volumesResponse.data || [];

    for (const volume of volumes) {
      await client.delete(`/apps/${appName}/volumes/${volume.id}`);
    }

    // Finally, delete the app
    await client.delete(`/apps/${appName}`);

    return {
      success: true,
      message: `App ${appName} and all its resources deleted`,
    };
  } catch (error: any) {
    console.error('Error deleting Fly.io app:', error.message);
    throw new Error(
      error.response?.data?.error || error.message || 'Failed to delete app'
    );
  }
}

/**
 * Deploy to a Fly.io app - creates machine with volume
 * Can clone from an existing app or use a specified image
 */
export async function deployApp(
  companyId: string,
  appName: string,
  options: {
    sourceApp?: string; // Clone config from this app
    image?: string; // Or use this image directly
    region?: string;
    volumeName?: string;
    volumeSizeGb?: number;
    volumePath?: string;
    env?: Record<string, string>;
    autoStop?: 'off' | 'stop' | 'suspend';
  }
): Promise<{
  machine: FlyMachine;
  volume?: FlyVolume;
  url: string;
}> {
  const { token } = await getCredentials(companyId);
  const client = createClient(token);

  try {
    let machineConfig: FlyMachineConfig;
    const region = options.region || 'fra';

    // Get config from source app or build new one
    if (options.sourceApp) {
      const sourceMachines = await client.get(`/apps/${options.sourceApp}/machines`);
      if (!sourceMachines.data?.length) {
        throw new Error(`Source app ${options.sourceApp} has no machines to clone from`);
      }
      machineConfig = { ...sourceMachines.data[0].config };
      // Remove existing mounts - we'll create new volume
      delete machineConfig.mounts;
    } else if (options.image) {
      machineConfig = {
        image: options.image,
        env: options.env || {},
        guest: {
          cpu_kind: 'shared',
          cpus: 1,
          memory_mb: 1024,
        },
        services: [
          {
            protocol: 'tcp',
            internal_port: 8080,
            autostop: options.autoStop || 'suspend',
            autostart: true,
            ports: [
              { port: 80, handlers: ['http'], force_https: true },
              { port: 443, handlers: ['http', 'tls'] },
            ],
          },
        ],
        restart: {
          policy: 'on-failure',
          max_retries: 10,
        },
      };
    } else {
      throw new Error('Either sourceApp or image must be provided');
    }

    // Merge env vars
    if (options.env) {
      machineConfig.env = { ...machineConfig.env, ...options.env };
    }

    // Set autoStop if specified
    if (options.autoStop && machineConfig.services) {
      machineConfig.services = machineConfig.services.map(s => ({
        ...s,
        autostop: options.autoStop,
        autostart: options.autoStop !== 'off',
      }));
    }

    // Create volume if requested
    let volume: FlyVolume | undefined;
    if (options.volumeName || options.volumeSizeGb) {
      const volumeName = options.volumeName || 'data';
      const volumeResponse = await client.post(`/apps/${appName}/volumes`, {
        name: volumeName,
        region,
        size_gb: options.volumeSizeGb || 1,
        encrypted: true,
      });
      volume = volumeResponse.data;

      // Attach volume to config
      machineConfig.mounts = [
        {
          volume: volume.id,
          path: options.volumePath || '/data',
          name: volumeName,
        },
      ];
    }

    // Create machine
    const machineResponse = await client.post(
      `/apps/${appName}/machines`,
      {
        config: machineConfig,
        region,
      },
      { timeout: 120000 }
    );

    return {
      machine: machineResponse.data,
      volume,
      url: `https://${appName}.fly.dev`,
    };
  } catch (error: any) {
    console.error('Error deploying to Fly.io app:', error.message);
    throw new Error(
      error.response?.data?.error || error.message || 'Failed to deploy app'
    );
  }
}

/**
 * Start all machines in an app
 */
export async function startApp(
  companyId: string,
  appName: string
): Promise<{ success: boolean; message: string; machineIds: string[] }> {
  const { token } = await getCredentials(companyId);
  const client = createClient(token);

  try {
    const machinesResponse = await client.get(`/apps/${appName}/machines`);
    const machines: FlyMachine[] = machinesResponse.data || [];
    const startedIds: string[] = [];

    for (const machine of machines) {
      if (machine.state !== 'started') {
        await client.post(`/apps/${appName}/machines/${machine.id}/start`);
        startedIds.push(machine.id);
      }
    }

    return {
      success: true,
      message: startedIds.length > 0
        ? `Started ${startedIds.length} machine(s)`
        : 'All machines already running',
      machineIds: startedIds,
    };
  } catch (error: any) {
    console.error('Error starting Fly.io app:', error.message);
    throw new Error(
      error.response?.data?.error || error.message || 'Failed to start app'
    );
  }
}

/**
 * Stop all machines in an app
 */
export async function stopApp(
  companyId: string,
  appName: string
): Promise<{ success: boolean; message: string; machineIds: string[] }> {
  const { token } = await getCredentials(companyId);
  const client = createClient(token);

  try {
    const machinesResponse = await client.get(`/apps/${appName}/machines`);
    const machines: FlyMachine[] = machinesResponse.data || [];
    const stoppedIds: string[] = [];

    for (const machine of machines) {
      if (machine.state === 'started') {
        await client.post(`/apps/${appName}/machines/${machine.id}/stop`);
        stoppedIds.push(machine.id);
      }
    }

    return {
      success: true,
      message: stoppedIds.length > 0
        ? `Stopped ${stoppedIds.length} machine(s)`
        : 'All machines already stopped',
      machineIds: stoppedIds,
    };
  } catch (error: any) {
    console.error('Error stopping Fly.io app:', error.message);
    throw new Error(
      error.response?.data?.error || error.message || 'Failed to stop app'
    );
  }
}

/**
 * Restart all machines in an app
 */
export async function restartApp(
  companyId: string,
  appName: string
): Promise<{ success: boolean; message: string; machineIds: string[] }> {
  const { token } = await getCredentials(companyId);
  const client = createClient(token);

  try {
    const machinesResponse = await client.get(`/apps/${appName}/machines`);
    const machines: FlyMachine[] = machinesResponse.data || [];
    const restartedIds: string[] = [];

    for (const machine of machines) {
      // Get instance_id for wait
      const instanceId = machine.instance_id;

      // Stop
      await client.post(`/apps/${appName}/machines/${machine.id}/stop`);

      // Wait for stop
      await client.get(`/apps/${appName}/machines/${machine.id}/wait`, {
        params: { state: 'stopped', instance_id: instanceId },
        timeout: 60000,
      });

      // Start
      await client.post(`/apps/${appName}/machines/${machine.id}/start`);

      // Wait for start
      await client.get(`/apps/${appName}/machines/${machine.id}/wait`, {
        params: { state: 'started' },
        timeout: 60000,
      });

      restartedIds.push(machine.id);
    }

    return {
      success: true,
      message: `Restarted ${restartedIds.length} machine(s)`,
      machineIds: restartedIds,
    };
  } catch (error: any) {
    console.error('Error restarting Fly.io app:', error.message);
    throw new Error(
      error.response?.data?.error || error.message || 'Failed to restart app'
    );
  }
}

/**
 * Suspend all machines in an app
 */
export async function suspendApp(
  companyId: string,
  appName: string
): Promise<{ success: boolean; message: string; machineIds: string[] }> {
  const { token } = await getCredentials(companyId);
  const client = createClient(token);

  try {
    const machinesResponse = await client.get(`/apps/${appName}/machines`);
    const machines: FlyMachine[] = machinesResponse.data || [];
    const suspendedIds: string[] = [];

    for (const machine of machines) {
      if (machine.state === 'started') {
        await client.post(`/apps/${appName}/machines/${machine.id}/suspend`);
        suspendedIds.push(machine.id);
      }
    }

    return {
      success: true,
      message: suspendedIds.length > 0
        ? `Suspended ${suspendedIds.length} machine(s)`
        : 'All machines already suspended/stopped',
      machineIds: suspendedIds,
    };
  } catch (error: any) {
    console.error('Error suspending Fly.io app:', error.message);
    throw new Error(
      error.response?.data?.error || error.message || 'Failed to suspend app'
    );
  }
}

/**
 * List all machines in an app
 */
export async function listMachines(companyId: string, appName: string): Promise<FlyMachine[]> {
  const { token } = await getCredentials(companyId);
  const client = createClient(token);

  try {
    const response = await client.get(`/apps/${appName}/machines`);
    return response.data || [];
  } catch (error: any) {
    console.error('Error listing Fly.io machines:', error.message);
    throw new Error(
      error.response?.data?.error || error.message || 'Failed to list machines'
    );
  }
}

/**
 * Get machine details
 */
export async function getMachine(
  companyId: string,
  appName: string,
  machineId: string
): Promise<FlyMachine> {
  const { token } = await getCredentials(companyId);
  const client = createClient(token);

  try {
    const response = await client.get(`/apps/${appName}/machines/${machineId}`);
    return response.data;
  } catch (error: any) {
    console.error('Error getting Fly.io machine:', error.message);
    throw new Error(
      error.response?.data?.error || error.message || 'Failed to get machine details'
    );
  }
}

/**
 * Start a machine
 */
export async function startMachine(
  companyId: string,
  appName: string,
  machineId: string
): Promise<{ success: boolean; message: string }> {
  const { token } = await getCredentials(companyId);
  const client = createClient(token);

  try {
    await client.post(`/apps/${appName}/machines/${machineId}/start`);
    return { success: true, message: `Machine ${machineId} started` };
  } catch (error: any) {
    console.error('Error starting Fly.io machine:', error.message);
    throw new Error(
      error.response?.data?.error || error.message || 'Failed to start machine'
    );
  }
}

/**
 * Stop a machine
 */
export async function stopMachine(
  companyId: string,
  appName: string,
  machineId: string
): Promise<{ success: boolean; message: string }> {
  const { token } = await getCredentials(companyId);
  const client = createClient(token);

  try {
    await client.post(`/apps/${appName}/machines/${machineId}/stop`);
    return { success: true, message: `Machine ${machineId} stopped` };
  } catch (error: any) {
    console.error('Error stopping Fly.io machine:', error.message);
    throw new Error(
      error.response?.data?.error || error.message || 'Failed to stop machine'
    );
  }
}

/**
 * Restart a machine (stop + start)
 */
export async function restartMachine(
  companyId: string,
  appName: string,
  machineId: string
): Promise<{ success: boolean; message: string }> {
  const { token } = await getCredentials(companyId);
  const client = createClient(token);

  try {
    // Get current machine state to retrieve instance_id
    const machineResponse = await client.get(`/apps/${appName}/machines/${machineId}`);
    const instanceId = machineResponse.data?.instance_id;

    // Stop the machine
    await client.post(`/apps/${appName}/machines/${machineId}/stop`);

    // Wait for it to stop (requires instance_id)
    await client.get(`/apps/${appName}/machines/${machineId}/wait`, {
      params: { state: 'stopped', instance_id: instanceId },
      timeout: 60000,
    });

    // Start it again
    await client.post(`/apps/${appName}/machines/${machineId}/start`);

    // Wait for it to start
    await client.get(`/apps/${appName}/machines/${machineId}/wait`, {
      params: { state: 'started' },
      timeout: 60000,
    });

    return { success: true, message: `Machine ${machineId} restarted` };
  } catch (error: any) {
    console.error('Error restarting Fly.io machine:', error.message);
    throw new Error(
      error.response?.data?.error || error.message || 'Failed to restart machine'
    );
  }
}

/**
 * Suspend a machine (saves state, cheaper than running)
 */
export async function suspendMachine(
  companyId: string,
  appName: string,
  machineId: string
): Promise<{ success: boolean; message: string }> {
  const { token } = await getCredentials(companyId);
  const client = createClient(token);

  try {
    await client.post(`/apps/${appName}/machines/${machineId}/suspend`);
    return { success: true, message: `Machine ${machineId} suspended` };
  } catch (error: any) {
    console.error('Error suspending Fly.io machine:', error.message);
    throw new Error(
      error.response?.data?.error || error.message || 'Failed to suspend machine'
    );
  }
}

/**
 * Wait for machine to reach a specific state
 * Note: For 'stopped' and 'suspended' states, instanceId is required by Fly.io API
 */
export async function waitForMachine(
  companyId: string,
  appName: string,
  machineId: string,
  state: 'started' | 'stopped' | 'suspended',
  instanceId?: string
): Promise<{ success: boolean; state: string }> {
  const { token } = await getCredentials(companyId);
  const client = createClient(token);

  try {
    // For stopped/suspended states, we need to get the instance_id first if not provided
    let effectiveInstanceId = instanceId;
    if ((state === 'stopped' || state === 'suspended') && !effectiveInstanceId) {
      const machineResponse = await client.get(`/apps/${appName}/machines/${machineId}`);
      effectiveInstanceId = machineResponse.data?.instance_id;
    }

    const params: Record<string, string> = { state };
    if (effectiveInstanceId && (state === 'stopped' || state === 'suspended')) {
      params.instance_id = effectiveInstanceId;
    }

    const response = await client.get(`/apps/${appName}/machines/${machineId}/wait`, {
      params,
      timeout: 120000,
    });
    return { success: true, state: response.data?.state || state };
  } catch (error: any) {
    console.error('Error waiting for Fly.io machine:', error.message);
    throw new Error(
      error.response?.data?.error || error.message || 'Timeout waiting for machine state'
    );
  }
}

/**
 * Delete a machine
 */
export async function deleteMachine(
  companyId: string,
  appName: string,
  machineId: string,
  force: boolean = true
): Promise<{ success: boolean; message: string }> {
  const { token } = await getCredentials(companyId);
  const client = createClient(token);

  try {
    await client.delete(`/apps/${appName}/machines/${machineId}`, {
      params: { force },
    });
    return { success: true, message: `Machine ${machineId} deleted` };
  } catch (error: any) {
    console.error('Error deleting Fly.io machine:', error.message);
    throw new Error(
      error.response?.data?.error || error.message || 'Failed to delete machine'
    );
  }
}

/**
 * Create a new machine
 */
export async function createMachine(
  companyId: string,
  appName: string,
  options?: {
    name?: string;
    region?: string;
    config?: FlyMachineConfig;
    volumeId?: string;
    volumePath?: string;
    volumeName?: string;
    autoStop?: 'off' | 'stop' | 'suspend';
  }
): Promise<FlyMachine> {
  const { token } = await getCredentials(companyId);
  const client = createClient(token);

  try {
    // If no config provided, get it from existing machines
    let machineConfig: FlyMachineConfig | undefined = options?.config;
    if (!machineConfig) {
      const existingMachines = await client.get(`/apps/${appName}/machines`);
      if (existingMachines.data?.length > 0) {
        // Clone config from first existing machine
        machineConfig = { ...existingMachines.data[0].config };
      } else {
        throw new Error('No existing machines found and no config provided. Cannot determine image.');
      }
    }

    // Handle volume attachment
    if (options?.volumeId) {
      machineConfig.mounts = [
        {
          volume: options.volumeId,
          path: options.volumePath || '/data',
          name: options.volumeName || 'data',
        },
      ];
    } else if (machineConfig.mounts && machineConfig.mounts.length > 0) {
      // Remove volume mounts if no volume specified (for stateless machines)
      if (options?.volumeId === undefined && !options?.config) {
        // User didn't specify volume, keep existing config as-is
      }
    }

    // Handle auto_stop mode
    if (options?.autoStop && machineConfig.services) {
      machineConfig.services = machineConfig.services.map(service => ({
        ...service,
        autostop: options.autoStop,
        autostart: options.autoStop !== 'off',
      }));
    }

    const body: Record<string, any> = {
      config: machineConfig,
    };

    if (options?.name) {
      body.name = options.name;
    }
    if (options?.region) {
      body.region = options.region;
    }

    const response = await client.post(`/apps/${appName}/machines`, body, {
      timeout: 120000, // Creating machines can take a while
    });

    return response.data;
  } catch (error: any) {
    console.error('Error creating Fly.io machine:', error.message);
    throw new Error(
      error.response?.data?.error || error.message || 'Failed to create machine'
    );
  }
}

/**
 * Scale app to specified number of machines
 * Creates or deletes machines as needed
 */
export async function scaleMachines(
  companyId: string,
  appName: string,
  count: number,
  region?: string
): Promise<{ success: boolean; machines: FlyMachine[]; message: string }> {
  const { token } = await getCredentials(companyId);
  const client = createClient(token);

  try {
    // Get current machines
    const response = await client.get(`/apps/${appName}/machines`);
    const currentMachines: FlyMachine[] = response.data || [];
    const currentCount = currentMachines.length;

    if (count === currentCount) {
      return {
        success: true,
        machines: currentMachines,
        message: `Already at ${count} machine(s)`,
      };
    }

    const resultMachines: FlyMachine[] = [...currentMachines];

    if (count > currentCount) {
      // Need to create machines
      const toCreate = count - currentCount;
      const baseConfig = currentMachines[0]?.config;

      if (!baseConfig) {
        throw new Error('No existing machine config found. Cannot scale up.');
      }

      for (let i = 0; i < toCreate; i++) {
        const newMachine = await createMachine(companyId, appName, {
          region,
          config: baseConfig,
        });
        resultMachines.push(newMachine);
      }

      return {
        success: true,
        machines: resultMachines,
        message: `Scaled up from ${currentCount} to ${count} machine(s)`,
      };
    } else {
      // Need to delete machines
      const toDelete = currentCount - count;
      const machinesToDelete = currentMachines.slice(-toDelete); // Delete from the end

      for (const machine of machinesToDelete) {
        await deleteMachine(companyId, appName, machine.id, true);
        const index = resultMachines.findIndex(m => m.id === machine.id);
        if (index > -1) {
          resultMachines.splice(index, 1);
        }
      }

      return {
        success: true,
        machines: resultMachines,
        message: `Scaled down from ${currentCount} to ${count} machine(s)`,
      };
    }
  } catch (error: any) {
    console.error('Error scaling Fly.io machines:', error.message);
    throw new Error(
      error.response?.data?.error || error.message || 'Failed to scale machines'
    );
  }
}

/**
 * List all volumes for an app
 */
export async function listVolumes(companyId: string, appName: string): Promise<FlyVolume[]> {
  const { token } = await getCredentials(companyId);
  const client = createClient(token);

  try {
    const response = await client.get(`/apps/${appName}/volumes`);
    return response.data || [];
  } catch (error: any) {
    console.error('Error listing Fly.io volumes:', error.message);
    throw new Error(
      error.response?.data?.error || error.message || 'Failed to list volumes'
    );
  }
}

/**
 * Create a new volume
 */
export async function createVolume(
  companyId: string,
  appName: string,
  options: {
    name: string;
    region: string;
    sizeGb?: number;
    encrypted?: boolean;
  }
): Promise<FlyVolume> {
  const { token } = await getCredentials(companyId);
  const client = createClient(token);

  try {
    const response = await client.post(`/apps/${appName}/volumes`, {
      name: options.name,
      region: options.region,
      size_gb: options.sizeGb || 1,
      encrypted: options.encrypted !== false,
    });
    return response.data;
  } catch (error: any) {
    console.error('Error creating Fly.io volume:', error.message);
    throw new Error(
      error.response?.data?.error || error.message || 'Failed to create volume'
    );
  }
}

/**
 * Delete a volume
 */
export async function deleteVolume(
  companyId: string,
  appName: string,
  volumeId: string
): Promise<{ success: boolean; message: string }> {
  const { token } = await getCredentials(companyId);
  const client = createClient(token);

  try {
    await client.delete(`/apps/${appName}/volumes/${volumeId}`);
    return { success: true, message: `Volume ${volumeId} deleted` };
  } catch (error: any) {
    console.error('Error deleting Fly.io volume:', error.message);
    throw new Error(
      error.response?.data?.error || error.message || 'Failed to delete volume'
    );
  }
}

/**
 * Get volume details
 */
export async function getVolume(
  companyId: string,
  appName: string,
  volumeId: string
): Promise<FlyVolume> {
  const { token } = await getCredentials(companyId);
  const client = createClient(token);

  try {
    const response = await client.get(`/apps/${appName}/volumes/${volumeId}`);
    return response.data;
  } catch (error: any) {
    console.error('Error getting Fly.io volume:', error.message);
    throw new Error(
      error.response?.data?.error || error.message || 'Failed to get volume'
    );
  }
}

/**
 * Scale app with volumes - creates volumes and machines together
 */
export async function scaleWithVolumes(
  companyId: string,
  appName: string,
  count: number,
  options?: {
    region?: string;
    volumeName?: string;
    volumeSizeGb?: number;
  }
): Promise<{
  success: boolean;
  machines: FlyMachine[];
  volumes: FlyVolume[];
  message: string;
}> {
  const { token } = await getCredentials(companyId);
  const client = createClient(token);

  try {
    // Get current state
    const [machinesResponse, volumesResponse] = await Promise.all([
      client.get(`/apps/${appName}/machines`),
      client.get(`/apps/${appName}/volumes`),
    ]);

    const currentMachines: FlyMachine[] = machinesResponse.data || [];
    const currentVolumes: FlyVolume[] = volumesResponse.data || [];
    const currentCount = currentMachines.length;

    if (count === currentCount) {
      return {
        success: true,
        machines: currentMachines,
        volumes: currentVolumes,
        message: `Already at ${count} machine(s)`,
      };
    }

    // Get base config from existing machine
    const baseConfig = currentMachines[0]?.config;
    if (!baseConfig && count > 0) {
      throw new Error('No existing machine config found. Deploy the app first.');
    }

    // Determine volume name from config
    const volumeMount = baseConfig?.mounts?.[0];
    const volumeName = options?.volumeName || volumeMount?.name || 'data';
    const volumeSizeGb = options?.volumeSizeGb || volumeMount?.size_gb || 1;
    const region = options?.region || currentMachines[0]?.region || 'fra';

    const resultMachines: FlyMachine[] = [...currentMachines];
    const resultVolumes: FlyVolume[] = [...currentVolumes];

    if (count > currentCount) {
      // Scale UP - create volumes and machines
      const toCreate = count - currentCount;

      for (let i = 0; i < toCreate; i++) {
        // Create volume first
        const newVolume = await createVolume(companyId, appName, {
          name: volumeName,
          region,
          sizeGb: volumeSizeGb,
        });
        resultVolumes.push(newVolume);

        // Create machine with volume attached
        const configWithVolume = {
          ...baseConfig,
          mounts: [
            {
              volume: newVolume.id,
              path: volumeMount?.path || '/data',
              name: volumeName,
            },
          ],
        };

        const machineResponse = await client.post(`/apps/${appName}/machines`, {
          config: configWithVolume,
          region,
        }, { timeout: 120000 });

        resultMachines.push(machineResponse.data);
      }

      return {
        success: true,
        machines: resultMachines,
        volumes: resultVolumes,
        message: `Scaled up from ${currentCount} to ${count} machine(s) with volumes`,
      };
    } else {
      // Scale DOWN - delete machines and their volumes
      const toDelete = currentCount - count;
      const machinesToDelete = currentMachines.slice(-toDelete);

      for (const machine of machinesToDelete) {
        // Find the volume attached to this machine
        const attachedVolume = currentVolumes.find(
          v => v.attached_machine_id === machine.id
        );

        // Delete machine first
        await deleteMachine(companyId, appName, machine.id, true);
        const machineIndex = resultMachines.findIndex(m => m.id === machine.id);
        if (machineIndex > -1) {
          resultMachines.splice(machineIndex, 1);
        }

        // Delete the attached volume
        if (attachedVolume) {
          await deleteVolume(companyId, appName, attachedVolume.id);
          const volumeIndex = resultVolumes.findIndex(v => v.id === attachedVolume.id);
          if (volumeIndex > -1) {
            resultVolumes.splice(volumeIndex, 1);
          }
        }
      }

      return {
        success: true,
        machines: resultMachines,
        volumes: resultVolumes,
        message: `Scaled down from ${currentCount} to ${count} machine(s)`,
      };
    }
  } catch (error: any) {
    console.error('Error scaling Fly.io with volumes:', error.message);
    throw new Error(
      error.response?.data?.error || error.message || 'Failed to scale with volumes'
    );
  }
}

/**
 * Update machine configuration
 * Updates env vars, services, resources, etc.
 */
export async function updateMachineConfig(
  companyId: string,
  appName: string,
  machineId: string,
  configUpdates: Partial<FlyMachineConfig>
): Promise<FlyMachine> {
  const { token } = await getCredentials(companyId);
  const client = createClient(token);

  try {
    // Get current machine config
    const currentMachine = await client.get(`/apps/${appName}/machines/${machineId}`);
    const currentConfig = currentMachine.data.config;

    // Merge config updates
    const updatedConfig: FlyMachineConfig = {
      ...currentConfig,
      ...configUpdates,
      // Deep merge for env
      env: configUpdates.env
        ? { ...currentConfig.env, ...configUpdates.env }
        : currentConfig.env,
      // Deep merge for guest if provided
      guest: configUpdates.guest
        ? { ...currentConfig.guest, ...configUpdates.guest }
        : currentConfig.guest,
    };

    // Update the machine
    const response = await client.post(`/apps/${appName}/machines/${machineId}`, {
      config: updatedConfig,
    }, {
      timeout: 120000,
    });

    return response.data;
  } catch (error: any) {
    console.error('Error updating Fly.io machine config:', error.message);
    throw new Error(
      error.response?.data?.error || error.message || 'Failed to update machine config'
    );
  }
}

// Secrets API now uses the Machines API (api.machines.dev)
// The legacy api.fly.io/v1 returns 404 for Machines/Apps v2

export interface FlySecret {
  name: string;
  digest: string;
  createdAt: string;
}

/**
 * List secrets for an app (names only, not values)
 */
export async function listSecrets(companyId: string, appName: string): Promise<FlySecret[]> {
  const { token } = await getCredentials(companyId);

  try {
    const response = await axios.get(`${FLY_API_BASE}/apps/${appName}/secrets`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });
    return response.data || [];
  } catch (error: any) {
    console.error('Error listing Fly.io secrets:', error.message);
    throw new Error(
      error.response?.data?.error || error.message || 'Failed to list secrets'
    );
  }
}

/**
 * Set secrets for an app
 * Note: Setting secrets requires restarting machines to take effect
 */
export async function setSecrets(
  companyId: string,
  appName: string,
  secrets: Record<string, string>
): Promise<{ success: boolean; message: string; requiresRestart: boolean }> {
  const { token } = await getCredentials(companyId);

  try {
    // Convert to array format expected by API
    const secretsArray = Object.entries(secrets).map(([name, value]) => ({
      name,
      value,
    }));

    await axios.post(
      `${FLY_API_BASE}/apps/${appName}/secrets`,
      secretsArray,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    return {
      success: true,
      message: `Set ${Object.keys(secrets).length} secret(s): ${Object.keys(secrets).join(', ')}`,
      requiresRestart: true,
    };
  } catch (error: any) {
    console.error('Error setting Fly.io secrets:', error.message);
    throw new Error(
      error.response?.data?.error || error.message || 'Failed to set secrets'
    );
  }
}

/**
 * Unset (delete) secrets from an app
 * Note: Unsetting secrets requires restarting machines to take effect
 */
export async function unsetSecrets(
  companyId: string,
  appName: string,
  secretNames: string[]
): Promise<{ success: boolean; message: string; requiresRestart: boolean }> {
  const { token } = await getCredentials(companyId);

  try {
    await axios.delete(`${FLY_API_BASE}/apps/${appName}/secrets`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      data: secretNames,
      timeout: 30000,
    });

    return {
      success: true,
      message: `Unset ${secretNames.length} secret(s): ${secretNames.join(', ')}`,
      requiresRestart: true,
    };
  } catch (error: any) {
    console.error('Error unsetting Fly.io secrets:', error.message);
    throw new Error(
      error.response?.data?.error || error.message || 'Failed to unset secrets'
    );
  }
}

export interface FlyExecResult {
  stdout: string;
  stderr: string;
  exit_code: number;
}

/**
 * Execute a command on a running machine
 * Similar to SSH but through the Fly.io API
 */
export async function execCommand(
  companyId: string,
  appName: string,
  machineIdOrNull: string | null,
  command: string[],
  options?: {
    timeout?: number;
  }
): Promise<FlyExecResult> {
  const { token } = await getCredentials(companyId);
  const client = createClient(token);

  try {
    // Auto-select first running machine if machineId not provided
    let machineId = machineIdOrNull;
    if (!machineId) {
      const machinesResponse = await client.get(`/apps/${appName}/machines`);
      const machines: FlyMachine[] = machinesResponse.data || [];
      const runningMachine = machines.find(m => m.state === 'started');
      if (!runningMachine) {
        throw new Error('No running machines found in app. Start the app first.');
      }
      machineId = runningMachine.id;
    }

    // Fly.io exec API expects cmd as a string, not array
    // Join the command array into a shell command string
    const cmdString = command.length === 1
      ? command[0]
      : command.map(arg => arg.includes(' ') ? `"${arg}"` : arg).join(' ');

    const response = await client.post(
      `/apps/${appName}/machines/${machineId}/exec`,
      {
        cmd: cmdString,
        timeout: options?.timeout || 30,
      },
      {
        timeout: (options?.timeout || 30) * 1000 + 10000, // API timeout + buffer
      }
    );

    return {
      stdout: response.data.stdout || '',
      stderr: response.data.stderr || '',
      exit_code: response.data.exit_code || 0,
    };
  } catch (error: any) {
    console.error('Error executing command on Fly.io machine:', error.message);
    throw new Error(
      error.response?.data?.error || error.message || 'Failed to execute command'
    );
  }
}

/**
 * Validate connection to Fly.io API
 */
// GraphQL API for IP management
const FLY_GRAPHQL_API = 'https://api.fly.io/graphql';

export interface FlyIPAddress {
  id: string;
  address: string;
  type: 'v4' | 'v6' | 'shared_v4' | 'private_v6';
  region: string;
  createdAt: string;
}

async function graphqlRequest(
  token: string,
  query: string,
  variables: Record<string, any>
): Promise<any> {
  const response = await axios.post(
    FLY_GRAPHQL_API,
    { query, variables },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (response.data.errors) {
    throw new Error(response.data.errors[0]?.message || 'GraphQL error');
  }

  return response.data.data;
}

/**
 * List IP addresses for a Fly.io app
 */
export async function listIPs(companyId: string, appName: string): Promise<FlyIPAddress[]> {
  const { token } = await getCredentials(companyId);

  const query = `
    query($appName: String!) {
      app(name: $appName) {
        ipAddresses {
          nodes {
            id
            address
            type
            region
            createdAt
          }
        }
      }
    }
  `;

  const data = await graphqlRequest(token, query, { appName });
  return data.app?.ipAddresses?.nodes || [];
}

/**
 * Allocate IP addresses for a Fly.io app (shared IPv4 + dedicated IPv6)
 * Note: shared_v4 allocation works but doesn't return the address in response (known Fly.io bug)
 */
export async function allocateIPs(
  companyId: string,
  appName: string,
  options?: {
    skipV4?: boolean;
    skipV6?: boolean;
  }
): Promise<{ success: boolean; message: string; ips: FlyIPAddress[] }> {
  const { token } = await getCredentials(companyId);

  const allocateMutation = `
    mutation($appId: ID!, $type: IPAddressType!) {
      allocateIpAddress(input: {appId: $appId, type: $type}) {
        ipAddress {
          id
          address
          type
          region
          createdAt
        }
      }
    }
  `;

  const allocatedIPs: FlyIPAddress[] = [];
  const errors: string[] = [];

  // Allocate shared IPv4 (free)
  if (!options?.skipV4) {
    try {
      const result = await graphqlRequest(token, allocateMutation, {
        appId: appName,
        type: 'shared_v4',
      });
      // Note: shared_v4 often returns null due to Fly.io bug, but allocation still works
      if (result.allocateIpAddress?.ipAddress) {
        allocatedIPs.push(result.allocateIpAddress.ipAddress);
      }
    } catch (error: any) {
      // Ignore "already allocated" errors
      if (!error.message?.includes('already')) {
        errors.push(`IPv4: ${error.message}`);
      }
    }
  }

  // Allocate dedicated IPv6 (free)
  if (!options?.skipV6) {
    try {
      const result = await graphqlRequest(token, allocateMutation, {
        appId: appName,
        type: 'v6',
      });
      if (result.allocateIpAddress?.ipAddress) {
        allocatedIPs.push(result.allocateIpAddress.ipAddress);
      }
    } catch (error: any) {
      // Ignore "already allocated" errors
      if (!error.message?.includes('already')) {
        errors.push(`IPv6: ${error.message}`);
      }
    }
  }

  // Get current IPs to return (since shared_v4 doesn't return in mutation)
  const currentIPs = await listIPs(companyId, appName);

  return {
    success: errors.length === 0,
    message:
      errors.length > 0
        ? `Partial success. Errors: ${errors.join(', ')}`
        : 'IP addresses allocated successfully. App is now publicly accessible.',
    ips: currentIPs,
  };
}

/**
 * Release an IP address from a Fly.io app
 */
export async function releaseIP(
  companyId: string,
  appName: string,
  ipId: string
): Promise<{ success: boolean; message: string }> {
  const { token } = await getCredentials(companyId);

  const mutation = `
    mutation($appId: ID!, $ipAddressId: ID!) {
      releaseIpAddress(input: {appId: $appId, ipAddressId: $ipAddressId}) {
        app {
          name
        }
      }
    }
  `;

  try {
    await graphqlRequest(token, mutation, { appId: appName, ipAddressId: ipId });
    return { success: true, message: `Released IP ${ipId}` };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

export async function validateConnection(
  apiKeys: Record<string, string>
): Promise<{ success: boolean; message?: string; error?: string }> {
  const { fly_api_token, fly_org_slug } = apiKeys || {};

  if (!fly_api_token) {
    return {
      success: false,
      error: 'Missing API token',
    };
  }

  try {
    const client = createClient(fly_api_token);
    const response = await client.get('/apps', {
      params: { org_slug: fly_org_slug || 'personal' },
      timeout: 10000,
    });

    const appCount = response.data?.apps?.length || 0;
    return {
      success: true,
      message: `Connected successfully. Found ${appCount} app(s) in organization.`,
    };
  } catch (error: any) {
    if (error.response?.status === 401) {
      return {
        success: false,
        error: 'Invalid API token',
      };
    }
    return {
      success: false,
      error: error.message || 'Failed to connect to Fly.io API',
    };
  }
}
