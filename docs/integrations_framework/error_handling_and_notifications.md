# Error Handling and Notifications

This document details the error handling strategy within the integrations framework, including custom error types, how errors are processed, and how action statuses (including failures with detailed error information) are published.

## Custom Error Types

A set of custom error classes, extending the base `Error` class, are defined in `src/utils/actionErrors.ts` to provide more specific and structured error information:

-   **`BaseActionError`**: The base class for all custom action-related errors.
-   **`ActionValidationError`**: Thrown when action input parameters fail validation (e.g., missing required fields, incorrect format).
    -   Properties: `fieldErrors?: Record<string, string>`, `statusCode` (defaults to 400).
-   **`ActionServiceError`**: Thrown by the `executeAction` helper if the `serviceCallLambda` (wrapping the actual service logic) returns `{ success: false, description: "..." }`. This indicates a non-exceptional failure reported by the underlying service.
    -   Properties: `serviceName?: string`, `serviceResponse?: any`, `statusCode` (defaults to 500).
-   **`ActionExecutionError`**: Thrown by the `executeAction` helper for unexpected errors caught from the `serviceCallLambda` or the underlying service logic (e.g., an unhandled exception during an API call).
    -   Properties: `actionName?: string`, `originalError?: any`, `statusCode` (defaults to 500).

Using these specific error types allows for more granular error handling and reporting throughout the system.

## Error Processing with `extractErrorDetails`

When an error is caught during action execution (typically within `executeFunctionCall` in `src/integrations/actions/executors.ts`), the `extractErrorDetails` utility function (from `src/integrations/actions/utils.ts`) is used to convert the raw error object into a standardized `DetailedError` object.

The `DetailedError` interface aims to capture common and specific error properties:

```typescript
export interface DetailedError {
  message: string;
  name?: string;       // e.g., "ActionValidationError", "Error"
  stack?: string;
  actionName?: string; // From ActionExecutionError, ActionServiceError
  originalError?: any; // Potentially complex, from ActionExecutionError
  statusCode?: number; // From all custom action errors
  fieldErrors?: Record<string, string>; // From ActionValidationError
  serviceName?: string;  // From ActionServiceError
  serviceResponse?: any; // Potentially complex, from ActionServiceError
  details?: Record<string, unknown>; // Bucket for other properties
}
```

`extractErrorDetails` intelligently populates this structure based on whether the input error is an instance of `BaseActionError` (and its derivatives), a standard `Error`, or another type.

## Action Status Notifications

The system publishes action status updates ('started', 'completed', 'failed') via Pusher to provide real-time feedback. This is handled by the `publishActionMessage` function in `src/integrations/actions/publishers.ts`.

### Publishing Workflow

1.  **Invocation:** The `executeFunctionCall` (in `executors.ts`) calls `sendActionUpdate` at different stages:
    *   Immediately after preparing for execution: `sendActionUpdate(sessionId, 'started', executionDetails)`
    *   After successful execution: `sendActionUpdate(sessionId, 'completed', { ...executionDetails, output: result })`
    *   When an error is caught or a service call returns `success: false`: `sendActionUpdate(sessionId, 'failed', { ...executionDetails, error: detailedErrorObject })`

2.  **`publishActionMessage` (`publishers.ts`):**
    *   Receives the `status` and `executionDetails` (which includes the `DetailedError` object in `executionDetails.error` for failures).
    *   Constructs `messageData` containing all relevant details about the action and its outcome.
    *   **Error Handling for Publishing:**
        *   If `status === 'failed'`, `messageData.error` is populated with the `DetailedError` object.
    *   **Database Logging:** The full `messageData` (with the potentially large, non-truncated error and output) is saved to the `Message` collection in the database.
    *   **Pusher Payload Preparation:**
        *   A `truncatedMessageData` object is created.
        *   `truncateForPusher(data, maxSize)` utility is applied to:
            *   `messageData.output`
            *   `messageData.error` (This is a key enhancement to prevent large error objects from being cut off by Pusher's message size limits).
        *   The `truncateForPusher` function intelligently summarizes large data, arrays, or long strings to fit within Pusher's limits (around 8KB, configurable).
    *   **Publishing:** The `completeMessage` (containing `truncatedMessageData`) is published to the relevant session channel via `publishSessionMessage` (from `pusher.service.ts`).

### Structure of the 'failed' Notification Payload (Pusher)

When an action fails, the `data` field of the Pusher message (`message_type: 'action_execution'`) will look approximately like this:

```json
{
  "messageId": "action_execution_uuid", // ID of this specific execution attempt
  "actionId": "your_integration.yourAction",
  "serviceName": "Your Integration Service",
  "actionTitle": "Perform Your Action",
  "actionDescription": "Description of the action.",
  "icon": "icon-name",
  "originalActionId": "your_integration_yourAction", // Original name from AI SDK
  "status": "failed",
  "input": { "param1": "value1" },
  "error": { // This is the DetailedError object, potentially truncated
    "message": "Specific error message from the action.",
    "name": "ActionExecutionError", // or ActionServiceError, ActionValidationError
    "stack": "Truncated stack trace...", // If stack was too long
    "actionName": "yourAction",
    "statusCode": 500,
    // ... other relevant fields from DetailedError, also subject to truncation
    "originalError": { "summary": "Large data response (truncated for display)" } // Example if originalError was huge
  }
}
```

This structured and (safely) detailed error information allows the client-side (e.g., AI agent, UI) to:
-   Understand the nature of the failure.
-   Avoid hanging or indeterminate states.
-   Potentially display user-friendly error messages.
-   Make more informed decisions about retries or alternative actions.

By centralizing error processing and ensuring detailed, yet size-conscious, notifications, the framework aims for greater robustness and better diagnosability of issues.
