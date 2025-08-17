import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { executeAssistantStateless } from '../../services/assistant/stateless-execution.service';
import { Assistant } from '../../models/Assistant';
import mongoose from 'mongoose';
import { isValidObjectId } from '../../utils/validation';

// Helper function to generate unique message IDs
const generateMessageId = (): string => {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export const executeHandler = async (req: AuthenticatedRequest, res: any) => {
  const { assistantId } = req.params;
  const { userInput, attachments, responseFormat, promptOverride } = req.body; // Add responseFormat and promptOverride

  // Determine if client wants SSE
  const acceptHeader = req.get('Accept');
  const clientWantsSSE =
    typeof acceptHeader === 'string' &&
    acceptHeader.includes('text/event-stream');

  try {
    // Ensure user and company context from authentication
    if (!req.user || !req.company) {
      return res.status(401).json({
        error:
          'User or company context not found. Authentication may have failed.',
      });
    }

    // Validate assistant ID format
    if (!assistantId || !isValidObjectId(assistantId)) {
      return res.status(400).json({
        error:
          'Invalid assistant ID format. Must be a valid 24-character hex string.',
      });
    }

    // Validate assistant exists and belongs to company
    console.log(
      `[Execute Route] Looking for assistant with ID: ${assistantId}`,
    );
    console.log(`[Execute Route] Company ID from token: ${req.company._id}`);

    const assistant = await Assistant.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(assistantId),
        companyId: req.company._id,
      },
      {
        $set: { lastAccessedAt: new Date() },
      },
      {
        new: true,
      },
    );

    if (!assistant) {
      console.log(`[Execute Route] Assistant not found or access denied`);
      // Try to find if assistant exists at all
      const assistantExists = await Assistant.findById(assistantId);
      if (assistantExists) {
        console.log(
          `[Execute Route] Assistant exists but belongs to company: ${assistantExists.companyId}`,
        );
      } else {
        console.log(
          `[Execute Route] Assistant with ID ${assistantId} does not exist`,
        );
      }
      return res.status(404).json({
        error: 'Assistant not found or access denied for this company.',
      });
    }

    // Execute assistant message without session
    const companyId = req.company._id.toString();
    const userId = req.user._id.toString(); // Now safe to access after the check

    if (clientWantsSSE) {
      // SSE Logic
      res.set({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      res.flushHeaders();

      // Heartbeat
      const heartbeatInterval = setInterval(() => {
        if (!res.writableEnded) {
          res.write(':keep-alive\n\n');
        } else {
          clearInterval(heartbeatInterval);
        }
      }, 20000);

      res.on('close', () => {
        clearInterval(heartbeatInterval);
        if (!res.writableEnded) {
          res.end();
        }
        console.log('SSE connection closed by client');
      });

      const result = await executeAssistantStateless(
        assistant,
        userInput,
        companyId,
        userId,
        attachments,
        undefined, // responseFormat is undefined for SSE
        { 'X-Experimental-Stream': 'true' }, // metadata
        promptOverride, // Pass promptOverride
      );

      if (
        result &&
        typeof result === 'object' &&
        'textStream' in result &&
        result.textStream &&
        typeof (result as any).textStream[Symbol.asyncIterator] === 'function'
      ) {
        const { textStream } = result as any;

        for await (const chunk of textStream) {
          if (res.writableEnded) break;
          res.write(
            `data:${JSON.stringify({ type: 'token', value: chunk })}\n\n`,
          );
        }
      } else {
        console.error(
          'executeAssistantStateless did not return a valid textStream for SSE',
        );
        if (!res.writableEnded) {
          res.write(
            `event:error\ndata:${JSON.stringify({
              type: 'error',
              errorDetails: { message: 'Failed to establish stream' },
            })}\n\n`,
          );
        }
      }

      if (!res.writableEnded) {
        res.write(`data:${JSON.stringify({ type: 'done' })}\n\n`);
        res.end();
      }
    } else {
      // JSON Logic (non-streaming)
      const result = await executeAssistantStateless(
        assistant,
        userInput,
        companyId,
        userId,
        attachments,
        responseFormat, // Pass responseFormat
        undefined, // metadata
        promptOverride, // Pass promptOverride
      );

      // Handle structured response
      if (
        responseFormat?.type === 'json_object' ||
        responseFormat?.type === 'json_schema'
      ) {
        // The result should already be properly formatted
        res.json(result);
      } else if (typeof result === 'object' && 'content' in result) {
        // Result already formatted by service
        res.json(result);
      } else if (typeof result === 'string') {
        // Format the response
        const response = {
          id: generateMessageId(),
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: {
                value: result,
              },
            },
          ],
          created_at: Math.floor(Date.now() / 1000),
          assistant_id: assistantId,
          message_type: 'text',
        };

        res.json(response);
      } else {
        console.error('executeAssistantStateless returned unexpected format');
        res
          .status(500)
          .json({ error: 'Internal server error: Unexpected response format' });
      }
    }
  } catch (error) {
    console.error('Error executing assistant:', error);
    const err = error as Error;

    if (clientWantsSSE && !res.writableEnded) {
      res.write(
        `event:error\ndata:${JSON.stringify({
          type: 'error',
          errorDetails: { message: err.message || 'An unknown error occurred' },
        })}\n\n`,
      );
      res.end();
    } else if (!res.headersSent) {
      res.status(500).json({
        error:
          err.message || 'An error occurred while processing your request.',
      });
    } else if (!res.writableEnded) {
      res.end();
    }
  }
};
