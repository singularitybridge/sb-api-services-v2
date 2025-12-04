# Nylas Service - Fastify Microservice

**Purpose**: Standalone Fastify microservice that handles all Nylas API communication.

## Architecture

### Design Principles

1. **Stateless**: No database connections, no session management
2. **Thin Layer**: Only handles Nylas API calls, no business logic
3. **Main App Integration**: Main Express app handles:
   - Authentication
   - Database lookups (users, grants, companies)
   - Business logic and orchestration
   - Activity logging
4. **HTTP Communication**: Main app calls this service via HTTP

### Service Boundaries

**This service handles:**
- OAuth flow initiation (generate auth URLs)
- OAuth callback processing (exchange code for grant)
- Nylas API calls (calendar, contacts, email)
- Grant revocation via Nylas API

**Main app handles:**
- User authentication and authorization
- Database operations (NylasAccount, grants, etc.)
- Activity logging and request tracking
- Business logic and data transformations

## Endpoints

### OAuth

```
GET  /oauth/authorize     - Generate OAuth URL
GET  /oauth/callback      - Handle OAuth callback
GET  /oauth/status        - Check connection status (passthrough)
POST /oauth/disconnect    - Revoke grant via Nylas API
```

### Calendar (Planned)

```
GET  /calendar/availability      - Check availability
POST /calendar/events            - Create calendar event
GET  /calendar/events/:id        - Get event details
PUT  /calendar/events/:id        - Update event
DELETE /calendar/events/:id      - Delete event
```

### Contacts (Planned)

```
GET  /contacts/find              - Search contacts
GET  /contacts/:id               - Get contact
POST /contacts                   - Create contact
PUT  /contacts/:id               - Update contact
DELETE /contacts/:id             - Delete contact
```

### Email (Planned)

```
POST /email/send                 - Send email
GET  /email/find                 - Search emails
GET  /email/:id                  - Get email
PUT  /email/:id/read             - Mark as read/unread
```

## Configuration

Environment variables:

```bash
# Service
NYLAS_SERVICE_PORT=3001
NYLAS_SERVICE_HOST=127.0.0.1

# Nylas
NYLAS_CLIENT_ID=your_client_id
NYLAS_CLIENT_SECRET=your_client_secret
NYLAS_API_URL=https://api.us.nylas.com
NYLAS_REDIRECT_URI=http://localhost:3001/oauth/callback

# Frontend redirects
NYLAS_SUCCESS_REDIRECT=http://localhost:5173/settings/integrations?connected=true
NYLAS_ERROR_REDIRECT=http://localhost:5173/settings/integrations?error=auth_failed
```

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

## Request/Response Format

All endpoints follow this format:

**Success:**
```json
{
  "success": true,
  "data": { /* result */ },
  "timestamp": "2025-12-04T..."
}
```

**Error:**
```json
{
  "success": false,
  "error": "Error message",
  "statusCode": 400,
  "timestamp": "2025-12-04T..."
}
```

## Integration with Main App

The main Express app will:

1. Authenticate users
2. Look up their Nylas grant
3. Make HTTP call to this service with grant ID
4. Process and return results

Example flow:

```typescript
// Main app (Express)
async function checkUserAvailability(req, res) {
  // 1. Authenticate
  const userId = req.user._id;

  // 2. Get grant from database
  const grant = await NylasAccount.findOne({ userId });

  // 3. Call microservice
  const response = await axios.get('http://localhost:3001/calendar/availability', {
    params: {
      grantId: grant.nylasGrantId,
      startDate: req.body.startDate,
      endDate: req.body.endDate
    }
  });

  // 4. Return result
  res.json(response.data);
}
```

## Deployment

Will run alongside main app using PM2:

```bash
pm2 start ecosystem.config.js
```

Both services run on same server:
- Main app: Port 3000 (public)
- Nylas service: Port 3001 (internal, 127.0.0.1 only)
- Webhook service: Port 3002 (internal)
