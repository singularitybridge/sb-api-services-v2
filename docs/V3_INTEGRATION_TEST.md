# V3 Microservice Integration Testing

This document provides curl commands and test procedures for validating the integration with the Nylas V3 microservice.

## V3 Service Information

- **Base URL**: `https://sb-api-services-v3-53926697384.us-central1.run.app`
- **Protocol**: HTTPS only
- **Authentication**: Grant-based (no bearer tokens required)
- **Region**: us-central1 (GCP)

---

## Test 1: Health Check

Verify the V3 service is accessible and running.

### Request

```bash
curl -X GET \
  https://sb-api-services-v3-53926697384.us-central1.run.app/health \
  -H "Content-Type: application/json"
```

### Expected Response

```json
{
  "status": "healthy",
  "service": "nylas-v3-proxy",
  "timestamp": "2025-01-16T10:00:00Z"
}
```

### Verification

- Status code: `200 OK`
- Response time: < 500ms
- Service is "healthy"

---

## Test 2: Grant Resolution by Email

Retrieve a grant ID for a given user email.

### Request

```bash
curl -X GET \
  "https://sb-api-services-v3-53926697384.us-central1.run.app/api/v1/nylas/grants/by-email?email=user@testcompany.com" \
  -H "Content-Type: application/json"
```

### Expected Response (Grant Exists)

```json
{
  "success": true,
  "grantId": "user-grant-456789",
  "email": "user@testcompany.com",
  "provider": "google",
  "scopes": ["email", "calendar", "contacts"]
}
```

### Expected Response (Grant Not Found)

```json
{
  "success": false,
  "error": "Grant not found for email: user@testcompany.com"
}
```

### Verification

- Status code: `200 OK` (even if not found)
- grantId matches expected format
- Email matches request parameter
- Provider is one of: "google", "outlook", "icloud"

### Test Variables

```bash
# Test with existing grant
EMAIL="user@testcompany.com"

# Test with non-existent grant
EMAIL="nonexistent@testcompany.com"
```

---

## Test 3: List Calendar Events

Retrieve calendar events for a user via their grant ID.

### Request

```bash
GRANT_ID="user-grant-456789"
START_TIME="2025-01-16T00:00:00Z"
END_TIME="2025-01-17T23:59:59Z"

curl -X GET \
  "https://sb-api-services-v3-53926697384.us-central1.run.app/api/v1/nylas/calendar/events?grantId=${GRANT_ID}&start=${START_TIME}&end=${END_TIME}&limit=10" \
  -H "Content-Type: application/json"
```

### Expected Response

```json
{
  "success": true,
  "events": [
    {
      "id": "event-abc123",
      "calendarId": "primary",
      "title": "Team Meeting",
      "description": "Weekly sync",
      "startTime": "2025-01-16T14:00:00Z",
      "endTime": "2025-01-16T15:00:00Z",
      "busy": true,
      "participants": [
        {
          "email": "user@testcompany.com",
          "status": "accepted"
        }
      ],
      "status": "confirmed",
      "created": "2025-01-10T10:00:00Z",
      "updated": "2025-01-10T10:00:00Z"
    }
  ],
  "count": 1
}
```

### Verification

- Status code: `200 OK`
- Events array returned
- Each event has required fields: id, title, startTime, endTime
- Times are within requested range

### Error Cases

**Invalid Grant ID:**
```bash
curl -X GET \
  "https://sb-api-services-v3-53926697384.us-central1.run.app/api/v1/nylas/calendar/events?grantId=invalid-grant&start=${START_TIME}&end=${END_TIME}" \
  -H "Content-Type: application/json"
```

Expected:
```json
{
  "success": false,
  "error": "Invalid or expired grant ID"
}
```

---

## Test 4: Create Calendar Event

Create a new calendar event via V3 service.

### Request

```bash
GRANT_ID="user-grant-456789"

curl -X POST \
  https://sb-api-services-v3-53926697384.us-central1.run.app/api/v1/nylas/calendar/events \
  -H "Content-Type: application/json" \
  -d '{
    "grantId": "'${GRANT_ID}'",
    "calendarId": "primary",
    "title": "V3 Integration Test Event",
    "description": "Testing calendar event creation via V3",
    "startTime": "2025-01-17T10:00:00Z",
    "endTime": "2025-01-17T10:30:00Z",
    "participants": [
      {
        "email": "admin@testcompany.com"
      }
    ],
    "location": "Conference Room A"
  }'
```

