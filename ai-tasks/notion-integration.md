Below is a comprehensive guide for adding a Notion integration using Node.js. This guide adapts our standard integration process to work specifically with Notion’s API. It covers setting up the file structure, creating the service and action files, managing API keys, handling errors, and testing. You can share this guide with your development team.

---

# Guide: Adding a Notion Integration with Node.js

This guide explains how to integrate Notion into your Node.js project. It follows a modular design approach for consistency and reliability. We use Notion’s official API client for Node.js ([@notionhq/client](https://www.notion.so/my-integrations)) and adhere to our system’s integration standards.

---

## 1. Introduction

The goal is to create an integration that communicates with Notion via its API. You will set up a dedicated directory, implement core service functions, and expose actions that the broader system can invoke. This integration uses TypeScript for type safety and clear structure.

---

## 2. File Structure

Create a new directory under `src/integrations/` named `notion_integration` (using **snake_case**). Your directory should look like this:

```
src/integrations/
└── notion_integration/
    ├── notion_integration.service.ts
    ├── notion_integration.actions.ts
    ├── integration.config.json
    └── translations/
        ├── en.json
        └── he.json
```

---

## 3. Creating Integration Files

### 3.1. Service File (`notion_integration.service.ts`)

This file contains the core logic for interacting with Notion. It initializes the Notion client using an API key and defines reusable functions to perform operations (e.g., querying databases or creating pages).

**Example:**

```typescript
// src/integrations/notion_integration/notion_integration.service.ts

import { Client } from '@notionhq/client';

const notion = new Client({
  auth: process.env.NOTION_API_KEY, // Ensure your API key is set securely
});

export const fetchDatabaseItems = async (
  databaseId: string
): Promise<{ success: boolean; data?: any }> => {
  if (!databaseId) {
    throw new Error('Database ID is required.');
  }
  
  try {
    const response = await notion.databases.query({ database_id: databaseId });
    return { success: true, data: response.results };
  } catch (error) {
    // Propagate error for consistent handling in actions
    throw new Error(`Notion API error: ${error.message}`);
  }
};
```

### 3.2. Actions File (`notion_integration.actions.ts`)

This file exposes functions for the system to call. It wraps your service functions and defines parameters and error propagation. All errors are thrown so that the executor can handle them uniformly.

**Example:**

```typescript
// src/integrations/notion_integration/notion_integration.actions.ts

import { ActionContext, FunctionFactory } from '../actions/types';
import { fetchDatabaseItems } from './notion_integration.service';

export const createNotionIntegrationActions = (context: ActionContext): FunctionFactory => ({
  getDatabaseItems: {
    description: 'Retrieves items from a specified Notion database.',
    parameters: {
      type: 'object',
      properties: {
        databaseId: { type: 'string', description: 'The ID of the Notion database' },
      },
      required: ['databaseId'],
      additionalProperties: false,
    },
    function: async (params: { databaseId: string }) => {
      // Validate input is done by JSON schema; additional checks can be added here.
      return await fetchDatabaseItems(params.databaseId);
    },
  },
});
```

### 3.3. Configuration File (`integration.config.json`)

This file registers metadata about your Notion integration so the system can load and configure it correctly.

**Example:**

```json
{
  "name": "notion_integration",
  "icon": "notion-icon",
  "apiKeyName": "NOTION_API_KEY",
  "actionCreator": "createNotionIntegrationActions",
  "actionsFile": "notion_integration.actions.ts"
}
```

### 3.4. Translation Files (`translations/en.json` and `translations/he.json`)

Provide user-facing strings for both English and Hebrew. These translations can be used in the UI to describe the integration’s actions.

**Example for `en.json`:**

```json
{
  "serviceName": "Notion Integration",
  "getDatabaseItems": {
    "actionTitle": "Get Database Items",
    "description": "Fetches items from a specified Notion database."
  }
}
```

---

## 4. Important Guidelines

### 4.1. Error Handling

- **Exceptions for Errors:** Always throw exceptions on errors (e.g., missing parameters or API failures).
- **Consistent Handling:** The executor will catch these exceptions and publish standardized error statuses.

### 4.2. Naming Conventions

- **Integration Names:** Use **snake_case** (e.g., `notion_integration`).
- **Action Names:** Use **camelCase** (e.g., `getDatabaseItems`).
- **Function Names:** Combine integration and action names for clarity (e.g., `notion_integration_getDatabaseItems`).

### 4.3. Modular Design

- **Separation of Concerns:** Keep API logic in the service file and wrap this logic in action definitions.

### 4.4. Type Safety

- Use TypeScript interfaces or types to clearly define input and output structures.

---

## 5. Integration with the Existing System

### 5.1. Action Registration

- **Consistent IDs:** Register your actions with IDs formatted as `integrationName.actionName` (e.g., `notion_integration.getDatabaseItems`).
- **Session Context:** Use the `ActionContext` to access `sessionId` and `companyId` if needed for logging or additional security.

### 5.2. API Key Management

- **Secure Storage:** Retrieve your Notion API key via environment variables (e.g., `process.env.NOTION_API_KEY`).
- **Error on Missing API Key:** Throw an error if the API key is absent.

---

## 6. Testing and Debugging

### 6.1. Comprehensive Testing

- **Unit Tests:** Write tests for each service function to simulate API responses (both successes and failures).
- **Integration Tests:** Test the complete flow from action invocation to API response, ensuring proper error propagation.

### 6.2. Logging

- **Debugging:** Use logging (e.g., `console.log()`) during development, but ensure sensitive information (like API keys) is never logged in production.
- **Clean Up:** Remove or adjust logs before deployment.

---

## 7. Best Practices for Integration Development

### 7.1. Uniform Error Handling

- Always throw exceptions within action functions.
- Do not include error fields in the action return objects.

### 7.2. Input Validation

- Validate all required parameters at the start of your functions.
- Leverage JSON schema validations defined in the actions file.

### 7.3. Code Consistency

- Follow naming conventions and structure as outlined to improve readability and maintainability.

---

## 8. Example Integration Setup

### 8.1. Integration Directory Structure

```
src/integrations/
└── notion_integration/
    ├── notion_integration.service.ts
    ├── notion_integration.actions.ts
    ├── integration.config.json
    └── translations/
        ├── en.json
        └── he.json
```

### 8.2. Sample Action Function

The example below shows a complete action that validates the input and calls the service function to retrieve database items:

```typescript
// src/integrations/notion_integration/notion_integration.actions.ts

import { ActionContext, FunctionFactory } from '../actions/types';
import { fetchDatabaseItems } from './notion_integration.service';

export const createNotionIntegrationActions = (context: ActionContext): FunctionFactory => ({
  getDatabaseItems: {
    description: 'Fetches items from a specified Notion database.',
    parameters: {
      type: 'object',
      properties: {
        databaseId: { type: 'string', description: 'The ID of the Notion database' }
      },
      required: ['databaseId'],
      additionalProperties: false,
    },
    function: async (params: { databaseId: string }) => {
      if (!params.databaseId) {
        throw new Error('databaseId is required.');
      }
      const result = await fetchDatabaseItems(params.databaseId);
      return result;
    },
  },
});
```

---

## 9. Integrating External Services (Notion API)

### 9.1. API Errors and Retry Logic

- **HTTP Error Handling:** For non-2xx HTTP responses from Notion, throw an error.
- **Retry Mechanism:** Consider implementing exponential backoff for transient network errors.

### 9.2. Security Considerations

- **API Key Protection:** Ensure your Notion API key is stored securely and is not exposed in logs.
- **Input Sanitization:** Always sanitize any user inputs before sending them to Notion’s API.

---

## 10. Updating the Executor

### 10.1. Consistent Error Handling

- The executor catches exceptions thrown by actions and publishes status messages (started, completed, failed) accordingly.
- Remove checks for error fields in result objects; rely on exceptions for error propagation.

---

## 11. Testing Your Integration

### 11.1. Simulate Error Scenarios

- **Invalid Inputs:** Test actions with missing or invalid parameters.
- **API Failures:** Simulate Notion API errors (e.g., unauthorized access, rate limits) and verify that errors propagate correctly.

### 11.2. Verify Executor Behavior

- Ensure that when an exception occurs, the action is marked as 'failed' and a descriptive error message is provided.

---

## Final Notes

- **Environment Setup:** Before running your integration, ensure that your environment has the `NOTION_API_KEY` variable set with your Notion integration token.
- **Dependencies:** Install the Notion client package with `npm install @notionhq/client`.

This guide should help your development team build a robust and consistent Notion integration within your Node.js project. For more details on the Notion API, refer to the [Notion API documentation](https://developers.notion.com/).