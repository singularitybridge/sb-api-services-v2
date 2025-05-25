# Session Management API Changes - Guide for UI Developers

This document outlines recent changes to the session management API endpoints. The goal of these changes is to simplify session handling for client applications by reducing the need to pass `sessionId` for common operations that pertain to the user's current active session.

## Summary of Changes

**Important Note:** All simplified endpoints that operate on the "active session" require the standard `Authorization: Bearer <token>` header for user authentication, just like other protected routes in the API.

1.  **User Input Endpoint Simplified**:
    *   `POST /assistant/user-input` no longer requires `sessionId` in the request body.
    *   The API will automatically use the authenticated user's current active session (for the WEB channel).

2.  **New "Clear Session" Endpoint**:
    *   A new endpoint `POST /session/clear` has been added.
    *   This allows the client to explicitly end the user's current active WEB session and immediately start a new one.
    *   The response will contain the details of the newly created session.

3.  **Active Session Language Management**:
    *   `PUT /session/language`: Updates the language for the user's current active WEB session. (No `sessionId` in the path).
        *   Request Body: `{ "language": "en" }` or `{ "language": "he" }`
    *   `GET /session/language`: Retrieves the language of the user's current active WEB session. (No `sessionId` in the path).

4.  **Active Session Message Retrieval**:
    *   `GET /session/messages`: Retrieves messages for the user's current active WEB session. (No `sessionId` in the path).

## Detailed Endpoint Changes

### 1. User Input

*   **OLD**: `POST /assistant/user-input`
    *   Body: `{ "userInput": "Hello", "sessionId": "someSessionId" }`
*   **NEW**: `POST /assistant/user-input`
    *   Body: `{ "userInput": "Hello" }`
    *   **Action**: The API will automatically determine the active session for the authenticated user (User ID and Company ID from token, Channel assumed as WEB). If no active session exists, one will be created.

### 2. Clearing/Restarting a Session

*   **OLD**:
    1.  `DELETE /session/:sessionId` (to end the current session)
    2.  `POST /session` (to create a new one)
*   **NEW**: `POST /session/clear`
    *   **Action**: This single call will:
        1.  Find the current active WEB session for the authenticated user.
        2.  End that session.
        3.  Create a new active WEB session.
        4.  Return the details of the new session (e.g., `{ "_id": "newSessionId", "assistantId": "...", ... }`).
    *   **Use Case**: Ideal for a "Start New Chat" or "Clear Conversation" button in the UI.

### 3. Managing Session Language

*   **Updating Language for Active Session**:
    *   **Endpoint**: `PUT /session/language`
    *   **Request Body**: `{ "language": "en" }` (or `"he"`)
    *   **Action**: Updates the language of the user's current active WEB session.
    *   **Note**: The previous route `PUT /session/:id/language` (with session ID in path) is still available for updating a specific session by its ID if needed, but for the user's current context, the new route is preferred.

*   **Getting Language for Active Session**:
    *   **Endpoint**: `GET /session/language`
    *   **Action**: Returns the language of the user's current active WEB session (e.g., `{ "language": "en" }`).

### 4. Retrieving Session Messages

*   **Getting Messages for Active Session**:
    *   **Endpoint**: `GET /session/messages`
    *   **Action**: Retrieves all messages for the user's current active WEB session.
    *   **Note**: The previous route `GET /session/:id/messages` (with session ID in path) is still available for fetching messages from a specific session by its ID (e.g., for history or admin views). The route `GET /assistant/thread/session/:sessionId/messages` has been removed to avoid redundancy.

## Implications for UI Development

*   **Authentication**: Ensure all requests to these simplified endpoints include the `Authorization: Bearer <token>` header.
*   **User Input**: When sending a user's message, the UI no longer needs to track and send the `sessionId`. The backend handles this automatically.
*   **Starting a New Chat / Clearing Conversation**: Instead of a two-step process (delete old, create new), the UI can now make a single `POST` request to `/session/clear`. The response will provide the new session details.
*   **Language Switching**: To change or get the language for the current chat, use the new `/session/language` (PUT/GET) endpoints without needing to specify the session ID.
*   **Displaying Current Chat Messages**: To fetch messages for the currently active chat, use `GET /session/messages`.

## Unchanged Endpoints (for specific session ID operations)

The following endpoints that operate on a *specific session ID* (and thus require the ID in the path) remain unchanged:

*   `GET /session/:id` (Get details of a specific session)
*   `DELETE /session/:id` (End a specific session)
*   `PUT /session/:id/assistant` (Update assistant for a specific session)
*   `GET /session/:id/messages` (Get messages for a specific session by ID)

These are typically used when the client explicitly knows which session it needs to interact with, potentially outside the context of the user's "current active" chat (e.g., loading chat history, admin operations).

Please update the UI client to reflect these new and modified API endpoints for a smoother and simpler session management experience.
