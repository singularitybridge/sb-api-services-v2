# Creating Actions: A Developer's Guide

This guide provides comprehensive instructions for developing new integrations and their associated actions within the system. It emphasizes current best practices, including standardized error handling, response structures, and the use of helper utilities.

## 1. Overview

Actions are functions that the AI agent can invoke to interact with external services or perform operations. The framework is designed to make adding new actions consistent and robust.

**Core Principles:**
-   **Standardized Responses:** Successful actions return a `StandardActionResult<R>` object.
-   **Error Handling by Exceptions:** Failures are indicated by throwing custom error types (e.g., `ActionValidationError`, `ActionServiceError`, `ActionExecutionError`).
-   **Centralized Execution Logic:** The `executeAction` helper simplifies error handling and response formatting within action definitions.
-   **Clear Structure:** Integrations follow a defined directory and file structure.

## 2. File Structure for a New Integration

When adding a new integration (e.g., "my_new_service"), create the following directory structure under `src/integrations/`:

```
src/integrations/
└── my_new_service/
    ├── my_new_service.service.ts  // Core business logic
    ├── my_new_service.actions.ts  // Action definitions exposed to the AI
    ├── integration.config.json    // Metadata for the integration
    └── translations/              // Optional: for localized strings
        ├── en.json
        └── he.json
```

## 3. Developing the Integration Files

### 3.1. Service File (`my_new_service.service.ts`)

This file contains the core business logic of your integration. Functions here should be reusable and generally independent of the action invocation context.

-   **Purpose:** Encapsulate interactions with external APIs, database operations, or complex computations.
-   **Return Values:** Service functions can return any type of data or throw errors. The `actions.ts` file will adapt these to the framework's standards.

**Example:**

```typescript
// src/integrations/my_new_service/my_new_service.service.ts

interface MyServiceParams {
  apiKey: string;
  itemId: string;
}

interface MyServiceSuccessResponse {
  id: string;
  status: string;
  details: Record<string, any>;
}

// This service function might throw an error on failure or return a specific object.
export const performMyServiceOperation = async (params: MyServiceParams): Promise<MyServiceSuccessResponse> => {
  if (!params.apiKey) {
    throw new Error('MyNewService API key is missing.'); // Or a more specific custom error
  }
  // const response = await externalApi.post('/items', { id: params.itemId }, { headers: { 'X-API-Key': params.apiKey }});
  // if (!response.ok) {
  //   throw new Error(`MyNewService API error: ${response.statusText}`);
  // }
  // return response.json();

  // Simulated success for example:
  return { id: params.itemId, status: "processed", details: { info: "Data from service" } };
};
```

### 3.2. Actions File (`my_new_service.actions.ts`)

This file defines the actions that are exposed to the AI agent. Each action uses the `executeAction` helper to ensure standardized behavior.

**Key Concepts:**

-   **`ActionContext`**: Provided to the `create...Actions` factory function, containing `sessionId`, `companyId`, `language`, etc.
-   **`FunctionFactory`**: The return type of `create...Actions`, an object where keys are action names and values are `FunctionDefinition`.
-   **`FunctionDefinition`**: Describes an action, its parameters (using a Zod-like schema for the Vercel AI SDK), and its implementation.
    -   The `function` property within `FunctionDefinition` is your actual action logic. It **must** return `Promise<StandardActionResult<R>>`.
