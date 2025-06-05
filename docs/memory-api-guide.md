# Memory Hub API Guide for UI Developers

This guide provides UI developers with the necessary information to interact with the Memory Hub API.

## Base URL

All Memory Hub API endpoints are prefixed with: `/api/memory`

## Authentication

All endpoints require a valid JWT Bearer token in the `Authorization` header. Standard company access guards are also in place. Ensure your API calls include the necessary authentication token.

## Journal Entry Types

The `entryType` field for journal entries is a `String`. While previously an enum, it now accepts any string value. This provides flexibility in defining custom entry types as needed. UI developers should ensure that any input fields for `entryType` allow free-form string input or a configurable list of suggestions.

Commonly used entry types might include (but are not limited to):

*   `product`
*   `control`
*   `aftercare`
*   `chat`
*   `tool`
*   `summary`
*   Custom types specific to your application needs.

## Endpoints

### 1. Create a Journal Entry

*   **Method:** `POST`
*   **Path:** `/entries`
*   **Description:** Creates a new journal entry.
*   **Request Body:** `application/json`

    | Field       | Type                                  | Required | Description                                     |
    | :---------- | :------------------------------------ | :------- | :---------------------------------------------- |
    | `content`   | String                                | Yes      | The main content of the journal entry.          |
    | `entryType` | String                                | Yes      | Type of the journal entry.                      |
    | `tags`      | Array of Strings                      | No       | Optional tags for categorization.               |
    | `metadata`  | Object (key: string, value: any)      | No       | Optional additional data.                       |
    
    **Note:** `userId` and `companyId` are automatically derived from the authenticated user's session information and should not be included in the request body.

*   **Example Request:**
    ```json
    {
      "content": "Discussed project milestones with the client.",
      "entryType": "chat",
      "tags": ["client-meeting", "project-alpha"],
      "metadata": { "clientId": "client123", "durationMinutes": 30 }
    }
    ```
*   **Success Response:** `201 Created`
    *   Body: The created journal entry object (includes `_id`, `timestamp`, `isIndexed`, `embeddingId`, `embeddingModel`, etc.).
*   **Error Response:** `400 Bad Request` if validation fails.

### 2. Get Journal Entries

*   **Method:** `GET`
*   **Path:** `/entries`
*   **Description:** Retrieves a list of journal entries based on specified filters.
*   **Query Parameters:**

    | Parameter   | Type                                  | Required | Default | Description                                                                 |
    | :---------- | :------------------------------------ | :------- | :------ | :-------------------------------------------------------------------------- |
    | `userId`    | String (MongoDB ObjectId)             | No       | Session | ID of the user. Defaults to the authenticated user's ID.                    |
    | `companyId` | String (MongoDB ObjectId)             | No       | Session | ID of the company. Defaults to the authenticated user's company ID.         |
    | `sessionId` | String (MongoDB ObjectId)             | No       |         | Filter entries by a specific session ID.                                    |
    | `entryType` | String                                | No       |         | Filter by a specific entry type.                                            |
    | `tags`      | String (comma-separated) or Array     | No       |         | Filter by one or more tags. E.g., `tags=client,meeting`                     |
    | `limit`     | Number                                | No       | 25      | Maximum number of entries to return (1-100).                                |
    | `scope`     | Enum (`user`, `company`)              | No       | `user`  | `user`: only entries for `userId`. `company`: all entries for `companyId`. |

*   **Success Response:** `200 OK`
    *   Body: An array of journal entry objects.
*   **Error Response:** `400 Bad Request` if validation fails.

### 3. Search Journal Entries

*   **Method:** `GET`
*   **Path:** `/entries/search`
*   **Description:** Searches journal entries using vector similarity (primary) or text search (fallback).
*   **Query Parameters:**

    | Parameter   | Type                                  | Required | Default | Description                                                                 |
    | :---------- | :------------------------------------ | :------- | :------ | :-------------------------------------------------------------------------- |
    | `q`         | String                                | Yes      |         | The search query text.                                                      |
    | `companyId` | String (MongoDB ObjectId)             | No       | Session | ID of the company. Defaults to the authenticated user's company ID.         |
    | `userId`    | String (MongoDB ObjectId)             | No       |         | Optional: Restrict search to a specific user's entries. If omitted, searches within the company scope (respecting `scope` if applicable, though search is typically company-wide or user-specific based on this param). |
    | `entryType` | String                                | No       |         | Optional: Filter search results by a specific entry type.                   |
    | `tags`      | String (comma-separated) or Array     | No       |         | Optional: Filter search by one or more tags.                                |
    | `limit`     | Number                                | No       | 10      | Maximum number of entries to return (1-100).                                |