### Expected Response

```json
{
  "success": true,
  "event": {
    "id": "event-xyz789",
    "calendarId": "primary",
    "title": "V3 Integration Test Event",
    "description": "Testing calendar event creation via V3",
    "startTime": "2025-01-17T10:00:00Z",
    "endTime": "2025-01-17T10:30:00Z",
    "participants": [
      {
        "email": "admin@testcompany.com",
        "status": "pending"
      }
    ],
    "location": "Conference Room A",
    "status": "confirmed",
    "created": "2025-01-16T10:00:00Z"
  }
}
```

### Verification

- Status code: `201 Created`
- Event ID returned
- All fields match request
- Participants have "pending" status
- Event appears in user's Google Calendar

### Cleanup

```bash
# Delete the test event
EVENT_ID="event-xyz789"
curl -X DELETE \
  "https://sb-api-services-v3-53926697384.us-central1.run.app/api/v1/nylas/calendar/events/${EVENT_ID}?grantId=${GRANT_ID}" \
  -H "Content-Type: application/json"
```

---

## Test 5: Update Calendar Event

Update an existing calendar event.

### Request

```bash
GRANT_ID="user-grant-456789"
EVENT_ID="event-xyz789"

curl -X PUT \
  https://sb-api-services-v3-53926697384.us-central1.run.app/api/v1/nylas/calendar/events/${EVENT_ID} \
  -H "Content-Type: application/json" \
  -d '{
    "grantId": "'${GRANT_ID}'",
    "title": "Updated Test Event",
    "startTime": "2025-01-17T11:00:00Z",
    "endTime": "2025-01-17T11:30:00Z"
  }'
```

### Expected Response

```json
{
  "success": true,
  "event": {
    "id": "event-xyz789",
    "title": "Updated Test Event",
    "startTime": "2025-01-17T11:00:00Z",
    "endTime": "2025-01-17T11:30:00Z",
    "updated": "2025-01-16T10:05:00Z"
  }
}
```

### Verification

- Status code: `200 OK`
- Updated timestamp changes
- Title and times updated
- Other fields preserved

---

## Test 6: Get Email Messages

Retrieve emails from user's inbox.

### Request

```bash
GRANT_ID="user-grant-456789"

curl -X GET \
  "https://sb-api-services-v3-53926697384.us-central1.run.app/api/v1/nylas/email/messages?grantId=${GRANT_ID}&limit=5" \
  -H "Content-Type: application/json"
```

### Expected Response

```json
{
  "success": true,
  "messages": [
    {
      "id": "msg-001",
      "threadId": "thread-abc",
      "subject": "Test Email",
      "from": {
        "name": "Sender Name",
        "email": "sender@example.com"
      },
      "to": [
        {
          "email": "user@testcompany.com"
        }
      ],
      "date": "2025-01-16T09:00:00Z",
      "snippet": "This is a preview of the email content...",
      "unread": false,
      "folders": ["INBOX"]
    }
  ],
  "count": 5
}
```

### Verification

- Status code: `200 OK`
- Messages array returned (up to limit)
- Each message has: id, subject, from, to, date
- Messages are from correct user's inbox

---

## Test 7: Send Email

Send an email via V3 service.

### Request

```bash
GRANT_ID="user-grant-456789"

curl -X POST \
  https://sb-api-services-v3-53926697384.us-central1.run.app/api/v1/nylas/email/send \
  -H "Content-Type: application/json" \
  -d '{
    "grantId": "'${GRANT_ID}'",
    "to": [
      {
        "email": "test@example.com"
      }
    ],
    "subject": "V3 Integration Test Email",
    "body": "This is a test email sent via V3 microservice.",
    "replyTo": {
      "email": "user@testcompany.com"
    }
  }'
```

### Expected Response

```json
{
  "success": true,
  "message": {
    "id": "msg-sent-123",
    "threadId": "thread-xyz",
    "date": "2025-01-16T10:10:00Z"
  }
}
```

### Verification

- Status code: `200 OK`
- Message ID returned
- Email appears in Sent folder
- Recipient receives email

---

## Test 8: Get Single Email by ID

Retrieve a specific email message.

### Request

