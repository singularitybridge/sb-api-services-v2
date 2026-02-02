import express from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { validateApiKeys } from '../../services/api.key.service';
// import { getApiKey } from '../../services/api.key.service'; // Not used after removing OpenAI specific routes
// import { createNewThread, deleteThread, getMessages } from '../../services/oai.thread.service'; // Removed, OpenAI specific
import { Session, ISession } from '../../models/Session'; // ISession added
import { Message } from '../../models/Message'; // Added for Step 5
import { handleSessionMessage } from '../../services/assistant.service';
import { getSessionOrCreate } from '../../services/session.service'; // Added
import {
  getMessagesBySessionId,
  getMessageById,
} from '../../services/message.service';

const threadRouter = express.Router();

// Helper function to generate unique message IDs
const generateMessageId = (): string => {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// User feedback: Streaming is possible by default if client requests via Accept header.
// No global disable flag in code.

// Removed GET /:id/messages route as it was OpenAI specific and redundant
// Use GET /session/:sessionId/messages to fetch messages from MongoDB
// This route is now handled by src/routes/session.routes.ts (GET /messages and GET /:id/messages)
// So, the specific /session/:sessionId/messages route is removed from here to avoid redundancy.

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
  },
);

// Removed POST / route as it was for creating OpenAI specific threads
// Removed DELETE /:id route as it was for deleting OpenAI specific threads

