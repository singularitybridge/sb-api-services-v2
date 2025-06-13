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
): Promise<{ success: boolean; data?: any; message?: string; error?: string }> => {
  // Service functions should return a clear success status. 
  // The `data` field should contain the primary payload of a successful operation. 
  // A `message` can provide a human-readable summary. 
  // If an operation fails within the service but doesn't warrant an exception 
  // (e.g., a partial success or a known non-critical issue), an `error` string 
  // can be returned with `success: false`. However, for most failures, throwing an exception is preferred.
  if (!params.requiredField) {
    // For validation errors or critical issues, throwing an exception is often better.
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
      const result = await yourIntegrationFunction(context.sessionId, context.companyId, params);
      // The object returned by this function is what the system's execution layer 
      // (e.g., `executeFunctionCall`) processes. Ensure this return value is structured appropriately.
      // If the action's output is intended for an AI model, the AI SDK might have specific 
      // expectations for the format (e.g., a simple string or a particular object structure).
      // The `data` field in the returned object is conventionally used for the primary payload.
      // In many cases, returning the full 'result' object from the service is appropriate.
      if (result.success) {
        // Example: return result; // To return { success: true, data: ..., message: ... }
        // Example: return result.data; // To return only the main data payload
        // Example: return result.message; // If a simple string message is expected
        return result; // Adjust based on what the calling system/AI expects
      } else {
        // If the service indicates failure without throwing an exception, 
        // the action should throw one to be handled by the global error handler.
        throw new Error(result.error || 'Action failed due to an unspecified service error from integration.');
      }
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
**Note on `apiKeyName`**: The value provided for `apiKeyName` (e.g., `"YOUR_INTEGRATION_API_KEY"`) must correspond to a type defined in the `ApiKeyType` union in `src/services/api.key.service.ts`. If you are introducing a new API key for your integration, ensure you add its type (e.g., `'your_integration_api_key'`) to the `ApiKeyType` definition.

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

- **Use Exceptions for Errors:** Action functions should **throw exceptions** when errors occur. This is the primary way to signal failure.
- **Consistent Error Handling by Executor:** The executor will handle errors uniformly by catching exceptions and publishing 'failed' statuses.
- **Structured Error Details:** If your integration interacts with external APIs that return structured errors (e.g., with status codes and detailed response bodies, similar to an `APICallError` from the AI SDK), ensure your service layer propagates these details within the thrown exception if possible (e.g., by throwing a custom error class or an error with additional properties). The system's global error handler (`src/middleware/errorHandler.middleware.ts`) is designed to recognize such rich error objects and can provide more detailed feedback to the UI.
  
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

- Retrieve the integration's API key using the `getApiKey` function from the API key service (e.g., `await getApiKey(companyId, 'your_integration_api_key')`).
- **Crucially**, the key type used here (e.g., `'your_integration_api_key'`) must be the same string that is:
    1.  Defined as the `apiKeyName` in your `integration.config.json`.
    2.  Added to the `ApiKeyType` union in `src/services/api.key.service.ts`.
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

- **Throw Exceptions:** Always throw exceptions from action functions or service functions to indicate operational failures. This ensures consistency with the global error handling mechanism.
- **No `error` Fields in Successful Results:** For successful operations (`success: true`), the action should return the data payload (e.g., in a `data` field or as a direct string/object if appropriate). Avoid including an `error` field in successful responses. The service layer might internally use `{ success: false, error: "..." }` for non-exceptional failures it handles, but the action should convert these to exceptions.

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
- **Verify External API Payloads:** Meticulously check the expected request body structure for external APIs. Incorrect or extraneous fields can lead to validation errors (e.g., HTTP 422). Refer directly to the external API's documentation to ensure your request payloads are accurate.

### 9.2. Security Considerations

- **API Keys:** Retrieve and store API keys securely. **Do not log API keys** in any environment.
- **Input Sanitization:** Always sanitize inputs before sending them to external services.

### 9.3. Asynchronous Operations and Polling

Some external APIs operate asynchronously. For example, you might initiate a task (like generating an image or report) and then need to poll an endpoint periodically to check its status and retrieve the result once completed.
- **Polling Logic:** If implementing polling, do so in the `.service.ts` file. Include mechanisms for timeouts and reasonable polling intervals to avoid excessive requests.
- **Status Updates:** Consider how to communicate the status of such long-running operations back to the user or calling system if needed, though the action executor generally handles 'started', 'completed', 'failed'.

### 9.4. Corresponding UI Updates

Adding a new backend integration, especially one that requires an API key, often necessitates updates in the frontend application. Common UI files to consider include:
- **Translation Files:** (e.g., `sb-chat-ui/src/locale/en/translation.json`, `sb-chat-ui/src/locale/he/translation.json`)
    - Add placeholder text for new API key input fields in the company/settings pages.
- **Field Configuration Files:** (e.g., `sb-chat-ui/src/store/fieldConfigs/companyFieldConfigs.ts`)
    - Add configuration for the new API key so that an input field is rendered in the UI, allowing users to save the key. The `key` property in this configuration must match the `ApiKeyType` used in the backend.
- **UI Components for Actions:** While the backend discovery service provides metadata, the frontend will need to:
    - Dynamically render UI elements (forms, buttons) for the new integration's actions.
    - Handle user input for action parameters.
    - Make API calls to the backend to execute actions.
    - Display results or errors.

Ensure that the `apiKeyName` from your backend `integration.config.json` is consistently used when defining field configurations and translation keys in the UI.

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
