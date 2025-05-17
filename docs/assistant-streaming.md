# Streaming Responses from `/assistant/user-input`

This endpoint now supports Server-Sent Events (SSE) for real-time token streaming.

## Enabling Streaming

Send the request with either the `Accept: text/event-stream` header or the query
parameter `?stream=true`.

Example using `curl`:

```bash
curl -N \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Accept: text/event-stream" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"userInput":"hello","sessionId":"<SESSION_ID>"}' \
  http://localhost:3000/assistant/user-input
```

The response will stream chunks of text as they are generated. Each chunk is sent
as a separate SSE `data` line until `[DONE]` is emitted.
