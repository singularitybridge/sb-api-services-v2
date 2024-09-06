# Adding New Service Playbook

This playbook outlines the steps for adding a new service to the API, including the creation of a model, service, and route.

## Steps to Add a New Service

1. Create a new model:
   - Add a new file in the `src/models/` directory (e.g., `NewService.ts`).
   - Define the model interface and any necessary types.

2. Create a new service:
   - Add a new file in the `src/services/` directory (e.g., `newService.service.ts`).
   - Implement the service logic, including CRUD operations and any specific business logic.

3. Create a new route:
   - Add a new file in the `src/routes/` directory (e.g., `newService.routes.ts`).
   - Define the routes for the new service, following the pattern in `src/routes/tts.routes.ts`.
   - Pay attention to the following middleware and functions:
     - Use `validateApiKeys` middleware for authentication.
     - Use `AuthenticatedRequest` type for request objects.
     - Implement `getApiKey` function to retrieve the API key.

Example route structure:

```typescript
import { Router } from 'express';
import { validateApiKeys } from '../middleware/auth.middleware';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { getApiKey } from '../utils/apiKey.util';

const router = Router();

router.post('/endpoint', validateApiKeys, async (req: AuthenticatedRequest, res) => {
  try {
    const apiKey = getApiKey(req);
    // Implement endpoint logic here
    res.status(200).json({ message: 'Success' });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
```

4. Update the main application file:
   - Import and use the new route in `src/app.ts` or the main application file.

5. Implement unit tests:
   - Create a new test file in the `tests/unit/` directory (e.g., `newService.test.ts`).
   - Write comprehensive unit tests covering all the functions in your new service.
   - Ensure to test both successful cases and error handling.

Example test structure:

```typescript
import { NewService } from '../../src/services/newService.service';

describe('NewService', () => {
  let newService: NewService;

  beforeEach(() => {
    newService = new NewService();
  });

  it('should perform a specific action', async () => {
    const result = await newService.specificAction();
    expect(result).toBeDefined();
    // Add more specific assertions
  });

  it('should handle errors correctly', async () => {
    // Test error scenarios
  });
});
```

By following this playbook, you can ensure consistent implementation of new services across the API, maintaining code quality and testability.