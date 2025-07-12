import {
  ActionContext,
  FunctionFactory,
  StandardActionResult,
} from '../actions/types';
import {
  createSandbox as createSandboxService,
  runCommandInSandbox,
  readFileFromSandbox,
  writeFileToSandbox,
  listSandboxes,
  getSandboxInfo,
  getSandboxUrl,
  setEnvironmentVariables as setEnvironmentVariablesService,
  clearEnvironmentVariables as clearEnvironmentVariablesService,
  getEnvironmentVariables as getEnvironmentVariablesService,
  setPersistentEnvironmentVariables as setPersistentEnvironmentVariablesService,
} from './codesandbox.service';

interface CreateSandboxArgs {
  templateId: string;
}

interface SetEnvironmentVariablesArgs {
  sandboxId: string;
  envVars: Array<{ name: string; value: string }>;
  persistent?: boolean;
}

interface ClearEnvironmentVariablesArgs {
  sandboxId: string;
  varNames: string[];
}

interface GetEnvironmentVariablesArgs {
  sandboxId: string;
  varNames?: string[];
}

interface RunCommandInSandboxArgs {
  sandboxId: string;
  command: string;
}

interface ReadFileFromSandboxArgs {
  sandboxId: string;
  path: string;
}

interface WriteFileToSandboxArgs {
  sandboxId: string;
  path: string;
  content: string;
}

interface ListSandboxesArgs {
  limit?: number;
}

interface GetSandboxInfoArgs {
  sandboxId: string;
}

interface GetSandboxUrlArgs {
  sandboxId: string;
}

