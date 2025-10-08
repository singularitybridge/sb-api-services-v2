import { AuthenticatedSocket } from '../../types';
import { registerRpcMethod } from '../utils';
import { UnifiedWorkspaceService } from '../../../unified-workspace.service';

const workspaceService = new UnifiedWorkspaceService();

/**
 * Save search result to workspace
 */
registerRpcMethod(
  'uiSaveSearchResult',
  async (socket: AuthenticatedSocket, params: any) => {
    const { userId, companyId } = socket.decodedToken!;

    if (!params?.path || !params?.content) {
      throw new Error('path and content are required');
    }

    // Save to agent scope (7 days TTL)
    await workspaceService.saveItem({
      scope: 'agent',
      scopeId: params.agentId || 'default',
      companyId: companyId,
      path: params.path,
      content: params.content,
      metadata: {
        contentType: params.contentType || 'text/markdown',
        description: params.description || 'AI search result',
        tags: params.tags || ['search', 'ai-generated'],
      },
    });

    return {
      success: true,
      path: params.path,
      savedAt: new Date().toISOString(),
    };
  },
);

/**
 * Update workspace state (for UI components to track)
 */
registerRpcMethod(
  'uiUpdateWorkspaceState',
  async (socket: AuthenticatedSocket, params: any) => {
    if (!params?.key || params?.value === undefined) {
      throw new Error('key and value are required');
    }

    // Store state in temporary scope (10 min TTL for UI state)
    const { companyId } = socket.decodedToken!;
    const statePath = `/ui-state/${params.key}`;

    await workspaceService.saveItem({
      scope: 'temporary',
      scopeId: socket.id, // Use socket ID for session-specific state
      companyId: companyId,
      path: statePath,
      content: JSON.stringify(params.value),
      metadata: {
        contentType: 'application/json',
        description: 'UI component state',
        tags: ['ui-state', 'temporary'],
      },
    });

    return {
      success: true,
      key: params.key,
      updatedAt: new Date().toISOString(),
    };
  },
);

/**
 * Load file from workspace
 */
registerRpcMethod(
  'uiLoadFile',
  async (socket: AuthenticatedSocket, params: any) => {
    const { companyId } = socket.decodedToken!;

    if (!params?.path) {
      throw new Error('path is required');
    }

    // Try to load from different scopes
    const scopes = ['agent', 'session', 'team', 'company'];
    let content = null;
    let metadata = null;

    for (const scope of scopes) {
      try {
        const item = await workspaceService.getItem({
          scope: scope as any,
          scopeId: params.scopeId || 'default',
          companyId: companyId,
          path: params.path,
        });

        if (item) {
          content = item.content;
          metadata = item.metadata;
          break;
        }
      } catch (error) {
        // Try next scope
        continue;
      }
    }

    if (!content) {
      throw new Error(`File not found: ${params.path}`);
    }

    return {
      success: true,
      path: params.path,
      content,
      metadata,
      loadedAt: new Date().toISOString(),
    };
  },
);

/**
 * List workspace files
 */
registerRpcMethod(
  'uiListFiles',
  async (socket: AuthenticatedSocket, params: any) => {
    const { companyId } = socket.decodedToken!;

    const items = await workspaceService.listItems({
      scope: params?.scope || 'agent',
      scopeId: params?.scopeId || 'default',
      companyId: companyId,
      prefix: params?.prefix || '/',
    });

    return {
      success: true,
      items,
      count: items.length,
    };
  },
);

/**
 * Execute assistant and optionally save result
 */
registerRpcMethod(
  'uiExecuteAssistantWithSave',
  async (socket: AuthenticatedSocket, params: any) => {
    const { userId, companyId } = socket.decodedToken!;

    if (!params?.assistantId || !params?.userInput) {
      throw new Error('assistantId and userInput are required');
    }

    // Import here to avoid circular dependencies
    const { executeAssistantStateless } = await import(
      '../../../assistant/stateless-execution.service'
    );
    const { resolveAssistantIdentifier } = await import(
      '../../../assistant/assistant-resolver.service'
    );

    // Resolve assistant
    const assistant = await resolveAssistantIdentifier(
      params.assistantId,
      companyId,
    );

    if (!assistant) {
      throw new Error('Assistant not found');
    }

    // Execute assistant
    const result = await executeAssistantStateless(
      assistant,
      params.userInput,
      companyId,
      userId,
      params.attachments,
      params.responseFormat,
      { 'X-Workspace-RPC': 'true' },
      params.promptOverride,
    );

    // Extract text from result
    let responseText = '';
    if (typeof result === 'string') {
      responseText = result;
    } else if (result && typeof result === 'object') {
      // Handle message format from executeAssistantStateless
      // Format: { content: [{ type: 'text', text: { value: 'actual text' } }] }
      if (result.content && Array.isArray(result.content) && result.content.length > 0) {
        const firstContent = result.content[0];
        if (firstContent.type === 'text' && firstContent.text?.value) {
          responseText = firstContent.text.value;
        }
      } else if ('text' in result) {
        responseText = result.text;
      } else {
        // Fallback: try other common formats
        responseText = result.response || result.message || JSON.stringify(result);
      }
    }

    console.log('✅ RPC uiExecuteAssistantWithSave - Extracted response:', {
      resultType: typeof result,
      hasContent: result && typeof result === 'object' && 'content' in result,
      textLength: responseText.length,
      preview: responseText.substring(0, 150)
    });

    // Save to workspace if savePath provided
    if (params.savePath && responseText) {
      // Extract HTML from markdown code blocks if present
      let finalContent = responseText;
      const htmlCodeBlockMatch = responseText.match(/```html\s*([\s\S]*?)\s*```/);
      if (htmlCodeBlockMatch && htmlCodeBlockMatch[1]) {
        finalContent = htmlCodeBlockMatch[1].trim();
      }

      // Detect content type from response
      const isHtml = finalContent.trim().startsWith('<!DOCTYPE html>') ||
                     finalContent.trim().startsWith('<html');
      const contentType = isHtml ? 'text/html' : 'text/markdown';

      await workspaceService.saveItem({
        scope: 'agent',
        scopeId: params.assistantId,
        companyId: companyId,
        path: params.savePath,
        content: finalContent,
        metadata: {
          contentType,
          description: `AI response to: ${params.userInput.substring(0, 50)}...`,
          tags: ['search', 'ai-response', assistant.name],
        },
      });
    }

    return {
      success: true,
      response: responseText,
      savedPath: params.savePath || null,
      timestamp: new Date().toISOString(),
    };
  },
);
