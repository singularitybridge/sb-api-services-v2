# Allowed Actions Feature

## Overview

The Allowed Actions feature provides fine-grained control over which actions each assistant can perform. This feature enhances security and customization by allowing you to specify a set of permitted actions for each assistant.

## Creating an Assistant with Specific Allowed Actions

When creating a new assistant, you can specify the allowed actions as part of the assistant's configuration. Here's an example of how to create an assistant with specific allowed actions:

```javascript
POST /assistants
Content-Type: application/json

{
  "name": "Custom Assistant",
  "description": "An assistant with custom allowed actions",
  "allowedActions": ["readJournal", "writeJournal", "searchInbox"]
}
```

If no `allowedActions` are specified during creation, a default set of actions will be assigned.

## Updating Allowed Actions for an Existing Assistant

To update the allowed actions for an existing assistant, use the following API endpoint:

```javascript
PATCH /assistants/{assistantId}/allowed-actions
Content-Type: application/json

{
  "allowedActions": ["readJournal", "writeJournal", "searchInbox", "sendEmail"]
}
```

This will replace the existing set of allowed actions with the new set provided in the request.

## Retrieving Allowed Actions for an Assistant

To retrieve the current set of allowed actions for an assistant, you can fetch the assistant's details:

```javascript
GET /assistants/{assistantId}
```

The response will include an `allowedActions` array containing the list of actions the assistant is permitted to perform.

## Best Practices for Managing Allowed Actions

1. **Principle of Least Privilege**: Only grant actions that are necessary for the assistant to perform its intended functions.

2. **Regular Review**: Periodically review and update the allowed actions for each assistant to ensure they align with current requirements.

3. **Consistency**: Maintain consistency in action naming conventions to avoid confusion and errors.

4. **Documentation**: Keep a record of which actions are allowed for each assistant and the rationale behind these permissions.

5. **Testing**: After updating allowed actions, thoroughly test the assistant to ensure it can perform its intended functions and cannot perform unauthorized actions.

6. **Auditing**: Implement logging for changes to allowed actions to maintain an audit trail for security and compliance purposes.

7. **Grouping**: Consider grouping related actions together for easier management, especially when dealing with a large number of assistants or actions.

## Available Actions

Below is a list of available actions that can be assigned to assistants:

- `readJournal`: Allows the assistant to read entries from the journal.
- `writeJournal`: Allows the assistant to write new entries to the journal.
- `searchInbox`: Permits the assistant to search through the user's inbox.
- `sendEmail`: Enables the assistant to send emails on behalf of the user.
- `scheduleEvent`: Allows the assistant to schedule events on the user's calendar.

(Note: This list may be expanded or modified as new features are added to the system.)

By effectively utilizing the Allowed Actions feature, you can create highly customized and secure assistants tailored to specific use cases and security requirements.