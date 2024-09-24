# Guide: Adding a New Integration

## 1. Introduction

This guide outlines the process of adding a new integration to the system. It covers the necessary files to be created, their structure, sample content, and important guidelines to follow.

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

The service file contains the core functionality of your integration. It should include functions that interact with the external API or service.

Example structure:

```typescript
import { getApiKey } from '../../services/api.key.service';

interface YourIntegrationParams {
  // Define parameters for your integration
}

export const yourIntegrationFunction = async (companyId: string, params: YourIntegrationParams): Promise<{ success: boolean; message?: string; error?: string }> => {
  try {
    const apiKey = await getApiKey(companyId, 'your-integration');
    if (!apiKey) {
      throw new Error('API key not found');
    }

    // Implement your integration logic here

    return { success: true, message: 'Operation successful' };
  } catch (error: any) {
    console.error('Error in your integration:', error);
    return { success: false, error: error.message || 'An error occurred' };
  }
};

export const verifyApiKey = async (key: string): Promise<boolean> => {
  try {
    // Implement API key verification logic
    return true;
  } catch (error) {
    console.error('Error verifying API key:', error);
    return false;
  }
};
```

### 3.2. Actions File (your-integration.actions.ts)

The actions file defines the functions that can be called by the system, wrapping the core functionality from the service file.

Example structure:

```typescript
import { ActionContext, FunctionFactory } from '../actions/types';
import { yourIntegrationFunction } from './your-integration.service';

const createYourIntegrationActions = (context: ActionContext): FunctionFactory => ({
  yourAction: {
    description: 'Description of what this action does',
    parameters: {
      type: 'object',
      properties: {
        param1: { type: 'string', description: 'Description of param1' },
        param2: { type: 'number', description: 'Description of param2' },
      },
      required: ['param1', 'param2'],
    },
    function: async ({ param1, param2 }: { param1: string; param2: number }) => {
      try {
        const result = await yourIntegrationFunction(context.companyId, { param1, param2 });
        return result;
      } catch (error) {
        console.error('Error in yourAction:', error);
        return { success: false, error: 'Failed to perform action' };
      }
    },
  },
});

export { createYourIntegrationActions };
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

## 4. Important Guidelines

1. **Error Handling**: Implement robust error handling in both service and actions files. Catch and log errors, and return meaningful error messages.

2. **API Key Management**: Use the `getApiKey` function from the `api.key.service` to securely retrieve API keys. Implement a `verifyApiKey` function to validate API keys.

3. **Type Safety**: Use TypeScript interfaces to define parameter types and return types for better type safety and code clarity.

4. **Modular Design**: Keep your integration modular. Separate core functionality (in the service file) from the action definitions (in the actions file).

5. **Documentation**: Provide clear descriptions for each action and its parameters in the actions file.

6. **Consistency**: Follow the naming conventions and structure of existing integrations for consistency across the project.

7. **Translations**: If your integration requires user-facing strings, add translation files in the `translations` directory.

8. **Testing**: Although not shown in this guide, consider adding unit tests for your integration in a `__tests__` directory within your integration folder.

9. **Functional Programming**: Prefer functional programming approaches over classes/OOP when implementing your integration.

10. **ES6 & TypeScript**: Utilize ES6 features and TypeScript in your implementation for better code quality and maintainability.

By following these guidelines and structure, you can ensure that your new integration is consistent with existing ones and easily maintainable within the system.