export const createCodeSandboxActions = (context: ActionContext): FunctionFactory => {
  // Only log when we have a valid context with companyId
  if (context && context.companyId) {
    console.log('[CodeSandbox] Creating actions for company:', context.companyId);
  }
  return {
  createSandbox: {
    description: 'Creates a new CodeSandbox sandbox from a template.',
    parameters: {
      type: 'object',
      properties: {
        templateId: {
          type: 'string',
          description: 'The ID of the template to use. Defaults to "node".',
        },
      },
      required: [],
    },
    function: async (
      params: CreateSandboxArgs,
    ): Promise<StandardActionResult<any>> => {
      const templateId = params.templateId || 'node';
      const result = await createSandboxService(context.companyId, templateId);
      if (result.success) {
        return { success: true, data: result.data, message: 'Sandbox created successfully.' };
      }
      throw new Error(result.error || 'Failed to create CodeSandbox sandbox');
    },
  },
  runCommandInSandbox: {
    description: 'Runs a shell command in a CodeSandbox sandbox.',
    parameters: {
      type: 'object',
      properties: {
        sandboxId: {
          type: 'string',
          description: 'The ID of the sandbox.',
        },
        command: {
          type: 'string',
          description: 'The command to run.',
        },
      },
      required: ['sandboxId', 'command'],
    },
    function: async (
      params: RunCommandInSandboxArgs,
    ): Promise<StandardActionResult<any>> => {
      const result = await runCommandInSandbox(context.companyId, params.sandboxId, params.command);
      if (result.success) {
        return { success: true, data: result.data, message: 'Command executed successfully.' };
      }
      throw new Error(result.error || 'Failed to run command in CodeSandbox sandbox');
    },
  },
  readFileFromSandbox: {
    description: 'Reads a file from a CodeSandbox sandbox.',
    parameters: {
      type: 'object',
      properties: {
        sandboxId: {
          type: 'string',
          description: 'The ID of the sandbox.',
        },
        path: {
          type: 'string',
          description: 'The path of the file to read.',
        },
      },
      required: ['sandboxId', 'path'],
    },
    function: async (
      params: ReadFileFromSandboxArgs,
    ): Promise<StandardActionResult<any>> => {
      const result = await readFileFromSandbox(context.companyId, params.sandboxId, params.path);
      if (result.success) {
        return { success: true, data: result.data, message: 'File read successfully.' };
      }
      throw new Error(result.error || 'Failed to read file from CodeSandbox sandbox');
    },
  },
  writeFileToSandbox: {
    description: 'Writes a file to a CodeSandbox sandbox.',
    parameters: {
      type: 'object',
      properties: {
        sandboxId: {
          type: 'string',
          description: 'The ID of the sandbox.',
        },
        path: {
          type: 'string',
          description: 'The path of the file to write.',
        },
        content: {
          type: 'string',
          description: 'The content to write to the file.',
        },
      },
      required: ['sandboxId', 'path', 'content'],
    },
    function: async (
      params: WriteFileToSandboxArgs,
    ): Promise<StandardActionResult<any>> => {
      const result = await writeFileToSandbox(context.companyId, params.sandboxId, params.path, params.content);
      if (result.success) {
        return { 
          success: true, 
          data: { 
            message: 'File written successfully.',
            path: params.path,
            sandboxId: params.sandboxId
          },
          message: 'File written successfully.' 
        };
      }
      throw new Error(result.error || 'Failed to write file to CodeSandbox sandbox');
    },
  },
  listSandboxes: {
    description: 'Lists all sandboxes for the authenticated user with their public URLs.',
    parameters: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of sandboxes to return. Default is 20.',
        },
      },
      required: [],
    },
    function: async (
      params: ListSandboxesArgs,
    ): Promise<StandardActionResult<any>> => {
      const limit = params.limit || 20;
      const result = await listSandboxes(context.companyId, limit);
      if (result.success && result.data) {
        return { 
          success: true, 
          data: result.data, 
          message: `Found ${result.data.length} sandboxes.` 
        };
      }
      throw new Error(result.error || 'Failed to list sandboxes');
    },
  },
  getSandboxInfo: {
    description: 'Gets detailed information about a specific sandbox including all available URLs.',
    parameters: {
      type: 'object',
      properties: {
        sandboxId: {
          type: 'string',
          description: 'The ID of the sandbox to get information for.',
        },
      },
      required: ['sandboxId'],
    },
    function: async (
      params: GetSandboxInfoArgs,
    ): Promise<StandardActionResult<any>> => {
      const result = await getSandboxInfo(context.companyId, params.sandboxId);
      if (result.success) {
        return { 
          success: true, 
          data: result.data, 
          message: 'Sandbox information retrieved successfully.' 
        };
      }
      throw new Error(result.error || 'Failed to get sandbox information');
    },
  },
  getSandboxUrl: {
    description: 'Gets various URLs for accessing a sandbox (public, embed, standalone, etc.).',
    parameters: {
      type: 'object',
      properties: {
        sandboxId: {
          type: 'string',
          description: 'The ID of the sandbox.',
        },
      },
      required: ['sandboxId'],
    },
    function: async (
      params: GetSandboxUrlArgs,
    ): Promise<StandardActionResult<any>> => {
      const result = await getSandboxUrl(context.companyId, params.sandboxId);
      if (result.success) {
        return { 
          success: true, 
          data: result.data, 
          message: 'Sandbox URLs retrieved successfully.' 
        };
      }
      throw new Error(result.error || 'Failed to get sandbox URLs');
    },
  },
  setEnvironmentVariables: {
    description: 'Sets environment variables programmatically without using .env files',
    parameters: {
      type: 'object',
      properties: {
        sandboxId: {
          type: 'string',
          description: 'The ID of the sandbox.',
        },
        envVars: {
          type: 'array',
          description: 'Array of environment variables to set',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Variable name (e.g., API_KEY)' },
              value: { type: 'string', description: 'Variable value' }
            },
            required: ['name', 'value'],
            additionalProperties: false
          }
        },
        persistent: {
          type: 'boolean',
          description: 'If true, variables persist across sandbox restarts',
          default: false
        }
      },
      required: ['sandboxId', 'envVars'],
      additionalProperties: false
    },
    function: async (params: SetEnvironmentVariablesArgs): Promise<StandardActionResult<any>> => {
      const envObject: Record<string, string> = {};
      let envVarsToProcess: Array<{ name: string; value: string }>;

      if (Array.isArray(params.envVars)) {
        envVarsToProcess = params.envVars;
      } else if (typeof params.envVars === 'object' && params.envVars !== null) {
        // If it's an object but not an array, try to convert it assuming it's an object with numeric keys
        // This is a fallback for unexpected deserialization behavior
        envVarsToProcess = Object.values(params.envVars) as Array<{ name: string; value: string }>;
      } else {
        throw new Error('Invalid envVars parameter: Expected an array or an object convertible to an array.');
      }

      envVarsToProcess.forEach(({ name, value }) => {
        envObject[name] = value;
      });
      
      const result = params.persistent
        ? await setPersistentEnvironmentVariablesService(context.companyId, params.sandboxId, envObject)
        : await setEnvironmentVariablesService(context.companyId, params.sandboxId, envObject);
      
      if (result.success) {
        let message: string;
        let data: any;

        if (params.persistent) {
          message = (result.data as { message: string }).message;
          data = result.data;
        } else {
          message = `Set ${envVarsToProcess.length} environment variables`;
          data = result.data;
        }

        return {
          success: true,
          message: message,
          data: data
        };
      }
      throw new Error(result.error || 'Failed to set environment variables');
    },
  },
  clearEnvironmentVariables: {
    description: 'Clears specific environment variables from the sandbox',
    parameters: {
      type: 'object',
      properties: {
        sandboxId: {
          type: 'string',
          description: 'The ID of the sandbox.',
        },
        varNames: {
          type: 'array',
          description: 'Names of variables to clear',
          items: { type: 'string' }
        }
      },
      required: ['sandboxId', 'varNames'],
      additionalProperties: false
    },
    function: async (params: ClearEnvironmentVariablesArgs): Promise<StandardActionResult<any>> => {
      const result = await clearEnvironmentVariablesService(context.companyId, params.sandboxId, params.varNames);
      
      if (result.success) {
        return { 
          success: true, 
          message: `Cleared ${params.varNames.length} environment variables`,
          data: result.data
        };
      }
      throw new Error(result.error || 'Failed to clear environment variables');
    },
  },
  getEnvironmentVariables: {
    description: 'Gets current environment variables from the sandbox runtime',
    parameters: {
      type: 'object',
      properties: {
        sandboxId: {
          type: 'string',
          description: 'The ID of the sandbox.',
        },
        varNames: {
          type: 'array',
          description: 'Specific variables to get (omit for all)',
          items: { type: 'string' },
          default: []
        }
      },
      required: ['sandboxId'],
      additionalProperties: false
    },
    function: async (params: GetEnvironmentVariablesArgs): Promise<StandardActionResult<any>> => {
      const result = await getEnvironmentVariablesService(
        context.companyId, 
        params.sandboxId, 
        params.varNames && params.varNames.length > 0 ? params.varNames : undefined
      );
      
      if (result.success) {
        const retrievedData = result.data;
        if (retrievedData) {
          return { 
            success: true, 
            data: retrievedData,
            message: `Retrieved ${Object.keys(retrievedData).length} environment variables`
          };
        } else {
          return { success: true, data: {}, message: 'Retrieved 0 environment variables' };
        }
      }
      throw new Error(result.error || 'Failed to get environment variables');
    },
  },
};};
