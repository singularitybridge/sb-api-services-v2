# Teams Feature

The Teams feature allows you to organize AI assistants into logical groups. Each team can have multiple assistants, and each assistant can belong to multiple teams.

## Team Properties

- **Name**: The name of the team
- **Description**: A description of the team's purpose
- **Icon**: An optional icon for the team
- **CompanyId**: The ID of the company that owns the team

## API Endpoints

### Teams

- `GET /teams` - Get all teams for the current company
- `GET /teams/:id` - Get a specific team by ID
- `POST /teams` - Create a new team
- `PUT /teams/:id` - Update an existing team
- `DELETE /teams/:id` - Delete a team

### Team Assignments

- `GET /teams/:id/assistants` - Get all assistants assigned to a specific team
- `POST /teams/:teamId/assistants/:assistantId` - Assign an assistant to a team
- `DELETE /teams/:teamId/assistants/:assistantId` - Remove an assistant from a team

### Assistants

- `GET /assistant/by-team/:teamId` - Get all assistants assigned to a specific team

## Example Usage

### Creating a Team

```json
POST /teams
{
  "name": "Customer Support",
  "description": "Assistants focused on customer support tasks",
  "icon": "support_icon"
}
```

**Important Notes:**
- Do NOT include an `_id` field in the request payload. MongoDB will automatically generate a valid ObjectId for the new team.
- The `companyId` is automatically added from your authentication token, so you don't need to include it in the request.
- The `name` and `description` fields are required.

**Example Response:**
```json
{
  "_id": "67cd37eb4ec60c82c318db1a",
  "name": "Customer Support",
  "description": "Assistants focused on customer support tasks",
  "icon": "support_icon",
  "companyId": "66d41ac3487c19f6d4c23fa1",
  "__v": 0
}
```

### Assigning an Assistant to a Team

```
POST /teams/60f7b0b9e6b3f32d4c8b4567/assistants/60f7b0b9e6b3f32d4c8b4568
```

### Getting Assistants by Team

```
GET /teams/60f7b0b9e6b3f32d4c8b4567/assistants
```

## Implementation Details

The Teams feature is implemented using a many-to-many relationship between assistants and teams. Each assistant can be assigned to multiple teams, and each team can have multiple assistants.

The relationship is stored in the Assistant model, which has a `teams` array field containing references to Team documents.

When a team is deleted, all references to that team are automatically removed from assistants.

## Troubleshooting

### Common Errors

1. **Invalid `_id` field**: Including an `_id` field with an invalid value (like an empty string) in the request payload will cause a validation error:
   ```
   Error: Team validation failed: _id: Cast to ObjectId failed for value "" (type string) at path "_id" because of "BSONError"
   ```
   **Solution**: Remove the `_id` field from your request payload.

2. **Missing required fields**: The `name` and `description` fields are required. If you omit them, you'll get a validation error.

3. **Authentication issues**: Make sure your authentication token is valid and included in the request headers.

4. **Access denied**: You can only manage teams that belong to your company. Attempting to access or modify teams from other companies will result in an "Access denied" error.