```bash
GRANT_ID="user-grant-456789"
MESSAGE_ID="msg-001"

curl -X GET \
  "https://sb-api-services-v3-53926697384.us-central1.run.app/api/v1/nylas/email/messages/${MESSAGE_ID}?grantId=${GRANT_ID}" \
  -H "Content-Type: application/json"
```

### Expected Response

```json
{
  "success": true,
  "message": {
    "id": "msg-001",
    "subject": "Test Email",
    "from": {
      "email": "sender@example.com"
    },
    "to": [
      {
        "email": "user@testcompany.com"
      }
    ],
    "body": "Full email body content here...",
    "date": "2025-01-16T09:00:00Z",
    "attachments": []
  }
}
```

### Verification

- Status code: `200 OK`
- Full message details returned
- Body content included
- Attachments array present

---

## Test 9: Get Contacts

Retrieve user's contact list.

### Request

```bash
GRANT_ID="user-grant-456789"

curl -X GET \
  "https://sb-api-services-v3-53926697384.us-central1.run.app/api/v1/nylas/contacts?grantId=${GRANT_ID}&limit=10" \
  -H "Content-Type: application/json"
```

### Expected Response

```json
{
  "success": true,
  "contacts": [
    {
      "id": "contact-001",
      "givenName": "John",
      "surname": "Doe",
      "emails": [
        {
          "email": "john.doe@example.com",
          "type": "work"
        }
      ],
      "phoneNumbers": [
        {
          "number": "+1-555-1234",
          "type": "mobile"
        }
      ],
      "companyName": "Example Corp"
    }
  ],
  "count": 10
}
```

### Verification

- Status code: `200 OK`
- Contacts array returned
- Each contact has: id, givenName or surname, emails
- Contacts from correct user's address book

---

## Test 10: OAuth Invitation Flow

Test the complete OAuth invitation flow via V3.

### Step 1: Generate Invitation URL

```bash
# Invitation created in V2 database
INVITE_TOKEN="secure-token-abc123def456"

# OAuth URL format
OAUTH_URL="https://sb-api-services-v3-53926697384.us-central1.run.app/oauth/nylas?token=${INVITE_TOKEN}"

echo "OAuth URL: ${OAUTH_URL}"
```

### Step 2: Simulate User Click (Browser)

Open the URL in a browser or use curl to check redirect:

```bash
curl -L \
  "${OAUTH_URL}" \
  -v
```

### Expected Behavior

1. Redirects to Google OAuth consent screen
2. User authorizes email, calendar, contacts access
3. Google redirects back to V3 callback URL
4. V3 exchanges code for grant
5. V3 calls V2's `/api/nylas/link-grant` endpoint
6. V2 creates NylasGrant and links to user
7. V2 marks invitation as "accepted"
8. User sees success page

### Verification

**Check Invitation Status:**
```bash
# In V2 database
db.invites.findOne({ inviteToken: "secure-token-abc123def456" })
```

Expected:
```json
{
  "status": "accepted",
  "acceptedAt": "2025-01-16T10:15:00Z"
}
```

**Check Grant Created:**
```bash
# In V2 database
db.nylasgrants.findOne({ email: "newuser@testcompany.com" })
```

Expected:
```json
{
  "grantId": "grant-from-v3-xyz",
  "email": "newuser@testcompany.com",
  "provider": "google",
  "status": "active"
}
```

---

## Integration Test Script

Automated bash script to test all V3 endpoints:

