# Linear Integration

This document provides an overview of the Linear integration in the SB Agent Portal project.

## Overview

Linear is a project management and issue tracking service that has been integrated into the SB Agent Portal. This integration allows AI agents to interact with Linear, managing tasks, issues, and projects efficiently.

## Features

The Linear integration provides the following features:

1. Fetch Issues: Retrieve a list of issues from Linear.
2. Create Issue: Create a new issue in Linear.
3. Update Issue: Modify an existing issue in Linear.
4. Delete Issue: Remove an issue from Linear.
5. Fetch All Issues: Retrieve all issues from Linear, handling pagination automatically.

## Setup

To use the Linear integration, you need to set up a Linear API key:

1. Log in to your Linear account and navigate to the API section.
2. Generate a new API key.
3. Set the API key in your environment variables:

   ```
   LINEAR_API_KEY=your_api_key_here
   ```

## Usage

The Linear service can be used in your application as follows:

```typescript
import { LinearService } from '../services/linear.service';

const linearService = new LinearService(process.env.LINEAR_API_KEY);

// Fetch issues
const issues = await linearService.fetchIssues();

// Create a new issue
const newIssue = await linearService.createIssue('New Feature', 'Implement new functionality', 'team-id');

// Update an issue
await linearService.updateIssue('issue-id', { title: 'Updated Feature', state: 'In Progress' });

// Delete an issue
await linearService.deleteIssue('issue-id');

// Fetch all issues
const allIssues = await linearService.fetchAllIssues();
```

## API Endpoints

The following API endpoints are available for the Linear integration:

- `GET /linear/issues`: Fetch issues
- `POST /linear/issues`: Create a new issue
- `PUT /linear/issues/:id`: Update an existing issue
- `DELETE /linear/issues/:id`: Delete an issue
- `GET /linear/issues/all`: Fetch all issues

All endpoints require authentication using the `validateApiKeys` middleware.

## Error Handling

The Linear service includes error handling for API requests. If an error occurs during an API call, it will be caught and an appropriate error message will be returned.

## Testing

Unit tests for the Linear service are available in the `tests/unit/services/linear.service.test.ts` file. These tests cover all the main functionalities of the service.

To run the tests, use the following command:

```
npm test
```

## Limitations

- The current implementation does not support all features of the Linear API. Additional features can be added as needed.
- Rate limiting is not currently implemented. Be aware of Linear's API rate limits when making requests.

## Future Improvements

- Implement additional Linear API features as needed.
- Add rate limiting to prevent exceeding Linear's API limits.
- Implement caching to improve performance for frequently accessed data.

For any questions or issues regarding the Linear integration, please contact the development team.