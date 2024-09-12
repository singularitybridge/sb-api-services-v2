# Action Refactoring Technical Design

## Objective
Refactor the action system to allow setting specific actions per assistant, providing fine-grained control over which actions each assistant can perform.

## Current Architecture
The current system uses a global action factory that provides all available actions to every assistant. Assistants are currently associated with actions through an `actions` field, which is an array of ObjectIds referencing an Action model.

## Proposed Changes

### 1. Action Permission System

#### Data Structure
Update the `Assistant` interface and schema in `src/models/Assistant.ts`:

```typescript
export interface IAssistant extends Document {
  // ... existing fields
  allowedActions: string[]; // New field
}

const AssistantSchema: Schema = new Schema({
  // ... existing fields
  allowedActions: [{ type: String, required: false }], // New field
});
```

Remove the existing `actions` field from the Assistant model, as it will be replaced by `allowedActions`.

Example of how the `allowedActions` array might look for an assistant:

```typescript
const assistant = {
  // ... other assistant properties
  allowedActions: ['readJournal', 'writeJournal', 'searchInbox', 'sendEmail', 'scheduleEvent']
};
```

#### Database Changes
- Modify the Assistant model in MongoDB to include the new `allowedActions` field.
- Create a migration script to convert existing `actions` references to action names in `allowedActions`.

### 2. Action Factory Refactoring

Update the `createFunctionFactory` function in `src/actions/factory.ts`:

```typescript
export const createFunctionFactory = (context: ActionContext, allowedActions: string[]): FunctionFactory => {
  const allActions = {
    ...createInboxActions(context),
    ...createAssistantActions(context),
    // ... other action creators
  };

  return Object.fromEntries(
    Object.entries(allActions)
      .filter(([actionName]) => allowedActions.includes(actionName))
  );
};
```

### 3. Assistant Service Updates

Modify the `handleSessionMessage` function in `src/services/assistant.service.ts`:

```typescript
export const handleSessionMessage = async (
  apiKey: string,
  userInput: string,
  sessionId: string,
  channel: ChannelType = ChannelType.WEB,
  metadata?: Record<string, string>,
): Promise<string> => {
  // ... existing code

  const assistant = await Assistant.findOne({
    _id: new mongoose.Types.ObjectId(session.assistantId),
  });

  if (!assistant) {
    throw new Error('Assistant not found');
  }

  const openaiClient = getOpenAIClient(apiKey);
  const functionFactory = createFunctionFactory(
    { sessionId: session.id, companyId: session.companyId },
    assistant.allowedActions
  );

  // ... rest of the function using the assistant-specific functionFactory
};
```

### 4. API Endpoint for Managing Allowed Actions

Create a new route in `src/routes/assistant.routes.ts`:

```typescript
router.patch('/:assistantId/allowed-actions', updateAllowedActions);
```

Implement the corresponding controller function:

```typescript
const updateAllowedActions = async (req: Request, res: Response) => {
  const { assistantId } = req.params;
  const { allowedActions } = req.body;

  const updatedAssistant = await assistantService.updateAllowedActions(assistantId, allowedActions);

  res.json(updatedAssistant);
};
```

### 5. Assistant Service Updates

Add a new method to `src/services/assistant.service.ts`:

```typescript
export const updateAllowedActions = async (assistantId: string, allowedActions: string[]): Promise<IAssistant> => {
  const assistant = await Assistant.findByIdAndUpdate(
    assistantId,
    { $set: { allowedActions } },
    { new: true }
  );

  if (!assistant) {
    throw new Error('Assistant not found');
  }

  return assistant;
};
```

## Implementation Steps

1. Update the Assistant model in MongoDB to include the `allowedActions` field and remove the `actions` field.
2. Create a migration script to convert existing `actions` references to action names in `allowedActions`.
3. Modify the `Assistant` interface and schema in the codebase to reflect the new field.
4. Update the `createFunctionFactory` function in `src/actions/factory.ts` to filter actions based on `allowedActions`.
5. Modify the `handleSessionMessage` function in `assistant.service.ts` to use the assistant-specific function factory.
6. Create the new API endpoint for managing allowed actions in `assistant.routes.ts`.
7. Implement the `updateAllowedActions` method in `assistant.service.ts`.
8. Update the `createDefaultAssistant` function to include default allowed actions.
9. Update any relevant tests to account for the new allowed actions system.
10. Update the documentation to reflect the new ability to set actions per assistant.

## Data Management

- Allowed actions will be stored as an array of action names in the Assistant document in MongoDB.
- When creating a new assistant, default allowed actions should be set (e.g., basic actions allowed for all assistants).
- The API will provide endpoints to retrieve and update allowed actions for each assistant.

## Security Considerations

- Ensure that only authorized users can modify allowed actions for assistants.
- Implement proper input validation for allowed actions updates to prevent malicious input.
- Log all changes to allowed actions for auditing purposes.

## Performance Considerations

- The creation of assistant-specific function factories might introduce a small overhead. Consider implementing a caching mechanism if this becomes a performance bottleneck.
- Evaluate the impact on database queries and optimize if necessary (e.g., indexing the `allowedActions` field).

## Testing Strategy

1. Unit tests:
   - Test the updated `createFunctionFactory` function with various allowed actions configurations.
   - Test the `updateAllowedActions` method in the assistant service.

2. Integration tests:
   - Test the API endpoint for updating allowed actions.
   - Verify that assistants can only execute allowed actions.

3. End-to-end tests:
   - Create scenarios that involve multiple assistants with different allowed actions and ensure they behave correctly.

## Rollout Plan

1. Implement the changes in a development environment.
2. Create and test the migration script for converting existing `actions` to `allowedActions`.
3. Conduct thorough testing as outlined in the testing strategy.
4. Update documentation and prepare any necessary migration scripts.
5. Deploy to a staging environment for final validation.
6. Plan a gradual rollout to production, starting with a small subset of assistants.
7. Monitor closely for any issues and be prepared to rollback if necessary.

## Future Considerations

- Implement a user interface for managing allowed actions more easily.
- Consider grouping actions into logical sets for easier management.
- Explore the possibility of time-based or context-based action permissions.

This updated technical design provides a comprehensive approach to managing allowed actions on a per-assistant basis, taking into account the existing codebase structure and ensuring smooth integration with the current system.