-   **`StandardActionResult<R>`**: The standardized success response (`{ success: true, message?: string, data?: R }`).
-   **`executeAction<R_Data, S_LambdaResponse>` Helper (`src/integrations/actions/executor.ts`):**
    -   Simplifies action implementation by handling `try...catch` blocks, error wrapping, and `StandardActionResult` creation.
    -   Requires an `actionName` (string) and a `serviceCallLambda` (async function).
    -   The `serviceCallLambda` you provide should:
        1.  Call your actual service function(s) from `my_new_service.service.ts`.
        2.  Adapt the service's response (or thrown error) into a `Promise` that resolves to an object of type `S_LambdaResponse`:
            ```typescript
            interface S_LambdaResponse {
              success: boolean;       // true if service operation was successful
              data?: R_Data;         // Payload for StandardActionResult.data if success is true
              description?: string;  // Error message if success is false, or success detail
              error?: string;        // Alternative/original error string
            }
            ```
        3.  If the service operation is successful, return `{ success: true, data: { ... } }`.
        4.  If the service operation has a *handled* failure (e.g., API returns a specific error code you want to treat as a non-exceptional failure), return `{ success: false, description: "Error message" }`. `executeAction` will then throw an `ActionServiceError`.
        5.  If the service operation throws an *unhandled* exception (e.g., network error, unexpected API error), let the `serviceCallLambda` throw it. `executeAction` will catch this and wrap it in an `ActionExecutionError`.
-   **Custom Errors (`src/utils/actionErrors.ts`):**
    -   Throw `ActionValidationError` *before* calling `executeAction` for invalid input parameters provided to the action function itself.
    -   `ActionServiceError` and `ActionExecutionError` are typically thrown *by* `executeAction` based on the outcome of your `serviceCallLambda`.

**Example `my_new_service.actions.ts`:**

```typescript
// src/integrations/my_new_service/my_new_service.actions.ts
import { ActionContext, FunctionFactory, StandardActionResult } from '../actions/types';
import { performMyServiceOperation } from './my_new_service.service';
import { executeAction } from '../actions/executor';
import { ActionValidationError, ActionServiceError, ActionExecutionError } from '../../utils/actionErrors';
import { getApiKey } from '../../services/api.key.service'; // For API key retrieval

// R_Data: Type for the 'data' field in StandardActionResult for 'getItem'
interface GetItemData {
  itemId: string;
  status: string;
  serviceDetails: Record<string, any>;
}

// S_LambdaResponse: Expected return structure from the serviceCallLambda for 'getItem'
interface GetItemServiceLambdaResponse {
  success: boolean;
  data?: GetItemData;
  description?: string;
}

const MY_SERVICE_API_KEY_TYPE = 'my_new_service_api_key'; // Ensure this is in ApiKeyType
const SERVICE_NAME_FOR_ERROR_REPORTING = 'MyNewService';

export const createMyNewServiceActions = (context: ActionContext): FunctionFactory => {
  const { companyId, sessionId } // Destructure from context as needed

  return {
    getItem: {
      description: 'Retrieves an item using My New Service.',
      parameters: {
        type: 'object',
        properties: {
          itemId: { type: 'string', description: 'The ID of the item to retrieve.' },
        },
        required: ['itemId'],
        additionalProperties: false,
      },
      function: async (params: { itemId: string }): Promise<StandardActionResult<GetItemData>> => {
        // 1. Input validation (for parameters passed to this action function)
        if (!params.itemId || params.itemId.trim() === '') {
          throw new ActionValidationError('Item ID is required.');
        }

        // 2. API Key retrieval (example) - can also be done inside serviceCallLambda if preferred
        const apiKey = await getApiKey(companyId, MY_SERVICE_API_KEY_TYPE);
        if (!apiKey) {
          // Throwing ActionExecutionError here as it's a prerequisite failure for execution
          throw new ActionExecutionError('MyNewService API key is not configured for this company.', {
            actionName: 'getItem',
            statusCode: 400 // Or a more appropriate status
          });
        }

        // 3. Use executeAction
        return executeAction<GetItemData, GetItemServiceLambdaResponse>(
          'getItem', // Action name for logging/error context
          async (): Promise<GetItemServiceLambdaResponse> => {
            // This lambda calls the actual service function
            try {
              const serviceResponse = await performMyServiceOperation({ apiKey, itemId: params.itemId });
              // Adapt serviceResponse to GetItemServiceLambdaResponse
              return {
                success: true,
                data: { // This structure must match GetItemData
                  itemId: serviceResponse.id,
                  status: serviceResponse.status,
                  serviceDetails: serviceResponse.details,
                },
              };
            } catch (error: any) {
              // If performMyServiceOperation throws an error, let executeAction handle it.
              // It will be wrapped in an ActionExecutionError.
              // If you need to transform it into a "handled" failure (success: false) first,
              // you could catch it here and return:
              // return { success: false, description: error.message || 'Service operation failed' };
              throw error; // Recommended: let executeAction wrap it.
            }
          },
          { // Options for executeAction
            serviceName: SERVICE_NAME_FOR_ERROR_REPORTING,
            // successMessage: 'Item retrieved successfully!', // Optional custom success message
          }
        );
      },
    },
    // Add more actions for this integration...
  };
};

### 3.3. Handling Dynamic Schemas with OpenAI Function Calling

OpenAI's function calling API has a fundamental architectural constraint: it **prohibits truly dynamic schemas** where properties are not explicitly defined. This means `additionalProperties` must always be `false` for objects in your tool's JSON Schema. Directly using `additionalProperties: true` or Zod's `z.record()` will lead to API validation errors and silent failures.

**Root Cause:** OpenAI's constrained decoding system relies on pre-computed valid tokens based on a strict JSON schema. Dynamic properties would require unlimited token possibilities, which is incompatible with this design.

**Solution: Array of Key-Value Pairs (Recommended Pattern)**

To support dynamic fields while adhering to OpenAI's strict schema requirements, replace dynamic objects with an array of explicitly defined key-value pair objects. This pattern maintains type safety and works consistently.

**Example Schema Definition (`parameters` in `FunctionDefinition`):**

```typescript
// Instead of:
// data: { type: 'object', additionalProperties: true } // ❌ Will fail with OpenAI

