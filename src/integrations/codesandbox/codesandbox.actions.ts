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
  deleteFile,
  listDirectory,
} from './codesandbox.service';

interface CreateSandboxArgs {
  templateId: string;
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
      try {
        const result = await runCommandInSandbox(
          context.companyId, 
          params.sandboxId, 
          params.command
        );
        
        if (result.success) {
          // Handle different output scenarios
          let output = '';
          const resultData = result.data as any;
          if (resultData) {
            if (typeof resultData === 'string') {
              output = resultData;
            } else if (typeof resultData === 'object') {
              output = resultData.output || resultData.stdout || '';
            }
          }
          const hasOutput = output && output.toString().trim().length > 0;
          
          return { 
            success: true, 
            data: result.data,
            message: hasOutput 
              ? 'Command executed successfully.' 
              : 'Command executed successfully (no output).'
          };
        } else {
          // Throw error instead of returning success: false
          const errorDetails = result.details ? ` Details: ${result.details}` : '';
          throw new Error(`${result.error || 'Command execution failed'}${errorDetails}`);
        }
      } catch (error) {
        // Log the full error for debugging
        console.error('[CodeSandbox] Command execution error:', {
          sandboxId: params.sandboxId,
          command: params.command,
          error: error,
          message: (error as Error).message,
          stack: (error as Error).stack
        });
        
        throw new Error(
          `Failed to execute command: ${(error as Error).message || 'Unknown error'}`
        );
      }
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
  deleteFile: {
    description: 'Deletes a file or directory from the sandbox.',
    parameters: {
      type: 'object',
      properties: {
        sandboxId: {
          type: 'string',
          description: 'The ID of the sandbox.',
        },
        path: {
          type: 'string',
          description: 'The path of the file or directory to delete.',
        },
      },
      required: ['sandboxId', 'path'],
    },
    function: async (params: { sandboxId: string; path: string }) => {
      const result = await deleteFile(context.companyId, params.sandboxId, params.path);
      if (result.success) {
        return { 
          success: true, 
          message: result.message 
        };
      }
      throw new Error(result.error || 'Failed to delete file');
    },
  },
  listDirectory: {
    description: 'Lists files and directories in a sandbox path.',
    parameters: {
      type: 'object',
      properties: {
        sandboxId: {
          type: 'string',
          description: 'The ID of the sandbox.',
        },
        path: {
          type: 'string',
          description: 'The directory path to list (default: current directory).',
          default: '.',
        },
      },
      required: ['sandboxId'],
    },
    function: async (params: { sandboxId: string; path?: string }) => {
      const result = await listDirectory(
        context.companyId, 
        params.sandboxId, 
        params.path || '.'
      );
      if (result.success) {
        const itemCount = result.data ? result.data.length : 0;
        return { 
          success: true, 
          data: result.data,
          message: `Found ${itemCount} items` 
        };
      }
      throw new Error(result.error || 'Failed to list directory');
    },
  },
};};
