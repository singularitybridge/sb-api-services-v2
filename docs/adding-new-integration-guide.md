# Guide: Adding a New Integration

## 1. Introduction

This guide outlines the process of adding a new integration to the system. It covers the necessary files to be created, their structure, and important guidelines to follow.

## 2. File Structure

When adding a new integration, create a new directory under `src/integrations/` with the name of your integration. For example:

```
src/integrations/
└── your-integration/
    ├── your-integration.service.ts
    ├── your-integration.actions.ts
    ├── integration.config.json
    └── translations/
        ├── en.json
        └── he.json
```

## 3. Creating Integration Files

### 3.1. Service File (your-integration.service.ts)

The service file contains the core functionality of your integration. It should include functions that implement the integration's logic.

Example structure:

```typescript
export const yourIntegrationFunction = async (sessionId: string, companyId: string, params: any): Promise<{ success: boolean; data?: any; error?: string }> => {
  try {
    // Implement your integration logic here
    return { success: true, data: 'Operation successful' };
  } catch (error: any) {
    console.error('Error in your integration:', error);
    return { success: false, error: error.message || 'An error occurred' };
  }
};
```

### 3.2. Actions File (your-integration.actions.ts)

The actions file defines the functions that can be called by the system, wrapping the core functionality from the service file.

Example structure:

```typescript
import { ActionContext, FunctionFactory } from '../actions/types';
import { yourIntegrationFunction } from './your-integration.service';

export const createYourIntegrationActions = (context: ActionContext): FunctionFactory => ({
  yourAction: {
    description: 'Description of what this action does',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        // Define your parameters here
      },
      required: [],
      additionalProperties: false,
    },
    function: async (params: any) => {
      try {
        const result = await yourIntegrationFunction(context.sessionId, context.companyId, params);
        return result;
      } catch (error) {
        console.error('Error in yourAction:', error);
        return { success: false, error: 'Failed to perform action' };
      }
    },
  },
});
```

### 3.3. Configuration File (integration.config.json)

The configuration file provides metadata about your integration.

Example content:

```json
{
  "name": "Your Integration",
  "icon": "icon-name",
  "apiKeyName": "your_integration_api_key",
  "actionCreator": "createYourIntegrationActions",
  "actionsFile": "your-integration.actions.ts"
}
```

### 3.4. Translation Files (translations/en.json and translations/he.json)

Create translation files for user-facing strings in both English and Hebrew.

Example content for en.json:

```json
{
  "serviceName": "Your Integration",
  "yourAction": {
    "actionTitle": "Your Action Title",
    "description": "Description of what this action does."
  }
}
```

## 4. Important Guidelines

1. **Error Handling**: Implement robust error handling in both service and actions files. Catch and log errors, and return meaningful error messages.

2. **Type Safety**: Use TypeScript interfaces to define parameter types and return types for better type safety and code clarity.

3. **Modular Design**: Keep your integration modular. Separate core functionality (in the service file) from the action definitions (in the actions file).

4. **Documentation**: Provide clear descriptions for each action and its parameters in the actions file.

5. **Consistency**: Follow the naming conventions and structure of existing integrations for consistency across the project.

6. **Translations**: Always include translation files (en.json and he.json) in the `translations` directory for user-facing strings.

7. **Functional Programming**: Prefer functional programming approaches over classes/OOP when implementing your integration.

8. **ES6 & TypeScript**: Utilize ES6 features and TypeScript in your implementation for better code quality and maintainability.

## 5. Integration with Existing System

### 5.1. Allowed Actions

When implementing integration actions, it's crucial to understand how allowed actions are managed:

1. The `triggerAction` function in `src/services/integration-action.service.ts` is responsible for executing integration actions.

2. Allowed actions are determined by sanitizing the function name:

   ```typescript
   const fullServiceId = sanitizeFunctionName(`${integrationName}.${service}`);
   ```

3. This sanitized function name is then used to check against the list of allowed actions.

4. In debug or testing scenarios, you may need to explicitly allow actions. For example, in `debug.service.ts`:

   ```typescript
   const sanitizedFunctionName = sanitizeFunctionName(`${integrationName}.${service}`);
   const allowedActions: string[] = [sanitizedFunctionName];
   ```

### 5.2. Session Context

When working with integrations, be aware of how session context is managed:

1. The `getSessionContextData` function from `src/services/session-context.service.ts` is used to retrieve session data.

2. Session context may contain important information like user permissions and allowed actions.

3. Always consider the session context when implementing integration logic to ensure proper authorization and access control.

### 5.3. API Key Management

If your integration requires API keys:

1. Use the `getApiKey` function from `src/services/api.key.service.ts` to retrieve API keys for specific integrations.

2. Ensure that your integration's API key is properly set up in the company's configuration.

3. Handle cases where the API key might not be available, providing appropriate error messages.

## 6. Testing and Debugging

1. **Debug Integration**: Use the debug integration (`src/integrations/debug/`) as a reference for implementing and testing new integrations.

2. **Logging**: Implement comprehensive logging in your integration to facilitate debugging. Use `console.log` for development and consider using a more robust logging solution for production.

3. **Error Simulation**: Include ways to simulate errors in your integration for testing purposes. This can help ensure that error handling is working correctly.

4. **Integration Tests**: Write integration tests that cover various scenarios, including successful operations and error cases.

## 7. Updating Existing Integrations

When adding new functionality or modifying existing integrations, keep the following in mind:

1. **Backward Compatibility**: Ensure that changes to existing integrations don't break current functionality. If breaking changes are necessary, provide clear migration instructions.

2. **Update Related Files**: Remember to update all related files when adding or modifying an integration. This includes:
   - The integration's service file
   - The integration's actions file
   - Translation files (both English and Hebrew)
   - Any relevant test files

3. **Debug Integration**: When adding new general-purpose functionality, consider adding it to the debug integration as well. This can serve as both documentation and a testing tool for other developers.

## 8. Best Practices for Integration Development

1. **Parameterization**: Make your integration functions flexible by accepting parameters for configurable elements. This allows for easier reuse and testing.

2. **Async/Await**: Use async/await syntax for asynchronous operations to improve code readability and error handling.

3. **Input Validation**: Implement thorough input validation in your action functions to prevent errors caused by invalid input.

4. **Descriptive Naming**: Use clear, descriptive names for your integration, actions, and functions. This improves code readability and self-documentation.

5. **Comments and Documentation**: Add inline comments for complex logic and provide JSDoc comments for functions to aid in code understanding and maintenance.

6. **Error Messages**: Provide detailed, user-friendly error messages that can help in troubleshooting issues.

7. **Consistent Return Format**: Maintain a consistent return format across all integration functions, typically including `success`, `data`, and `error` fields.

## 9. Integration with External Services

When integrating with external services:

1. **Rate Limiting**: Implement rate limiting mechanisms to respect the external service's usage limits.

2. **Retry Logic**: Add retry logic for transient failures, using exponential backoff to avoid overwhelming the external service.

3. **Timeout Handling**: Implement proper timeout handling to prevent your integration from hanging indefinitely.

4. **Webhook Support**: If the external service supports webhooks, consider implementing webhook handlers for real-time updates.

By following these guidelines and structure, you can ensure that your new integration is consistent with existing ones, properly integrated with the system's action and session management, and easily maintainable within the system.