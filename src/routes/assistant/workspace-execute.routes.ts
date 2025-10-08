import { Router, Request, Response } from 'express';
import { verifyTokenMiddleware } from '../../middleware/auth.middleware';
import { executeAssistantStateless } from '../../services/assistant/stateless-execution.service';
import { resolveAssistantIdentifier } from '../../services/assistant/assistant-resolver.service';

const router = Router();

/**
 * Execute assistant query for workspace with SSE streaming
 * POST /api/assistants/:id/workspace-execute
 */
router.post(
  '/:id/workspace-execute',
  verifyTokenMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { id: assistantId } = req.params;
      const { query, searchContext } = req.body;
      const companyId = (req as any).company._id;
      const workspaceSession = req.headers['x-workspace-session'] as string;
      const acceptHeader = req.headers['accept'] || '';
      const isSSE = acceptHeader.includes('text/event-stream');

      if (!query || typeof query !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Query parameter is required and must be a string'
        });
      }

      // Find assistant by ID or name using resolver
      const assistant = await resolveAssistantIdentifier(assistantId, companyId.toString());

      if (!assistant) {
        return res.status(404).json({
          success: false,
          error: 'Assistant not found'
        });
      }

      console.log(`🔍 [Workspace Execute] Assistant: ${assistant.name}, Query: "${query}"`);
      console.log(`📍 [Workspace Execute] Context:`, searchContext);
      console.log(`🔄 [Workspace Execute] Streaming: ${isSSE}`);

      // Get userId from request - needed for executeAssistantStateless
      const userId = (req as any).user?._id?.toString() || 'workspace-user';

      // Prepare prompt override with context
      const promptOverride = searchContext?.currentPage
        ? `${assistant.llmPrompt}\n\nCurrent workspace context: User is viewing ${searchContext.currentPage}`
        : undefined;

      // Set up SSE if requested
      if (isSSE) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        // Send initial connection event
        res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: Date.now() })}\n\n`);

        // Execute assistant with streaming
        try {
          const result = await executeAssistantStateless(
            assistant,
            query,
            companyId.toString(),
            userId,
            undefined, // attachments
            undefined, // responseFormat
            { 'X-Experimental-Stream': 'true' }, // metadata - fixed key to match stateless service
            promptOverride
          );

          // Stream the response
          if (result && typeof result === 'object' && 'textStream' in result) {
            const { textStream } = result as any;

            for await (const chunk of textStream) {
              if (res.writableEnded) break;
              res.write(`data: ${JSON.stringify({
                type: 'chunk',
                content: chunk,
                timestamp: Date.now()
              })}\n\n`);
            }
          } else if (typeof result === 'string') {
            // Non-streaming response - send as single chunk
            res.write(`data: ${JSON.stringify({
              type: 'chunk',
              content: result,
              timestamp: Date.now()
            })}\n\n`);
          }

          // Send completion event
          res.write(`data: ${JSON.stringify({
            type: 'complete',
            timestamp: Date.now()
          })}\n\n`);

          res.end();
        } catch (execError: any) {
          console.error('❌ [Workspace Execute] Execution error:', execError);
          if (!res.writableEnded) {
            res.write(`data: ${JSON.stringify({
              type: 'error',
              error: execError.message || 'Execution failed',
              timestamp: Date.now()
            })}\n\n`);
            res.end();
          }
        }
      } else {
        // JSON response mode
        const result = await executeAssistantStateless(
          assistant,
          query,
          companyId.toString(),
          userId,
          undefined,
          undefined,
          undefined,
          promptOverride
        );

        return res.json({
          success: true,
          response: typeof result === 'string' ? result : JSON.stringify(result)
        });
      }
    } catch (error: any) {
      console.error('❌ [Workspace Execute] Error:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Internal server error'
      });
    }
  }
);

export default router;
