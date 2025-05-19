import express from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { validateApiKeys } from '../../services/api.key.service';
// import { getApiKey } from '../../services/api.key.service'; // Not used after removing OpenAI specific routes
// import { createNewThread, deleteThread, getMessages } from '../../services/oai.thread.service'; // Removed, OpenAI specific
import { Session } from '../../models/Session';
import { Message } from '../../models/Message'; // Added for Step 5
import { handleSessionMessage } from '../../services/assistant.service';
import { ChannelType } from '../../types/ChannelType';
import { getMessagesBySessionId, getMessageById } from '../../services/message.service';

const threadRouter = express.Router();

// User feedback: Streaming is possible by default if client requests via Accept header.
// No global disable flag in code.

// Removed GET /:id/messages route as it was OpenAI specific and redundant
// Use GET /session/:sessionId/messages to fetch messages from MongoDB

// New route to fetch messages by session ID from MongoDB
threadRouter.get(
  '/session/:sessionId/messages',
  async (req: AuthenticatedRequest, res) => {
    const { sessionId } = req.params;
    try {
      const messages = await getMessagesBySessionId(sessionId);
      res.send(messages);
    } catch (error) {
      console.error('Error fetching messages:', error);
      res.status(500).send('An error occurred while fetching messages.');
    }
  }
);

// New route to fetch a specific message by ID from MongoDB
threadRouter.get(
  '/message/:messageId',
  async (req: AuthenticatedRequest, res) => {
    const { messageId } = req.params;
    try {
      const message = await getMessageById(messageId);
      if (!message) {
        res.status(404).send('Message not found');
      } else {
        res.send(message);
      }
    } catch (error) {
      console.error('Error fetching message:', error);
      res.status(500).send('An error occurred while fetching the message.');
    }
  }
);

// Removed POST / route as it was for creating OpenAI specific threads
// Removed DELETE /:id route as it was for deleting OpenAI specific threads

threadRouter.post(
  '/user-input',
  validateApiKeys(['openai_api_key']),
  async (req: AuthenticatedRequest, res) => {
    const { userInput, sessionId } = req.body;
    // const apiKey = (await getApiKey(req.company._id, 'openai_api_key')) as string; // apiKey is likely handled within handleSessionMessage or streamText

    // Determine clientWantsSSE before the try block for wider scope
    const acceptHeader = req.get('Accept');
    const clientWantsSSE = typeof acceptHeader === 'string' && acceptHeader.includes('text/event-stream');

    try {
      const session = await Session.findById(sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      // Step 3: Streaming is determined by client's Accept header.
      // The 406 error for a global disable flag is removed.
      // If clientWantsSSE is true, we attempt to stream.
      const wantsSSE = clientWantsSSE;

      if (wantsSSE) {
        // SSE Logic
        res.set({
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        });
        res.flushHeaders();

        // Step 6: Send heartbeat
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

        const result = await handleSessionMessage(
          userInput,
          sessionId,
          ChannelType.WEB,
          { 'X-Experimental-Stream': 'true' } // Inform service that SSE is expected
        );

        if (
          result &&
          typeof result === 'object' &&
          'textStream' in result &&
          result.textStream &&
          typeof (result as any).textStream[Symbol.asyncIterator] === 'function'
        ) {
          const { textStream, assistantId: messageAssistantId, threadId: messageThreadId } = result as any; // Assuming these are returned
          
          // Step 5: Persist the assistant reply even in stream mode
          let fullText = '';
          for await (const chunk of textStream) {
            if (res.writableEnded) break;
            fullText += chunk;
            // Step 4: Wrap each model chunk in JSON
            res.write(`data:${JSON.stringify({ type: 'token', value: chunk })}\n\n`);
          }

          // Removed Message.create from here as it's handled in message-handling.service.ts
          // The console.log for "Assistant SSE reply persisted" is also removed as the save happens elsewhere.
        } else {
          console.error(
            'handleSessionMessage did not return a valid textStream for SSE. Result:',
            result,
          );
          if (!res.writableEnded) {
            const errorMessage = typeof result === 'string' 
              ? `Expected a stream but received a string response: ${result.substring(0, 100)}...`
              : "Failed to establish stream or received an unexpected response type.";
            // Step 6: Structured error frame
            res.write(
              `event:error\ndata:${JSON.stringify({type:'error', errorDetails:{message: errorMessage}})}\n\n`
            );
          }
        }
        if (!res.writableEnded) {
          res.write(`data:${JSON.stringify({ type:'done' })}\n\n`);
          res.end();
        }
      } else {
        // JSON Logic (non-streaming)
        const result = await handleSessionMessage(
          userInput,
          sessionId,
          ChannelType.WEB // No streaming metadata, so it returns a string
        );

        if (typeof result === 'string') {
          res.json({ content: result });
        } else {
          // This case should ideally not be hit if handleSessionMessage correctly returns a string
          // when no streaming metadata is passed.
          console.error('handleSessionMessage returned a stream object when a JSON response was expected.');
          res.status(500).json({ error: 'Internal server error: Unexpected response format from message handler.' });
        }
      }
    } catch (error) {
      console.error('Error handling user input:', error);
      const err = error as Error; // Type assertion
      // Step 6: Structured error frame in catch block
      // Check if SSE was intended for this error path using clientWantsSSE
      if (clientWantsSSE && !res.writableEnded) { 
        res.write(`event:error\ndata:${JSON.stringify({type:'error', errorDetails:{message: err.message || 'An unknown error occurred during streaming.'}})}\n\n`);
        res.end();
      } else if (!res.headersSent) {
        res.status(500).json({ error: err.message || 'An error occurred while processing your request.' });
      } else if (!res.writableEnded) {
        // Fallback if headers sent but not SSE, or if writable but can't determine SSE
        res.end(); 
      }
    }
  }
);

export { threadRouter };
