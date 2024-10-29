# Integration API Documentation

Base URL: http://localhost:3000

All endpoints require authentication via Bearer token in the Authorization header:
```
Authorization: Bearer <your_token>
```

## Endpoints

### 1. Discover All Integrations
GET `/integrations/discover`

Retrieves all available integration actions.

**Response**
```json
{
  // Array of integration actions
  [
    {
      "id": "string",
      "name": "string",
      "description": "string",
      "parameters": {},
      // Additional integration properties
    }
  ]
}
```

**Error Responses**
- `500` - Failed to discover integrations
```json
{
  "error": "Failed to discover integrations"
}
```

### 2. Discover Specific Action
GET `/integrations/discover/action/:actionId`

Retrieves details for a specific integration action.

**Parameters**
- `actionId` (path parameter) - The ID of the action to retrieve

**Response**
```json
{
  "id": "string",
  "name": "string",
  "description": "string",
  "parameters": {},
  // Additional action properties
}
```

**Error Responses**
- `404` - Action not found
```json
{
  "error": "Action not found"
}
```
- `500` - Server error
```json
{
  "error": "Failed to discover action"
}
```

### 3. Discover Lean Actions
GET `/integrations/discover/lean`

Retrieves a lightweight version of all integration actions.

**Query Parameters**
- `fields` (optional) - Comma-separated list of fields to include in the response

**Response**
```json
{
  // Array of lean integration actions with requested fields
  [
    {
      // Only requested fields included
    }
  ]
}
```

**Error Responses**
- `500` - Server error
```json
{
  "error": "Failed to discover lean actions"
}
```

### 4. Get Integration by ID
GET `/integrations/:integrationId`

Retrieves details for a specific integration.

**Parameters**
- `integrationId` (path parameter) - The ID of the integration to retrieve

**Response**
```json
{
  "id": "string",
  "name": "string",
  // Additional integration properties
}
```

**Error Responses**
- `404` - Integration not found
```json
{
  "error": "Integration not found"
}
```
- `500` - Server error
```json
{
  "error": "Failed to get integration"
}
```

### 5. Trigger Integration Action
POST `/integrations/actions/:integrationName/:actionName`

Executes a specific action for an integration.

**Parameters**
- `integrationName` (path parameter) - Name of the integration
- `actionName` (path parameter) - Name of the action to execute

**Request Body**
```json
{
  "data": {
    // Action-specific parameters
  }
}
```

**Response**
```json
{
  // Action-specific response data
}
```

**Error Responses**
- `400` - Missing required parameters
```json
{
  "error": "Integration name and action name are required"
}
```
- `401` - Authentication error
```json
{
  "error": "Unauthorized: User ID is required"
}
```
- `500` - Server error
```json
{
  "error": "Error message details"
}
```

## Example Usage with cURL

1. Discover all integrations:
```bash
curl -X GET 'http://localhost:3000/integrations/discover' \
-H 'Authorization: Bearer YOUR_ACCESS_TOKEN'
```

2. Discover specific action:
```bash
curl -X GET 'http://localhost:3000/integrations/discover/action/ACTION_ID' \
-H 'Authorization: Bearer YOUR_ACCESS_TOKEN'
```

3. Get lean actions:
```bash
curl -X GET 'http://localhost:3000/integrations/discover/lean?fields=id,name,actions' \
-H 'Authorization: Bearer YOUR_ACCESS_TOKEN'
```

4. Get integration by ID:
```bash
curl -X GET 'http://localhost:3000/integrations/INTEGRATION_ID' \
-H 'Authorization: Bearer YOUR_ACCESS_TOKEN'
```

5. Trigger an action:
```bash
curl -X POST 'http://localhost:3000/integrations/actions/INTEGRATION_NAME/ACTION_NAME' \
-H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \
-H 'Content-Type: application/json' \
-d '{
  "data": {
    "param1": "value1",
    "param2": "value2"
  }
}'
```

## Notes
- All endpoints require authentication
- Language support is handled automatically based on user session
- Company and user context is required for all operations
- OpenAI API key must be configured for the company when using action triggers