// Use this pattern for dynamic attributes:
attributes: {
  type: 'array',
  description: 'An array of key-value pairs for dynamic attributes.',
  default: [], // Important: Provide a default empty array for optionality
  items: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'The name of the attribute (e.g., "productName", "price").' },
      value: { type: 'string', description: 'The value of the attribute (always as a string).' },
      dataType: {
        type: 'string',
        description: 'Optional: The original data type of the value (e.g., "string", "number", "boolean"). Defaults to "string".',
        enum: ["string", "number", "boolean"],
        default: "string",
      },
    },
    required: ["name", "value"],
    additionalProperties: false, // Crucial: Enforce strictness for attribute objects
  },
},
// Ensure the root parameters object also has additionalProperties: false
additionalProperties: false,
```

**Corresponding Zod Schema Pattern:**

```typescript
// ✅ Do use - array pattern
const workingSchema = z.object({
  data: z.array(z.object({
    key: z.string(),
    value: z.string()
  }))
});

// ❌ Don't use - will fail with OpenAI
const brokenSchema = z.object({
  data: z.record(z.string(), z.string())
});
```

**Processing in Action's `function` Implementation:**

Your action's `function` will receive the `attributes` array. You'll need to convert this array back into a `Record<string, any>` (or similar object structure) before passing it to your service layer.

```typescript
function: async (params: {
  // ... other params ...
  attributes?: Array<{ name: string; value: string; dataType?: "string" | "number" | "boolean" }>;
}) => {
  // Defensive defaults for attributes
  const safeAttributes = params.attributes || [];

  const dynamicData: Record<string, any> = {};
  safeAttributes.forEach(({ name, value, dataType = 'string' }) => {
    // Add validation for name/value if needed
    let processedValue: any = value;
    if (dataType === 'number') {
      processedValue = parseFloat(value);
    } else if (dataType === 'boolean') {
      processedValue = value.toLowerCase() === 'true';
    }
    dynamicData[name] = processedValue;
  });

  // Pass dynamicData to your service
  // e.g., await myService.createItem({ ..., data: dynamicData });
}
```

**Important Considerations for Dynamic Schemas:**

-   **LLM Prompting**: It is absolutely critical to explicitly guide the LLM in your system prompt on how to use this `attributes` array structure. Provide clear examples of how to map user-provided dynamic fields into `name`, `value`, and `dataType` within the `attributes` array.
-   **Zod Conversion Logic**: Ensure your framework's Zod schema generation (`message-handling.service.ts`, `stateless-execution.service.ts`) correctly handles arrays of objects and their nested properties, including `default` values.

### 3.4. Robust Tool Argument Handling

To prevent silent failures and improve resilience against malformed arguments from the LLM or SDK parsing issues, implement defensive checks and argument repair.

**Pre-validation Argument Repair (within the action's `function`):**

To ensure robust handling of arguments, especially for optional arrays or complex types, it's recommended to add defensive repair logic directly within your action's `function` implementation, *before* defining `safeParams` or performing Zod validation. This ensures that the parameters are in an expected state.

```typescript
function: async (params: {
  // ... other params ...
  attributes?: Array<{ name: string; value: string; dataType?: "string" | "number" | "boolean" }>;
}) => {
  // Example for 'createContextItem' tool's attributes parameter
  // Ensure 'attributes' exists and is an array before further processing
  if (!params.hasOwnProperty('attributes')) {
    console.log('[Tool Repair] Adding missing attributes array to params');
    params.attributes = [];
  } else if (params.attributes === null || params.attributes === undefined) {
    console.log('[Tool Repair] Converting null/undefined attributes to empty array in params');
    params.attributes = [];
  } else if (!Array.isArray(params.attributes)) {
    console.log('[Tool Repair] Converting non-array attributes to empty array in params');
    params.attributes = []; // Or attempt to convert if a specific non-array format is expected
  }

  // Now, params.attributes is guaranteed to be an array (or empty array)
  const safeParams = {
    // ... other params ...
    attributes: params.attributes // Use the repaired params.attributes
  };
  
  // Continue with validation (e.g., checking safeParams.attributes.length if needed)
  // ... rest of function (Zod validation, processing attributes)
};
```

**Graceful Error Handling in Tool Execution:**

Instead of throwing errors directly from your tool's `execute` function (or its `serviceCallLambda`), return them as structured results. This prevents stream abortion and allows the LLM to receive feedback.

```typescript
// In your executeFunc wrapper (or where executeAction is called)
try {
  const result = await executeAction(...); // Or direct service call
  
  if (result.error) { // Assuming executeAction returns { success, data, error }
    // Return error as a string result for the LLM
    return `Error: ${typeof result.error === 'string' ? result.error : result.error.message || 'Tool execution failed'}`;
  }
  
  return result.data; // Return data on success
} catch (error: any) {
  // Convert exceptions to string results for the LLM
  return `Error: ${error.message || 'Tool execution failed with an exception'}`;
}
```

### 3.5. Temporary SDK Patch for Empty Arguments

For Vercel AI SDK versions prior to `ai@2.4.3`, models returning `""` as arguments for tool calls can cause silent failures. A temporary patch can convert `""` to `"{}"`.

```typescript
// patch-empty-args.ts (run on application startup)
import { ToolCall } from 'ai';

