# Linear Integration Plugin

This plugin provides integration with Linear, allowing you to manage issues, comments, and other Linear-related tasks within your application.

## Features

- Fetch issues
- Create, update, and delete issues
- Fetch all issues, issues by user, or issues by date
- Fetch user list and teams
- Fetch issue statuses
- Create comments on issues

## Usage

To use the Linear integration in your application:

1. Import the initialization function:

```typescript
import { initializeLinearIntegration } from './integrations/linear';
```

2. Initialize the integration with the appropriate context:

```typescript
const linearIntegration = initializeLinearIntegration(context);
```

3. Use the integration's actions and services:

```typescript
// Fetch issues
const issues = await linearIntegration.actions.fetchIssues({ first: 10 });

// Create a new issue
const newIssue = await linearIntegration.actions.createLinearIssue({
  title: 'New Issue',
  description: 'This is a new issue',
  teamId: 'team123',
});

// Use a service function directly
const allIssues = await linearIntegration.service.fetchAllIssues(context.companyId);
```

## Configuration

The Linear integration requires an API key to function. Make sure to set up your Linear API key in the `linear.config.json` file or through your application's configuration management system.

## Contributing

If you want to contribute to this integration or report issues, please follow the standard contribution guidelines for the project.