```bash
#!/bin/bash

# V3 Integration Test Script

BASE_URL="https://sb-api-services-v3-53926697384.us-central1.run.app"
GRANT_ID="your-test-grant-id"

echo "=== V3 Integration Test Suite ==="

# Test 1: Health Check
echo -e "\n[1/10] Health Check..."
curl -s "${BASE_URL}/health" | jq

# Test 2: Grant Resolution
echo -e "\n[2/10] Grant Resolution..."
curl -s "${BASE_URL}/api/v1/nylas/grants/by-email?email=user@testcompany.com" | jq

# Test 3: List Calendar Events
echo -e "\n[3/10] List Calendar Events..."
START=$(date -u +"%Y-%m-%dT00:00:00Z")
END=$(date -u -d "+1 day" +"%Y-%m-%dT23:59:59Z")
curl -s "${BASE_URL}/api/v1/nylas/calendar/events?grantId=${GRANT_ID}&start=${START}&end=${END}" | jq

# Test 4: Create Calendar Event
echo -e "\n[4/10] Create Calendar Event..."
EVENT_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/v1/nylas/calendar/events" \
  -H "Content-Type: application/json" \
  -d "{
    \"grantId\": \"${GRANT_ID}\",
    \"calendarId\": \"primary\",
    \"title\": \"Test Event\",
    \"startTime\": \"$(date -u -d "+2 hours" +"%Y-%m-%dT%H:00:00Z")\",
    \"endTime\": \"$(date -u -d "+3 hours" +"%Y-%m-%dT%H:00:00Z")\"
  }")
echo "$EVENT_RESPONSE" | jq
EVENT_ID=$(echo "$EVENT_RESPONSE" | jq -r '.event.id')

# Test 5: Get Single Event
echo -e "\n[5/10] Get Single Event..."
curl -s "${BASE_URL}/api/v1/nylas/calendar/events/${EVENT_ID}?grantId=${GRANT_ID}" | jq

# Test 6: Update Event
echo -e "\n[6/10] Update Event..."
curl -s -X PUT "${BASE_URL}/api/v1/nylas/calendar/events/${EVENT_ID}" \
  -H "Content-Type: application/json" \
  -d "{
    \"grantId\": \"${GRANT_ID}\",
    \"title\": \"Updated Test Event\"
  }" | jq

# Test 7: List Emails
echo -e "\n[7/10] List Emails..."
curl -s "${BASE_URL}/api/v1/nylas/email/messages?grantId=${GRANT_ID}&limit=5" | jq

# Test 8: Get Contacts
echo -e "\n[8/10] Get Contacts..."
curl -s "${BASE_URL}/api/v1/nylas/contacts?grantId=${GRANT_ID}&limit=5" | jq

# Test 9: Delete Event
echo -e "\n[9/10] Delete Event..."
curl -s -X DELETE "${BASE_URL}/api/v1/nylas/calendar/events/${EVENT_ID}?grantId=${GRANT_ID}" | jq

# Test 10: Invalid Grant
echo -e "\n[10/10] Error Handling (Invalid Grant)..."
curl -s "${BASE_URL}/api/v1/nylas/calendar/events?grantId=invalid-grant-id" | jq

echo -e "\n=== Test Suite Complete ==="
```

### Run the Script

```bash
chmod +x v3-integration-test.sh
./v3-integration-test.sh
```

---

## Error Codes Reference

| Status Code | Meaning | Example |
|-------------|---------|---------|
| 200 | Success | Operation completed |
| 201 | Created | Event/Contact created |
| 400 | Bad Request | Invalid parameters |
| 401 | Unauthorized | Invalid grant ID |
| 403 | Forbidden | Grant expired/revoked |
| 404 | Not Found | Event/Message not found |
| 500 | Server Error | V3 internal error |
| 502 | Bad Gateway | Nylas API unavailable |

---

## Troubleshooting

### Issue: "Grant not found"

**Cause**: Grant ID is invalid or expired

**Solution**:
1. Verify grant exists in database
2. Check grant status (should be "active")
3. Ensure grant hasn't expired
4. Re-invite user if needed

### Issue: "Connection timeout"

**Cause**: V3 service unavailable

**Solution**:
1. Check V3 service status: `curl ${BASE_URL}/health`
2. Verify network connectivity
3. Check GCP Cloud Run logs
4. Ensure service isn't cold-starting

### Issue: "Invalid time format"

**Cause**: Incorrect ISO 8601 format

**Solution**:
Use proper format: `2025-01-17T10:00:00Z` (UTC timezone required)

---

## Monitoring V3 Service

### Check GCP Logs

```bash
gcloud logging read \
  "resource.type=cloud_run_revision AND resource.labels.service_name=sb-api-services-v3" \
  --limit 50 \
  --format json
```

### Filter by Grant ID

```bash
gcloud logging read \
  "resource.type=cloud_run_revision AND textPayload:\"user-grant-456789\"" \
  --limit 20
```

### Check Error Rates

```bash
gcloud logging read \
  "resource.type=cloud_run_revision AND severity>=ERROR" \
  --limit 10
```

---

## Success Criteria

✅ Health check returns "healthy"
✅ Grant resolution works for valid emails
✅ Calendar events can be created/updated/deleted
✅ Emails can be retrieved and sent
✅ Contacts can be accessed
✅ OAuth flow completes successfully
✅ Error handling is appropriate
✅ Response times < 2 seconds

---

**V3 Integration Ready for Production!** 🚀