export function applyToolArgPatch() {
  const ToolCallProto = (globalThis as any).ToolCall?.prototype;
  if (!ToolCallProto) return;
  const orig = ToolCallProto.getArgs;
  ToolCallProto.getArgs = function patched() {
    const raw = orig.apply(this);
    if (raw === '') {
      // Specific handling for tools known to expect empty objects
      const toolName = this.toolName || this.name;
      if (toolName && toolName.includes('createContextItem')) { // Example: for createContextItem
        return '{"contextId":"","contextType":"","key":"","attributes":[]}'; // Provide a valid empty structure
      }
      return '{}'; // Default for other tools
    }
    if (raw === '[]') { // Handle bare array if it causes issues
      return '{"attributes":[]}'; // Example for a tool expecting an attributes array
    }
    return raw;
  };
}
```
**Note:** This patch should be removed once the SDK is confirmed to handle these cases natively (e.g., by upgrading to `ai@2.4.3` or newer).

### 3.6. Configuration File (`integration.config.json`)

This JSON file provides metadata about your integration.

```json
{
  "name": "my_new_service", // Snake_case, matches directory name
  "icon": "icon-name-for-ui", // e.g., "puzzle-piece" or a custom icon identifier
  "apiKeyName": "my_new_service_api_key", // Key used in api.key.service.ts and for UI config
  "actionCreator": "createMyNewServiceActions", // Name of the exported factory function in .actions.ts
  "actionsFile": "my_new_service.actions.ts" // Filename of the actions file
}
```

-   **`apiKeyName`**:
    -   This value **must** correspond to a type defined in the `ApiKeyType` union in `src/services/api.key.service.ts`.
    -   If your integration requires a new API key, add its type (e.g., `'my_new_service_api_key'`) to `ApiKeyType`.
    -   This name is also used by the UI to configure the API key input field.

### 3.7. Translation Files (Optional)

If your integration has user-facing strings (e.g., action titles, descriptions that might be displayed in a UI), provide translations in `translations/en.json` and `translations/he.json`.

Example `en.json`:
```json
{
  "serviceName": "My New Service",
  "getItem": {
    "actionTitle": "Get Item",
    "description": "Retrieves detailed information about a specific item using My New Service."
  }
}
```

## 4. Registering the Integration

New integrations are typically discovered and loaded automatically by the system based on their presence in the `src/integrations/` directory and a valid `integration.config.json`. The `createFunctionFactory` in `src/integrations/actions/loaders.ts` handles loading these configurations and creating the full action map. Ensure your `actionCreator` function is correctly exported from your `actions.ts` file.

## 5. Error Handling Summary

-   **Action Input Validation:** Validate parameters passed directly to your action function *before* calling `executeAction`. Throw `ActionValidationError` for failures.
-   **Service Logic Failures:**
    -   **Unhandled/Exceptional Failures:** If your service function (e.g., `performMyServiceOperation`) or the `serviceCallLambda` throws an unexpected error, `executeAction` will catch it and re-throw it as an `ActionExecutionError`.
    -   **Handled Failures by Service:** If your service function returns a specific error condition that you want to treat as a non-critical failure, your `serviceCallLambda` should detect this and return `{ success: false, description: "Reason for failure" }`. `executeAction` will then throw an `ActionServiceError`.
-   **`StandardActionResult` is for Success Only:** Your action function, after `executeAction` completes, will only return `StandardActionResult` if the operation was successful. All failure paths result in a thrown error.
-   **Global Error Handling:** Thrown custom errors are caught by `executeFunctionCall` (in `executors.ts`), processed by `extractErrorDetails`, and then published as detailed (but truncated) error notifications.

Refer to the "[Error Handling and Notifications](./error_handling_and_notifications.md)" document for more details on the error types and notification flow.

## 6. Testing

-   **Unit Tests:**
    -   Test your service functions in `my_new_service.service.ts` thoroughly, mocking external dependencies.
    -   Test your action functions in `my_new_service.actions.ts`.
        -   Mock the `ActionContext`.
        -   Mock your service functions (e.g., `performMyServiceOperation`).
        -   Verify that `executeAction` is called correctly.
        -   Test successful outcomes (correct `StandardActionResult` structure).
        -   Test input validation errors (correct `ActionValidationError` thrown).
        -   Test service failures by mocking your service to throw errors or return failure indicators, ensuring `executeAction` (and thus your action function) throws the appropriate `ActionExecutionError` or `ActionServiceError`.
-   **Integration/End-to-End Tests:** If possible, test the action flow through the system.

## 7. API Key Management

-   Retrieve API keys within your action (or service) using `await getApiKey(companyId, 'your_api_key_type')` from `src/services/api.key.service.ts`.
-   Ensure the key type matches `integration.config.json` and is defined in `ApiKeyType`.
-   Handle missing API keys gracefully, typically by throwing an `ActionExecutionError` indicating misconfiguration.

By following this guide, developers can create new integrations and actions that are consistent, robust, and well-integrated into the existing framework.
```

