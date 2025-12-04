# Nylas Webhooks Service - Fastify Microservice

**Purpose**: Standalone Fastify microservice that receives and processes Nylas webhook events.

## Architecture

### Design Principles

1. **Event Receiver**: Receives webhooks from Nylas
2. **Signature Verification**: Validates webhook authenticity
3. **Event Processing**: Routes events to appropriate handlers
4. **Forward to Main App**: Sends processed events to Express app
5. **Stateless**: No database dependencies (optional event logging)

### Service Boundaries

**This service handles:**
- Receiving Nylas webhook POST requests
- Verifying webhook signatures (HMAC-SHA256)
- Processing webhook events by type
- Forwarding events to main Express app
- Webhook verification for Nylas setup

**Main app handles:**
- Business logic based on webhook events
- Database updates
- User notifications
- Email/calendar sync updates

## Endpoints

### Webhooks

```
POST /webhooks        - Receive webhook events
GET  /webhooks/verify - Webhook verification (Nylas setup)
POST /webhooks/test   - Test endpoint (development only)
```

### System

```
GET /health - Health check
GET /info   - Service metadata
```

## Supported Webhook Events

### Email Events
- `message.created` - New email received
- `message.updated` - Email updated (read status, etc.)
- `thread.created` - New email thread

### Calendar Events
- `event.created` - Calendar event created
- `event.updated` - Calendar event updated
- `event.deleted` - Calendar event deleted

### Contact Events
- `contact.created` - Contact created
- `contact.updated` - Contact updated

### Account Events
- `grant.expired` - OAuth grant expired (requires re-authorization)

## Configuration

Environment variables:

```bash
# Service
WEBHOOKS_SERVICE_PORT=3002
WEBHOOKS_SERVICE_HOST=127.0.0.1

# Nylas
NYLAS_WEBHOOK_SECRET=your_webhook_secret

# Main App
MAIN_APP_URL=http://localhost:3000

# Optional: Database for event logging
MONGODB_URI=mongodb://localhost:27017/singularity-bridge
```

## Webhook Signature Verification

Nylas signs all webhooks with HMAC-SHA256. This service automatically verifies signatures:

```typescript
// Signature verification happens automatically
// If verification fails, webhook is rejected with 401
```

To get your webhook secret:
1. Go to Nylas Dashboard
2. Navigate to Webhooks
3. Copy the webhook secret

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build
npm run build

# Run production
npm start
```

## Setting Up Webhooks in Nylas

1. **Create Webhook in Nylas Dashboard**:
   - URL: `https://your-domain.com/webhooks`
   - Events: Select events you want to receive
   - Note the webhook secret

2. **Verify Webhook**:
   Nylas will send a GET request with `challenge` parameter.
   This service automatically handles verification.

3. **Test Webhook**:
   ```bash
   curl -X POST http://localhost:3002/webhooks/test \
     -H "Content-Type: application/json" \
     -d '{"type": "message.created", "data": {"object": {"id": "test-123"}}}'
   ```

## Request/Response Format

### Webhook POST Request

```json
{
  "deltas": [
    {
      "id": "event-123",
      "type": "message.created",
      "specversion": "1.0",
      "source": "nylas",
      "time": "2025-12-04T12:00:00Z",
      "data": {
        "object": {
          "id": "message-456",
          "grant_id": "grant-789",
          "subject": "Hello",
          "from": [{"email": "sender@example.com"}]
        },
        "application_id": "app-123",
        "grant_id": "grant-789"
      }
    }
  ]
}
```

### Success Response

```json
{
  "success": true,
  "processed": 1,
  "failed": 0,
  "errors": [],
  "duration": 45,
  "timestamp": "2025-12-04T12:00:00.123Z"
}
```

### Error Response

```json
{
  "success": false,
  "error": "Invalid webhook signature",
  "statusCode": 401,
  "timestamp": "2025-12-04T12:00:00.123Z"
}
```

## Integration with Main App

### Forwarding Events

Events are automatically forwarded to main Express app:

