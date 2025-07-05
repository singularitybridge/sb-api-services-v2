# API Keys Feature - UI Implementation Guide

## Overview
We've implemented API key support in the backend that allows users to create long-lived API keys (1 year TTL by default) as an alternative to JWT tokens. API keys can be used for programmatic access to the API.

## API Endpoints

### 1. Create API Key
**Endpoint:** `POST /api/keys`  
**Authentication:** Bearer token (JWT or API key)  
**Request Body:**
```json
{
  "name": "Production API Key",        // Required: Display name for the key
  "expiresInDays": 365,               // Optional: Days until expiration (default: 365)
  "permissions": ["read", "write"]     // Optional: Future use for granular permissions
}
```

**Response:**
```json
{
  "message": "API key created successfully. Please save this key securely as it will not be shown again.",
  "apiKey": {
    "id": "68604d37576019799f3cb043",
    "name": "Production API Key",
    "key": "sk_live_f0a7390de92ea444bafe56b3c17ba9cbf42fc3f921dde305de8e7846ebae5bf5",
    "permissions": ["read", "write"],
    "expiresAt": "2026-06-28T20:14:47.742Z",
    "createdAt": "2025-06-28T20:14:47.743Z"
  }
}
```

**Important:** The `key` field is only returned during creation. It cannot be retrieved later.

### 2. List API Keys
**Endpoint:** `GET /api/keys`  
**Authentication:** Bearer token (JWT or API key)  
**Response:**
```json
{
  "apiKeys": [
    {
      "id": "68604d37576019799f3cb043",
      "name": "Production API Key",
      "permissions": ["read", "write"],
      "expiresAt": "2026-06-28T20:14:47.742Z",
      "createdAt": "2025-06-28T20:14:47.743Z"
    }
  ]
}
```

**Note:** The actual key value is never returned in list operations for security.

### 3. Revoke API Key
**Endpoint:** `DELETE /api/keys/:keyId`  
**Authentication:** Bearer token (JWT or API key)  
**Response:**
```json
{
  "message": "API key revoked successfully"
}
```

### 4. Verify API Key
**Endpoint:** `POST /auth/verify-token`  
**Authentication:** Bearer token (API key)  
**Response:**
```json
{
  "message": "API key is valid",
  "user": { /* user object */ },
  "company": { /* company object */ },
  "apiKeyName": "Production API Key",
  "expiresAt": "2026-06-28T20:14:47.742Z"
}
```

## Using API Keys

API keys use the same `Authorization: Bearer` format as JWT tokens:

```bash
curl -X GET 'http://localhost:3000/session' \
  -H 'Authorization: Bearer sk_live_f0a7390de92ea444bafe56b3c17ba9cbf42fc3f921dde305de8e7846ebae5bf5'
```

## UI Implementation Recommendations

### 1. API Keys Management Page
Create a dedicated page/section for API key management with:

- **List View**
  - Table showing: Name, Created Date, Expires Date, Last Used (if available)
  - Delete/Revoke button for each key
  - Visual indicator for expired or soon-to-expire keys

- **Create New Key**
  - Modal or form with:
    - Name field (required)
    - Expiration dropdown (7 days, 30 days, 90 days, 1 year, custom)
    - Permissions checkboxes (for future use)
  - After creation, display the key with:
    - Copy button
    - Warning that key won't be shown again
    - Instructions on how to use it

### 2. Security Considerations
- Show clear warning when creating keys that they provide full access
- Implement confirmation dialog before revoking keys
- Consider adding a "last used" indicator if implementing activity tracking
- Show expiration warnings for keys expiring soon

### 3. User Flow
1. User navigates to Settings → API Keys
2. Clicks "Create New API Key"
3. Fills in name and optional settings
4. Receives one-time display of the key
5. Can copy key to clipboard
6. Sees key added to their list (without the actual key value)

### 4. Example UI Components

**Key Creation Success:**
```
✅ API Key Created Successfully

Your API key has been created. Please copy it now as it won't be shown again:

sk_live_f0a7390de92ea444bafe56b3c17ba9cbf42fc3f921dde305de8e7846ebae5bf5

[Copy to Clipboard] [Download .txt] [Done]
```

**Key List Item:**
```
Name: Production API Key
Created: June 28, 2025
Expires: June 28, 2026
Last Used: 2 hours ago
[Revoke]
```

## Error Handling

Handle these error responses:
- `400` - Bad request (missing name)
- `401` - Unauthorized (invalid JWT/API key)
- `404` - API key not found (when revoking)
- `429` - Rate limit exceeded (for API key requests)

## Rate Limiting

API keys are rate-limited to 100 requests per minute by default. The following headers are included in responses:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining
- `X-RateLimit-Reset`: Time when limit resets

## Additional Notes

- API keys have the same permissions as the user who created them
- Keys are scoped to the user's company
- Revoked keys cannot be restored
- The backend automatically cleans up expired keys daily
- API keys use SHA-256 hashing for secure storage