### 3.3. Configuration File (`integration.config.json`)

This JSON file provides metadata about your integration.

```json
{
  "name": "my_new_service", // Snake_case, matches directory name
  "icon": "icon-name-for-ui", // e.g., "puzzle-piece" or a custom icon identifier
  "apiKeyName": "my_new_service_api_key", // Key used in api.key.service.ts and for UI config
  "actionCreator": "createMyNewServiceActions", // Name of the exported factory function in .actions.ts
  "actionsFile": "my_new_service.actions.ts" // Filename of the actions file
}
```

-   **`apiKeyName`**:
    -   This value **must** correspond to a type defined in the `ApiKeyType` union in `src/services/api.key.service.ts`.
    -   If your integration requires a new API key, add its type (e.g., `'my_new_service_api_key'`) to `ApiKeyType`.
    -   This name is also used by the UI to configure the API key input field.

### 3.4. Translation Files (Optional)

If your integration has user-facing strings (e.g., action titles, descriptions that might be displayed in a UI), provide translations in `translations/en.json` and `translations/he.json`.

Example `en.json`:
```json
{
  "serviceName": "My New Service",
  "getItem": {
    "actionTitle": "Get Item",
    "description": "Retrieves detailed information about a specific item using My New Service."
  }
}
```

## 4. Registering the Integration

