# Guide: Adding a New Integration

## 1. Introduction

This guide explains how to add a new integration to the system, ensuring consistency, reliability, and ease of maintenance. The guide includes steps for creating the necessary files, ensuring consistent error handling, and integrating with the broader system.

---

## 2. File Structure

To add a new integration, create a new directory under `src/integrations/` with the name of your integration in **snake_case**. For example:

```
src/integrations/
└── your_integration/
    ├── your_integration.service.ts
    ├── your_integration.actions.ts
    ├── integration.config.json
    └── translations/
        ├── en.json
        └── he.json
```

---

## 3. Creating Integration Files

### 3.1. Service File (`your_integration.service.ts`)

The service file contains the core functionality of your integration. It includes reusable functions that execute your integration’s logic, independent of the action definitions.

**Example Structure:**

```typescript
// src/integrations/your_integration/your_integration.service.ts

export const yourIntegrationFunction = async (
  sessionId: string,
  companyId: string,
  params: any
): Promise<{ success: boolean; data?: any }> => {
  if (!params.requiredField) {
    throw new Error('The requiredField parameter is missing.');
  }

  // Implement core logic here
  const result = await performSomeOperation(params);

  return { success: true, data: result };
};
```

### 3.2. Actions File (`your_integration.actions.ts`)

The actions file defines the functions that the system can call, wrapping the logic from the service file.

**Important:** Let errors propagate by throwing exceptions. This allows the executor to handle errors consistently across all actions.

**Example Structure:**

```typescript
// src/integrations/your_integration/your_integration.actions.ts

import { ActionContext, FunctionFactory } from '../actions/types';
import { yourIntegrationFunction } from './your_integration.service';

export const createYourIntegrationActions = (context: ActionContext): FunctionFactory => ({
  yourAction: {
    description: 'Performs an action within Your Integration',
    parameters: {
      type: 'object',
      properties: {
        requiredField: { type: 'string', description: 'A required parameter for your action' },
      },
      required: ['requiredField'],
      additionalProperties: false,
    },
    function: async (params: any) => {
      return await yourIntegrationFunction(context.sessionId, context.companyId, params);
    },
  },
});
```

### 3.3. Configuration File (`integration.config.json`)

The configuration file provides metadata about your integration for the system to understand it properly.

**Example Content:**

```json
{
  "name": "your_integration",
  "icon": "icon-name",
  "apiKeyName": "YOUR_INTEGRATION_API_KEY",
  "actionCreator": "createYourIntegrationActions",
  "actionsFile": "your_integration.actions.ts"
}
```

### 3.4. Translation Files (`translations/en.json` and `translations/he.json`)

Provide user-facing strings in both English and Hebrew.

**Example Content for `en.json`:**

```json
{
  "serviceName": "Your Integration",
  "yourAction": {
    "actionTitle": "Perform Your Action",
    "description": "A description of what this action does."
  }
}
```

---

## 4. Important Guidelines

### 4.1. Error Handling

- **Use Exceptions for Errors:** Action functions should **throw exceptions** when errors occur.
- **Consistent Error Handling by Executor:** The executor will handle errors uniformly by catching exceptions and publishing 'failed' statuses.
  
### 4.2. Naming Conventions

- **Integration Names:** Use **snake_case** for integration names and **camelCase** for action names.
- **Function Names:** Use a consistent pattern for function names combining the integration and action names, e.g., `your_integration_yourAction`.

### 4.3. Modular Design

- **Separation of Concerns:** Keep core logic in the service file (`.service.ts`) and action definitions in the actions file (`.actions.ts`).

### 4.4. Type Safety

- Use TypeScript interfaces to define the parameter and return types for improved readability and safety.
  
---

## 5. Integration with Existing System

### 5.1. Action Registration and Allowed Actions

- Use consistent action IDs by converting function names to `integrationName.actionName`.
- Ensure that all actions are properly registered and allowed in the context where they're used.

### 5.2. Session Context

- **Session Awareness:** Use the `ActionContext` for accessing `sessionId` and `companyId` in action functions.

### 5.3. API Key Management

- Retrieve the integration's API key using the `getApiKey` function from the API key service.
- Handle cases where the API key is missing by **throwing an appropriate error**.

---

## 6. Testing and Debugging

### 6.1. Comprehensive Testing

- **Unit Tests:** Write unit tests for all service functions.
- **Integration Tests:** Ensure that your actions are tested end-to-end, including both successful and error scenarios.

### 6.2. Logging

- **Use Logs for Debugging:** Add `console.log()` during development for critical actions and parameters.
- **Clean Up Logs:** Ensure unnecessary logs are removed or adjusted for production to prevent leaking sensitive information.

### 6.3. Error Simulation

- Include test cases to simulate common error scenarios to verify proper exception handling.

---

## 7. Best Practices for Integration Development

### 7.1. Uniform Error Handling

- **Throw Exceptions:** Always throw exceptions within action functions for consistency.
- **No Error Fields in Results:** Remove the error fields from action return objects. Rely on exceptions to indicate failures.

### 7.2. Input Validation

- Validate required parameters at the beginning of your functions. Throw exceptions if validation fails.

### 7.3. Code Consistency

- **Consistent Naming and Structure:** Follow the naming conventions and structure outlined in this guide for all integrations to improve readability and maintainability.

---

## 8. Example Integration Setup

### 8.1. Integration Directory Structure

```
src/integrations/
└── your_integration/
    ├── your_integration.service.ts
    ├── your_integration.actions.ts
    ├── integration.config.json
    └── translations/
        ├── en.json
        └── he.json
```

### 8.2. Example of an Action Function

```typescript
// src/integrations/your_integration/your_integration.actions.ts

export const createYourIntegrationActions = (context: ActionContext): FunctionFactory => ({
  yourAction: {
    description: 'Performs an operation within Your Integration.',
    parameters: {
      type: 'object',
      properties: {
        parameter1: { type: 'string', description: 'Description of parameter1' },
      },
      required: ['parameter1'],
      additionalProperties: false,
    },
    function: async (params: { parameter1: string }) => {
      // Validate input
      if (!params.parameter1) {
        throw new Error('The parameter1 is required.');
      }

      // Call the service function
      const result = await yourIntegrationFunction(
        context.sessionId,
        context.companyId,
        params
      );

      // Return the result
      return result;
    },
  },
});
```

---

## 9. Integrating External Services

### 9.1. API Errors and Retry Logic

- **Handle HTTP Errors:** Throw exceptions for non-2xx HTTP responses.
- **Retry Mechanism:** Implement retry logic for transient errors (e.g., network issues) with exponential backoff.

### 9.2. Security Considerations

- **API Keys:** Retrieve and store API keys securely. **Do not log API keys** in any environment.
- **Input Sanitization:** Always sanitize inputs before sending them to external services.

---

## 10. Updating the Executor

### 10.1. Consistent Error Handling

- The executor will catch all exceptions thrown by action functions and handle them uniformly.
- Publish 'started', 'completed', or 'failed' status messages accordingly.

### 10.2. Removing Unnecessary Error Checks

- Do not check for an `error` field in results. Instead, use exceptions to indicate failures.

---

## 11. Testing Your Integration

### 11.1. Simulate Error Scenarios

- **Invalid Inputs:** Test your action with invalid inputs to ensure it throws appropriate errors.
- **API Failures:** Simulate API failures (e.g., HTTP 404) to verify proper error propagation.

### 11.2. Verify Executor Behavior

- **Action Status Handling:** Ensure that actions are marked as 'failed' when exceptions occur.
- **Proper Error Messages:** Verify that detailed error messages are included in the action’s failure details.

