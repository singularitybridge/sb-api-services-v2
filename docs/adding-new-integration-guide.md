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

By following these guidelines and structure, you can ensure that your new integration is consistent with existing ones and easily maintainable within the system.