New integrations are typically discovered and loaded automatically by the system based on their presence in the `src/integrations/` directory and a valid `integration.config.json`. The `createFunctionFactory` in `src/integrations/actions/loaders.ts` handles loading these configurations and creating the full action map. Ensure your `actionCreator` function is correctly exported from your `actions.ts` file.

## 5. Error Handling Summary

-   **Action Input Validation:** Validate parameters passed directly to your action function *before* calling `executeAction`. Throw `ActionValidationError` for failures.
-   **Service Logic Failures:**
    -   **Unhandled/Exceptional Failures:** If your service function (e.g., `performMyServiceOperation`) or the `serviceCallLambda` throws an unexpected error, `executeAction` will catch it and re-throw it as an `ActionExecutionError`.
    -   **Handled Failures by Service:** If your service function returns a specific error condition that you want to treat as a non-critical failure, your `serviceCallLambda` should detect this and return `{ success: false, description: "Reason for failure" }`. `executeAction` will then throw an `ActionServiceError`.
-   **`StandardActionResult` is for Success Only:** Your action function, after `executeAction` completes, will only return `StandardActionResult` if the operation was successful. All failure paths result in a thrown error.
-   **Global Error Handling:** Thrown custom errors are caught by `executeFunctionCall` (in `executors.ts`), processed by `extractErrorDetails`, and then published as detailed (but truncated) error notifications.

Refer to the "[Error Handling and Notifications](./error_handling_and_notifications.md)" document for more details on the error types and notification flow.

## 6. Testing

-   **Unit Tests:**
    -   Test your service functions in `my_new_service.service.ts` thoroughly, mocking external dependencies.
    -   Test your action functions in `my_new_service.actions.ts`.
        -   Mock the `ActionContext`.
        -   Mock your service functions (e.g., `performMyServiceOperation`).
        -   Verify that `executeAction` is called correctly.
        -   Test successful outcomes (correct `StandardActionResult` structure).
        -   Test input validation errors (correct `ActionValidationError` thrown).
        -   Test service failures by mocking your service to throw errors or return failure indicators, ensuring `executeAction` (and thus your action function) throws the appropriate `ActionExecutionError` or `ActionServiceError`.
-   **Integration/End-to-End Tests:** If possible, test the action flow through the system.

## 7. API Key Management

-   Retrieve API keys within your action (or service) using `await getApiKey(companyId, 'your_api_key_type')` from `src/services/api.key.service.ts`.
-   Ensure the key type matches `integration.config.json` and is defined in `ApiKeyType`.
-   Handle missing API keys gracefully, typically by throwing an `ActionExecutionError` indicating misconfiguration.

By following this guide, developers can create new integrations and actions that are consistent, robust, and well-integrated into the existing framework.
