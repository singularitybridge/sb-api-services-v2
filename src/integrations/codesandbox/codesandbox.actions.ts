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
  console.log('[CodeSandbox] Creating actions for company:', context.companyId);
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
};};