*   **Success Response:** `200 OK`
    *   Body: An array of matching journal entry objects, ordered by relevance.
*   **Error Response:** `400 Bad Request` if validation fails.

### 4. Get Friendly Journal Entries

*   **Method:** `GET`
*   **Path:** `/entries/friendly`
*   **Description:** Retrieves journal entries formatted for display, including user and agent names, and a friendly timestamp.
*   **Query Parameters:** Same as "Get Journal Entries" (`GET /entries`).
*   **Success Response:** `200 OK`
    *   Body: An array of journal entry objects, each augmented with:
        *   `userName` (String)
        *   `agentName` (String or null)
        *   `friendlyTimestamp` (String, e.g., "dd/MM/yy, HH:mm")
*   **Error Response:** `400 Bad Request` if validation fails.

### 5. Update a Journal Entry

*   **Method:** `PATCH`
*   **Path:** `/entries/:id`
    *   `:id` is the MongoDB ObjectId of the journal entry to update.
*   **Description:** Updates specified fields of an existing journal entry.
*   **Request Body:** `application/json`
    *   Provide a partial journal entry object. Any fields from the "Create a Journal Entry" request body can be included.
    *   Example:
        ```json
        {
          "content": "Updated content for the meeting notes.",
          "tags": ["client-meeting", "project-alpha", "follow-up"]
        }
        ```
*   **Success Response:** `200 OK`
    *   Body: The updated journal entry object.
*   **Error Response:**
    *   `400 Bad Request` if validation fails or ID format is invalid.
    *   `404 Not Found` if the entry with the given ID doesn't exist.

### 6. Delete a Journal Entry

*   **Method:** `DELETE`
*   **Path:** `/entries/:id`
    *   `:id` is the MongoDB ObjectId of the journal entry to delete.
*   **Description:** Deletes a specific journal entry.
*   **Success Response:** `204 No Content`
*   **Error Response:**
    *   `400 Bad Request` if ID format is invalid.
    *   `404 Not Found` if the entry with the given ID doesn't exist.

## Journal Entry Object Structure (Example)

A typical journal entry object returned by the API will look like this:

```json
{
  "_id": "67c8f7g8h9j0k1l2m3n4o5p6", // MongoDB ObjectId
  "userId": "66d4cc3284612233413beb77",
  "companyId": "66d41ac3487c19f6d4c23fa1",
  "sessionId": "67c8f7g8h9j0k1l2m3n4o5a1",
  "timestamp": "2025-05-27T10:30:00.000Z",
  "entryType": "chat",
  "content": "Discussed project milestones with the client.",
  "metadata": { "clientId": "client123", "durationMinutes": 30 },
  "tags": ["client-meeting", "project-alpha"],
  "isIndexed": true,
  "embeddingId": "67c8f7g8h9j0k1l2m3n4o5p6",
  "embeddingModel": "text-embedding-ada-002",
  "createdAt": "2025-05-27T10:30:00.000Z",
  "updatedAt": "2025-05-27T10:35:00.000Z"
}
```

For `GET /entries/friendly`, additional fields like `userName`, `agentName`, and `friendlyTimestamp` will be present.

## Important Notes for UI

*   **User and Company IDs:** `userId` and `companyId` are fundamental for most operations. These should typically be available from the authenticated user's session or context within the UI application.
*   **Filtering:** Leverage query parameters like `entryType`, `tags`, `limit`, and `scope` for efficient data retrieval and display.
*   **Error Handling:** Implement proper error handling for `4xx` and `5xx` responses. Zod validation errors (400) will include a structured `errors` array in the response body.
*   **ObjectIDs:** Ensure that any IDs passed (e.g., `userId`, `companyId`, `sessionId`, entry ID in path) are valid MongoDB ObjectId strings.
