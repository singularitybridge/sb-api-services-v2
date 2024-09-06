# Adding Factory Action to a Service Playbook

This playbook outlines the steps for adding a factory action to an existing service in the API.

## Steps to Add a Factory Action

1. Create a new actions file:
   - Add a new file in the `src/actions/` directory (e.g., `newServiceActions.ts`).
   - Follow the pattern in `src/actions/jsonbinActions.ts` for a good action definition.

2. Implement the actions:
   - Define the action functions, each returning a Promise with the action result.
   - Use the provided context to access necessary services and utilities.

Example action file structure:

```typescript
import { Context } from './types';

export const createNewServiceActions = (context: Context) => {
  const { newService, logger } = context;

  return {
    specificAction: async (params: any): Promise<any> => {
      try {
        logger.info('Performing specific action');
        const result = await newService.performAction(params);
        return { success: true, data: result };
      } catch (error) {
        logger.error('Error in specificAction', error);
        return { success: false, error: 'Failed to perform specific action' };
      }
    },
    // Add more actions as needed
  };
};
```

3. Update the factory file:
   - Open `src/actions/factory.ts`.
   - Import the new actions file:
     ```typescript
     import { createNewServiceActions } from './newServiceActions';
     ```
   - Add the new actions to the `createActions` function:
     ```typescript
     export const createActions = (context: Context) => ({
       // Existing actions...
       ...createNewServiceActions(context),
     });
     ```

4. Ensure type safety:
   - Update the `Actions` type in `src/actions/types.ts` to include the new actions.

5. Test the new actions:
   - Create unit tests for the new actions in the `tests/unit/actions/` directory.
   - Ensure all actions are properly tested with various scenarios.
   - Run the full test suite to ensure no regressions: `npm test`

Example test structure:

```typescript
import { createNewServiceActions } from '../../../src/actions/newServiceActions';
import { Context } from '../../../src/actions/types';

describe('NewService Actions', () => {
  let mockContext: Context;
  let actions: ReturnType<typeof createNewServiceActions>;

  beforeEach(() => {
    mockContext = {
      newService: {
        performAction: jest.fn(),
      },
      logger: {
        info: jest.fn(),
        error: jest.fn(),
      },
    } as unknown as Context;

    actions = createNewServiceActions(mockContext);
  });

  it('should perform specificAction successfully', async () => {
    const mockResult = { data: 'test' };
    mockContext.newService.performAction.mockResolvedValue(mockResult);

    const result = await actions.specificAction({});

    expect(result).toEqual({ success: true, data: mockResult });
    expect(mockContext.newService.performAction).toHaveBeenCalled();
    expect(mockContext.logger.info).toHaveBeenCalled();
  });

  it('should handle errors in specificAction', async () => {
    mockContext.newService.performAction.mockRejectedValue(new Error('Test error'));

    const result = await actions.specificAction({});

    expect(result).toEqual({ success: false, error: 'Failed to perform specific action' });
    expect(mockContext.logger.error).toHaveBeenCalled();
  });
});
```

6. Update documentation:
   - Review and update any relevant documentation in the `docs/` directory.
   - If the new action introduces new functionality or changes existing behavior, make sure to document these changes.
   - Update the README.md file if necessary, especially if the new action requires additional setup or configuration.

7. Final verification:
   - Run the entire test suite again to ensure all tests pass: `npm test`
   - Manually test the new action to verify its functionality in the context of the entire application.

By following this playbook, you can consistently add new factory actions to services, ensuring they are properly integrated into the existing action system, well-tested, and thoroughly documented.