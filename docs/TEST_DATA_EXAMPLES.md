# Nylas Grant Management - Test Data Examples

This document provides sample test data for testing the Nylas grant management integration.

## Database Collections

### Companies Collection

```json
{
  "_id": "company-test-001",
  "name": "Test Company",
  "apiKeys": {
    "nylas_grant_id": "company-default-grant-abc123"
  },
  "createdAt": "2025-01-01T00:00:00Z",
  "updatedAt": "2025-01-01T00:00:00Z"
}
```

### Users Collection

#### Admin User with Grant

```json
{
  "_id": "user-admin-001",
  "email": "admin@testcompany.com",
  "name": "Admin User",
  "role": "Admin",
  "companyId": "company-test-001",
  "nylasGrant": {
    "grantId": "admin-grant-123456",
    "email": "admin@testcompany.com",
    "provider": "google",
    "status": "active",
    "scopes": ["email", "calendar", "contacts"],
    "createdAt": "2025-01-01T00:00:00Z",
    "expiresAt": null
  },
  "createdAt": "2025-01-01T00:00:00Z",
  "updatedAt": "2025-01-10T00:00:00Z"
}
```

#### Regular User with Grant

```json
{
  "_id": "user-regular-001",
  "email": "user@testcompany.com",
  "name": "Regular User",
  "role": "CompanyUser",
  "companyId": "company-test-001",
  "nylasGrant": {
    "grantId": "user-grant-456789",
    "email": "user@testcompany.com",
    "provider": "outlook",
    "status": "active",
    "scopes": ["email", "calendar"],
    "createdAt": "2025-01-02T00:00:00Z",
    "expiresAt": "2025-12-31T23:59:59Z"
  },
  "createdAt": "2025-01-02T00:00:00Z",
  "updatedAt": "2025-01-05T00:00:00Z"
}
```

#### User Without Grant

```json
{
  "_id": "user-noauth-001",
  "email": "noauth@testcompany.com",
  "name": "User Without Auth",
  "role": "CompanyUser",
  "companyId": "company-test-001",
  "nylasGrant": null,
  "createdAt": "2025-01-03T00:00:00Z",
  "updatedAt": "2025-01-03T00:00:00Z"
}
```

### NylasGrant Collection (New Per-User Grant Model)

```json
[
  {
    "_id": "grant-doc-001",
    "userId": "user-admin-001",
    "companyId": "company-test-001",
    "grantId": "admin-grant-123456",
    "email": "admin@testcompany.com",
    "provider": "google",
    "scopes": ["email", "calendar", "contacts"],
    "status": "active",
    "expiresAt": null,
    "createdAt": "2025-01-01T00:00:00Z",
    "updatedAt": "2025-01-01T00:00:00Z"
  },
  {
    "_id": "grant-doc-002",
    "userId": "user-regular-001",
    "companyId": "company-test-001",
    "grantId": "user-grant-456789",
    "email": "user@testcompany.com",
    "provider": "outlook",
    "scopes": ["email", "calendar"],
    "status": "active",
    "expiresAt": "2025-12-31T23:59:59Z",
    "createdAt": "2025-01-02T00:00:00Z",
    "updatedAt": "2025-01-02T00:00:00Z"
  }
]
```

### Invitations Collection

#### Pending Invitation

```json
{
  "_id": "invite-001",
  "email": "newuser@testcompany.com",
  "companyId": "company-test-001",
  "invitedBy": "user-admin-001",
  "inviteToken": "secure-token-abc123def456",
  "status": "pending",
  "expiresAt": "2025-01-20T00:00:00Z",
  "role": "CompanyUser",
  "metadata": {
    "source": "ai_assistant",
    "ip": "192.168.1.100",
    "userAgent": "Mozilla/5.0..."
  },
  "createdAt": "2025-01-13T00:00:00Z",
  "updatedAt": "2025-01-13T00:00:00Z"
}
```

#### Accepted Invitation

```json
{
  "_id": "invite-002",
  "email": "accepted@testcompany.com",
  "companyId": "company-test-001",
  "invitedBy": "user-admin-001",
  "inviteToken": "secure-token-xyz789abc321",
  "status": "accepted",
  "expiresAt": "2025-01-25T00:00:00Z",
  "acceptedAt": "2025-01-14T10:30:00Z",
  "role": "CompanyUser",
  "metadata": {
    "source": "ai_assistant"
  },
  "createdAt": "2025-01-10T00:00:00Z",
  "updatedAt": "2025-01-14T10:30:00Z"
}
```

## API Response Examples

### Grant Status Check Response (User Has Grant)

```json
{
  "success": true,
  "hasGrant": true,
  "grant": {
    "email": "user@testcompany.com",
    "provider": "google",
    "status": "active",
    "createdAt": "2025-01-02T00:00:00Z",
    "expiresAt": null
  }
}
```

### Grant Status Check Response (No Grant)

```json
{
  "success": true,
  "hasGrant": false,
  "grant": null
}
```

### List Company Grants Response

