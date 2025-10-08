/**
 * Add Workspace Item Tool
 *
 * Adds a new workspace item at company, session, or agent level
 */

import { z } from 'zod';
import axios from 'axios';
import { resolveAssistantIdentifier } from '../../services/assistant/assistant-resolver.service';
import { getWorkspaceService } from '../../services/unified-workspace.service';

/**
 * Input schema for the add_workspace_item tool
 */
export const addWorkspaceItemSchema = z.object({
  itemPath: z
    .string()
    .describe('Path for the workspace item (e.g., "/config/settings.json")'),
  content: z
    .any()
    .optional()
    .describe('Content to store (can be string, object, array, etc.). Not required if fileUrl is provided.'),
  fileUrl: z
    .string()
    .url()
    .optional()
    .describe('URL to a file to download and store. Use this for large files (>50KB) to bypass MCP token limits. Mutually exclusive with content.'),
  scope: z
    .enum(['company', 'session', 'agent'])
    .optional()
    .describe(
      'Storage scope: "company", "session", or "agent" (default: "agent")',
    ),
  scopeId: z
    .string()
    .optional()
    .describe(
      'ID for the scope: agentId/name for agent scope, sessionId for session scope. For company scope, this is ignored.',
    ),
  metadata: z
    .object({
      contentType: z.string().optional(),
      description: z.string().optional(),
      tags: z.array(z.string()).optional(),
    })
    .optional()
    .describe('Optional metadata for the item'),
});

export type AddWorkspaceItemInput = z.infer<typeof addWorkspaceItemSchema>;

/**
 * Add a workspace item
 */
export async function addWorkspaceItem(
  input: AddWorkspaceItemInput,
  companyId: string,
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    // Validate that either content or fileUrl is provided
    if (!input.content && !input.fileUrl) {
      throw new Error('Either content or fileUrl must be provided');
    }

    if (input.content && input.fileUrl) {
      throw new Error('Cannot provide both content and fileUrl. Use fileUrl for large files.');
    }

    const scope = input.scope || 'agent';
    const workspace = getWorkspaceService();

    let fullPath: string;
    const scopeInfo: any = { scope };

    // Resolve agent ID if needed
    let resolvedScopeId = input.scopeId;
    if (scope === 'agent' && input.scopeId) {
      const agent = await resolveAssistantIdentifier(
        input.scopeId,
        companyId,
      );
      if (!agent) {
        throw new Error(`Agent not found: ${input.scopeId}`);
      }
      resolvedScopeId = agent._id.toString();
      scopeInfo.agentId = resolvedScopeId;
      scopeInfo.agentName = agent.name;
    }

    // Build the full path based on scope
    switch (scope) {
      case 'company':
        fullPath = `/company/${companyId}${input.itemPath}`;
        scopeInfo.companyId = companyId;
        break;

      case 'session':
        if (!input.scopeId) {
          throw new Error('scopeId (sessionId) is required for session scope');
        }
        fullPath = `/session/${input.scopeId}${input.itemPath}`;
        scopeInfo.sessionId = input.scopeId;
        break;

      case 'agent':
      default:
        if (!resolvedScopeId) {
          throw new Error(
            'scopeId (agentId or agent name) is required for agent scope',
          );
        }
        fullPath = `/agent/${resolvedScopeId}${input.itemPath}`;
        break;
    }

    // If fileUrl is provided, download and store file reference
    if (input.fileUrl) {
      // Download file from URL
      const response = await axios.get(input.fileUrl, {
        responseType: 'arraybuffer',
        timeout: 30000, // 30 second timeout
      });

      const filename = input.fileUrl.split('/').pop() || 'file';
      const buffer = Buffer.from(response.data);

      // Store file content as base64 with metadata
      const fileReference = {
        type: 'file',
        filename,
        mimeType: response.headers['content-type'] || 'application/octet-stream',
        size: buffer.length,
        content: buffer.toString('base64'),
        sourceUrl: input.fileUrl,
        uploadedAt: new Date(),
      };

      // Store in workspace
      const metadata = {
        ...input.metadata,
        contentType: fileReference.mimeType,
        fileSize: fileReference.size,
        sourceUrl: input.fileUrl,
        createdAt: new Date(),
        updatedAt: new Date(),
        scope,
        companyId,
      };

      await workspace.set(fullPath, fileReference, metadata);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                file: {
                  path: input.itemPath,
                  fullPath,
                  filename,
                  mimeType: fileReference.mimeType,
                  size: fileReference.size,
                  sourceUrl: input.fileUrl,
                },
                message: 'File downloaded and stored successfully via URL',
              },
              null,
              2
            ),
          },
        ],
      };
    }

    // Add metadata with timestamp
    const metadata = {
      ...input.metadata,
      createdAt: new Date(),
      updatedAt: new Date(),
      scope,
      companyId,
    };

    // Store the item
    await workspace.set(fullPath, input.content, metadata);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              item: {
                path: input.itemPath,
                fullPath,
                scope: scopeInfo,
                contentType: typeof input.content,
                metadata: input.metadata,
              },
            },
            null,
            2,
          ),
        },
      ],
    };
  } catch (error) {
    console.error('MCP add workspace item error:', error);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              error: true,
              message:
                error instanceof Error
                  ? error.message
                  : 'Failed to add workspace item',
              path: input.itemPath,
              scope: input.scope || 'agent',
            },
            null,
            2,
          ),
        },
      ],
    };
  }
}

/**
 * Tool metadata for registration
 */
export const addWorkspaceItemTool = {
  name: 'add_workspace_item',
  description:
    'Add a new workspace item at company, session, or agent level. Default is agent level. Can store any JSON-serializable content (string, object, array, etc.). For large files (>50KB), use the fileUrl parameter to provide a URL to download and upload the file, bypassing MCP token limits.',
  inputSchema: addWorkspaceItemSchema,
};