threadRouter.post(
  '/user-input',
  validateApiKeys(['openai_api_key']),
  async (req: AuthenticatedRequest, res) => {
    const { userInput, attachments } = req.body; // Added attachments
    // const apiKey = (await getApiKey(req.company._id, 'openai_api_key')) as string; // apiKey is likely handled within handleSessionMessage or streamText

    // Determine clientWantsSSE before the try block for wider scope
    const acceptHeader = req.get('Accept');
    const clientWantsSSE =
      typeof acceptHeader === 'string' &&
      acceptHeader.includes('text/event-stream');

    try {
      // Get or create the active session for the user
      const companyId = req.user?.companyId?.toString();
      const userId = req.user?._id?.toString();

      if (!companyId || !userId) {
        return res
          .status(400)
          .json({ error: 'User or Company ID not found in request.' });
      }

      // Using the default web channel for this endpoint. If additional channels are introduced, revisit this logic.
      // The getSessionOrCreate function expects an API key, but it's not directly used for session retrieval logic itself,
      // rather it was a prerequisite for OpenAI calls. Since we are moving away from direct OpenAI calls in session.service for thread creation,
      // and api.key.service.getApiKey is called within session.service.getSessionLanguage,
      // we can pass a placeholder or handle it if getSessionOrCreate strictly needs it for other paths.
      // For now, let's assume it's primarily for downstream services and might not be strictly needed here if we're just getting/creating a session.
      // However, looking at getSessionOrCreate, it does take an apiKey. Let's pass an empty string for now and see if it breaks.
      // A better approach would be to refactor getSessionOrCreate if apiKey is not always needed.
      // For now, let's retrieve it as it was done in other routes.
      // const apiKey = (await getApiKey(companyId, 'openai_api_key')) as string; // This was how it was done in session.routes.ts
      // The apiKey is not directly used by getSessionOrCreate for finding/creating session, but passed along.
      // Let's pass a dummy value or handle it properly.
      // The validateApiKeys middleware should ensure 'openai_api_key' is available if needed by downstream.
      // The `getSessionOrCreate` function in `session.service.ts` does not actually use the apiKey parameter for its core logic of finding or creating a session.
      // It was originally passed for potential OpenAI calls which are now removed.
      // We can pass an empty string or a placeholder.
      const sessionData = await getSessionOrCreate(
        '', // Placeholder for apiKey, as it's not used for session creation/retrieval itself
        userId,
        companyId,
      );

      if (!sessionData || !sessionData._id) {
        return res
          .status(404)
          .json({ error: 'Active session could not be found or created.' });
      }
      const activeSessionId = sessionData._id.toString();

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
          activeSessionId, // Use the retrieved/created active session ID
          { 'X-Experimental-Stream': 'true' }, // Inform service that SSE is expected
          attachments, // Pass attachments
        );

        if (
          result &&
          typeof result === 'object' &&
          'textStream' in result &&
          result.textStream &&
          typeof (result as any).textStream[Symbol.asyncIterator] === 'function'
        ) {
          const {
            textStream,
            assistantId: messageAssistantId,
            threadId: messageThreadId,
            hasEmptyResponse,
            errorMessage,
            provider,
          } = result as any; // Assuming these are returned

          // Get provider-specific API key documentation URL
          const getApiKeyDocsUrl = (provider: string) => {
            switch (provider) {
              case 'openai':
                return 'https://platform.openai.com/api-keys';
              case 'google':
                return 'https://aistudio.google.com/app/apikey';
              case 'anthropic':
                return 'https://console.anthropic.com/settings/keys';
              default:
                return '';
            }
          };

          const providerDisplayName =
            provider === 'google'
              ? 'Google'
              : provider === 'openai'
                ? 'OpenAI'
                : provider === 'anthropic'
                  ? 'Anthropic'
                  : provider || 'AI';
          const apiKeyDocsUrl = getApiKeyDocsUrl(provider);

          // Check if the stream has error indicators from the service
          if (hasEmptyResponse && errorMessage && !res.writableEnded) {
            res.write(
              `event:error\ndata:${JSON.stringify({
                type: 'error',
                errorDetails: {
                  message:
                    errorMessage +
                    ' at http://localhost:5173/admin/companies/' +
                    companyId,
                },
              })}\n\n`,
            );
            res.end();
            return; // Exit early since we have an error
          }

          // Step 5: Persist the assistant reply even in stream mode
          let fullText = '';
          let hasContent = false;
          let hasError = false;

          try {
            for await (const chunk of textStream) {
              if (res.writableEnded) break;
              fullText += chunk;
              hasContent = true;
              // Step 4: Wrap each model chunk in JSON
              res.write(
                `data:${JSON.stringify({ type: 'token', value: chunk })}\n\n`,
              );
            }

            // Check if stream was empty
            if (!hasContent && !res.writableEnded) {
              hasError = true;
              // Empty stream could be due to various reasons - provide a more helpful message
              const errorMsg = `Failed to generate response. This could be due to: 1) Invalid API key, 2) Content too large for the model, or 3) Service issues. Please check your ${providerDisplayName} configuration.`;
              res.write(
                `event:error\ndata:${JSON.stringify({
                  type: 'error',
                  errorDetails: {
                    message: errorMsg,
                  },
                })}\n\n`,
              );
            }
          } catch (streamError) {
            console.error('[SSE] Error reading stream:', streamError);
            hasError = true;
            if (!res.writableEnded) {
              const error = streamError as Error;
              const errorMessage = error.message?.toLowerCase() || '';
              const isApiKeyError =
                errorMessage.includes('invalid api key') ||
                errorMessage.includes('unauthorized') ||
                errorMessage.includes('401');
              const isContextLengthError =
                errorMessage.includes('context_length') ||
                errorMessage.includes('context length') ||
                errorMessage.includes('maximum context') ||
                errorMessage.includes('token limit') ||
                errorMessage.includes('too many tokens') ||
                errorMessage.includes('max_tokens') ||
                errorMessage.includes('request too large');
              const isRateLimitError =
                errorMessage.includes('rate limit') ||
                errorMessage.includes('rate_limit') ||
                errorMessage.includes('429') ||
                errorMessage.includes('too many requests');

              let userMessage: string;
              if (isApiKeyError) {
                userMessage = `Invalid ${providerDisplayName} API key. Please update your API key in the admin settings.`;
              } else if (isContextLengthError) {
                userMessage = `The conversation or content is too long for the model to process. Please start a new conversation or reduce the content size.`;
              } else if (isRateLimitError) {
                userMessage = `Rate limit exceeded. Please wait a moment and try again.`;
              } else {
                userMessage = `Error: ${error.message}`;
              }

              res.write(
                `event:error\ndata:${JSON.stringify({
                  type: 'error',
                  errorDetails: {
                    message: userMessage,
                  },
                })}\n\n`,
              );
            }
          }

          // Send done event only if there was no error
          if (!hasError && !res.writableEnded) {
            res.write(`data:${JSON.stringify({ type: 'done' })}\n\n`);
          }

          // End the response
          if (!res.writableEnded) {
            res.end();
          }

          // Removed Message.create from here as it's handled in message-handling.service.ts
          // The console.log for "Assistant SSE reply persisted" is also removed as the save happens elsewhere.
        } else {
          console.error(
            'handleSessionMessage did not return a valid textStream for SSE. Result:',
            result,
          );
          if (!res.writableEnded) {
            const errorMessage =
              typeof result === 'string'
                ? `Expected a stream but received a string response: ${result.substring(
                    0,
                    100,
                  )}...`
                : 'Failed to establish stream or received an unexpected response type.';
            // Step 6: Structured error frame
            res.write(
              `event:error\ndata:${JSON.stringify({
                type: 'error',
                errorDetails: { message: errorMessage },
              })}\n\n`,
            );
            res.end();
          }
        }
      } else {
        // JSON Logic (non-streaming) - FIXED: Return standard message format
        const result = await handleSessionMessage(
          userInput,
          activeSessionId,
          undefined, // No streaming metadata
          attachments, // Pass attachments
        );

        if (typeof result === 'string') {
          // Return standard message format as required by the documentation
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
            assistant_id: sessionData.assistantId?.toString(),
            thread_id: activeSessionId,
            message_type: 'text',
          };

          res.json(response);
        } else {
          // This case should ideally not be hit if handleSessionMessage correctly returns a string
          // when no streaming metadata is passed.
          console.error(
            'handleSessionMessage returned a stream object when a JSON response was expected.',
          );
          res.status(500).json({
            error:
              'Internal server error: Unexpected response format from message handler.',
          });
        }
      }
    } catch (error) {
      console.error('Error handling user input:', error);
      const err = error as Error; // Type assertion
      // Step 6: Structured error frame in catch block
      // Check if SSE was intended for this error path using clientWantsSSE
      if (clientWantsSSE && !res.writableEnded) {
        res.write(
          `event:error\ndata:${JSON.stringify({
            type: 'error',
            errorDetails: {
              message:
                err.message || 'An unknown error occurred during streaming.',
            },
          })}\n\n`,
        );
        res.end();
      } else if (!res.headersSent) {
        res.status(500).json({
          error:
            err.message || 'An error occurred while processing your request.',
        });
      } else if (!res.writableEnded) {
        // Fallback if headers sent but not SSE, or if writable but can't determine SSE
        res.end();
      }
    }
  },
);

export { threadRouter };