```json
{
  "success": true,
  "count": 2,
  "users": [
    {
      "userId": "user-admin-001",
      "name": "Admin User",
      "email": "admin@testcompany.com",
      "grant": {
        "email": "admin@testcompany.com",
        "provider": "google",
        "status": "active"
      }
    },
    {
      "userId": "user-regular-001",
      "name": "Regular User",
      "email": "user@testcompany.com",
      "grant": {
        "email": "user@testcompany.com",
        "provider": "outlook",
        "status": "active"
      }
    }
  ]
}
```

### Send Invitation Response

```json
{
  "success": true,
  "invitation": {
    "email": "newuser@testcompany.com",
    "expiresAt": "2025-01-23T00:00:00Z",
    "oauthUrl": "https://sb-api-services-v3-53926697384.us-central1.run.app/oauth/nylas?token=secure-token-abc123def456"
  },
  "message": "Invitation sent successfully to newuser@testcompany.com. The invitation expires in 7 days."
}
```

### Revoke Grant Response

```json
{
  "success": true,
  "revoked": true
}
```

## V3 Microservice Response Examples

### Grant Lookup by Email

**Request:**
```http
GET https://sb-api-services-v3-53926697384.us-central1.run.app/api/v1/nylas/grants/by-email?email=user@testcompany.com
```

**Response:**
```json
{
  "success": true,
  "grantId": "user-grant-456789",
  "email": "user@testcompany.com",
  "provider": "outlook",
  "scopes": ["email", "calendar"]
}
```

### Create Calendar Event via V3

**Request:**
```http
POST https://sb-api-services-v3-53926697384.us-central1.run.app/api/v1/nylas/calendar/events
Content-Type: application/json

{
  "grantId": "user-grant-456789",
  "calendarId": "primary",
  "title": "Team Standup",
  "startTime": "2025-01-17T10:00:00Z",
  "endTime": "2025-01-17T10:30:00Z",
  "participants": ["admin@testcompany.com"]
}
```

**Response:**
```json
{
  "success": true,
  "event": {
    "id": "event-abc123",
    "title": "Team Standup",
    "startTime": "2025-01-17T10:00:00Z",
    "endTime": "2025-01-17T10:30:00Z",
    "participants": [
      {
        "email": "admin@testcompany.com",
        "status": "pending"
      }
    ],
    "calendarId": "primary"
  }
}
```

## AI Action Parameter Examples

### Check Grant Status (Own Grant)

```json
{
  "userEmail": null
}
```

### Check Grant Status (Other User - Admin Only)

```json
{
  "userEmail": "user@testcompany.com"
}
```

### List Company Grants (Admin Only)

```json
{}
```

### Send Invitation (Admin Only)

```json
{
  "email": "newuser@testcompany.com",
  "firstName": "New",
  "lastName": "User"
}
```

### Revoke Grant (Admin Only)

```json
{
  "userEmail": "user@testcompany.com"
}
```

### Create Calendar Event (Admin Creates in Team Member's Calendar)

```json
{
  "title": "Daily Standup",
  "userEmail": "user@testcompany.com",
  "startTime": "2025-01-17T09:00:00Z",
  "endTime": "2025-01-17T09:15:00Z",
  "description": "Daily team sync"
}
```

## Environment Variables for Testing

```env
# MongoDB
MONGODB_URI=mongodb://localhost:27017/singularitybridge_dev

# V3 Microservice
NYLAS_V3_SERVICE_URL=https://sb-api-services-v3-53926697384.us-central1.run.app

# SendGrid for Invitations
SENDGRID_API_KEY=your_sendgrid_key_here
SENDGRID_FROM_EMAIL=noreply@testcompany.com

# Application
NODE_ENV=development
PORT=8080
```

## Quick Test Setup Script

```bash
# 1. Ensure MongoDB is running
mongosh singularitybridge_dev

# 2. Insert test company
db.companies.insertOne({
  _id: ObjectId(),
  name: "Test Company",
  apiKeys: { nylas_grant_id: "company-default-grant-abc123" },
  createdAt: new Date(),
  updatedAt: new Date()
});

# 3. Insert admin user
db.users.insertOne({
  _id: ObjectId("user-admin-001"),
  email: "admin@testcompany.com",
  name: "Admin User",
  role: "Admin",
  companyId: ObjectId("company-test-001"),
  createdAt: new Date(),
  updatedAt: new Date()
});

# 4. Create NylasGrant for admin
db.nylasgrants.insertOne({
  userId: ObjectId("user-admin-001"),
  companyId: ObjectId("company-test-001"),
  grantId: "admin-grant-123456",
  email: "admin@testcompany.com",
  provider: "google",
  scopes: ["email", "calendar", "contacts"],
  status: "active",
  createdAt: new Date(),
  updatedAt: new Date()
});
```

---

**Note:** Replace placeholder IDs and tokens with actual values from your test environment. Grant IDs must be valid Nylas grant IDs from the V3 microservice for email/calendar operations to work.