```typescript
// POST to main app
axios.post('http://localhost:3000/api/webhooks/nylas/process', event, {
  headers: {
    'X-Webhook-Source': 'nylas-webhooks-service'
  }
});
```

### Main App Endpoint

Create this endpoint in your Express app:

```typescript
// src/routes/webhooks.ts
router.post('/api/webhooks/nylas/process', async (req, res) => {
  const event = req.body;

  switch (event.type) {
    case 'message.created':
      // Handle new email
      await handleNewEmail(event.data.object);
      break;

    case 'event.created':
      // Handle new calendar event
      await handleNewCalendarEvent(event.data.object);
      break;

    // ... more handlers
  }

  res.json({ success: true });
});
```

## Event Processing Flow

1. **Receive**: Nylas sends webhook to `/webhooks`
2. **Verify**: Check HMAC-SHA256 signature
3. **Parse**: Extract event data from payload
4. **Route**: Send to appropriate handler based on event type
5. **Forward**: Send to main Express app for business logic
6. **Respond**: Return 200 OK to Nylas

## Error Handling

### Retry Logic

Nylas automatically retries failed webhooks:
- Initial attempt
- Retry after 1 minute
- Retry after 5 minutes
- Retry after 15 minutes
- Final retry after 1 hour

This service returns appropriate status codes:
- `200 OK` - Webhook processed successfully
- `401 Unauthorized` - Invalid signature
- `500 Internal Server Error` - Processing failed (will be retried)

### Idempotency

Events include unique IDs. Main app should:
- Check if event already processed
- Skip duplicate events
- Handle out-of-order events

## Monitoring

### Health Check

```bash
curl http://localhost:3002/health
```

### Logs

Service uses structured logging (Pino):

```json
{
  "level": "info",
  "msg": "Webhook received",
  "eventCount": 1,
  "types": ["message.created"],
  "timestamp": "2025-12-04T12:00:00.123Z"
}
```

## Deployment

### With PM2

```javascript
// ecosystem.config.js
{
  name: 'webhooks-service',
  script: 'dist/server.js',
  cwd: './nylas-webhooks',
  instances: 1,
  env: {
    NODE_ENV: 'production',
    WEBHOOKS_SERVICE_PORT: 3002,
    NYLAS_WEBHOOK_SECRET: 'your_secret'
  }
}
```

### Nginx Configuration

```nginx
# Internal only - not exposed to internet
# Nylas sends webhooks via public URL
location /webhooks {
  proxy_pass http://127.0.0.1:3002;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
}
```

## Security

1. **Signature Verification**: All webhooks verified
2. **Internal Binding**: Binds to 127.0.0.1 (not internet-facing)
3. **Rate Limiting**: 1000 requests/minute
4. **Body Size Limit**: 1MB max
5. **HTTPS Required**: In production (handled by reverse proxy)

## Testing

### Manual Test

```bash
# Test webhook verification
curl "http://localhost:3002/webhooks/verify?challenge=test123"

# Test webhook processing (requires signature)
curl -X POST http://localhost:3002/webhooks \
  -H "Content-Type: application/json" \
  -H "X-Nylas-Signature: <signature>" \
  -d @webhook-payload.json
```

### Development Test Endpoint

```bash
# Simulates webhook without signature verification
curl -X POST http://localhost:3002/webhooks/test \
  -H "Content-Type: application/json" \
  -d '{
    "type": "message.created",
    "data": {
      "object": {"id": "test-123"}
    }
  }'
```

## Troubleshooting

### Webhook Not Received

1. Check Nylas Dashboard for delivery status
2. Verify webhook URL is correct
3. Check firewall/network rules
4. Review service logs

### Signature Verification Failed

1. Verify `NYLAS_WEBHOOK_SECRET` matches Nylas Dashboard
2. Check webhook is from Nylas (not third-party)
3. Review signature calculation in logs

### Event Processing Failed

1. Check main app endpoint is accessible
2. Review main app logs
3. Verify event format matches expected structure

---

**Last Updated**: 2025-12-04
**Version**: 1.0.0
**Service Port**: 3002
