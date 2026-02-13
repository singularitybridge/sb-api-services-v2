# Agent Hub MCP Server

HTTP-based Model Context Protocol (MCP) server for the SB Agent Hub platform. Provides unified access to AI agents, workspace management, and team operations via a standardized JSON-RPC 2.0 interface.

## Overview

The MCP server exposes 43 tools for managing AI agents, sessions, workspace items, team operations, cost tracking, prompt history, integrations, models, and UI control. All tools are accessible via HTTP POST requests to `/api/mcp` with Bearer token authentication.

## Authentication

All requests (except `initialize` and `tools/list`) require Bearer token authentication:

```bash
curl -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"list_agents"},"id":1}'
```

## Available Tools (43)

### Agent Management (12 tools)

#### 1. `execute`
Execute an AI assistant with a user prompt using direct service integration. Returns the assistant's response including any tool calls and generated content.

**Parameters:**
- `assistantId` (string, required): Agent ID or name
- `userInput` (string, required): User's message/prompt
- `sessionId` (string, optional): Session ID for conversation context
- `systemPromptOverride` (string, optional): Override the agent's system prompt
- `attachments` (array, optional): Array of attachments with `type` ("url" or "base64"), `data`, `url`, `mimeType`, `fileName`
- `responseFormat` (object, optional): Set `{ type: "json_object" }` for structured JSON output
- `includeToolCalls` (boolean, optional): Include tool call details in response (default: true)

**Example:**
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "execute",
    "arguments": {
      "assistantId": "Test MCP Agent",
      "userInput": "What are your capabilities?",
      "includeToolCalls": true
    }
  },
  "id": 1
}
```

#### 2. `list_agents`
List all AI agents/assistants for the authenticated company. Returns agent ID, name, description, LLM provider, model, max tokens, and team associations.

**Parameters:**
- `limit` (number, optional): Maximum agents to return (default: 50)
- `offset` (number, optional): Number of agents to skip for pagination (default: 0)

#### 3. `list_agents_by_team`
List all agents that belong to a specific team.

**Parameters:**
- `teamId` (string, required): Team ID
- `limit` (number, optional): Maximum agents to return (default: 50)
- `offset` (number, optional): Pagination offset (default: 0)

#### 4. `get_agent_info`
Get detailed information about a specific agent including ID, name, description, LLM config, session TTL, allowed actions, and teams.

**Parameters:**
- `agentId` (string, required): Agent ID or name

#### 5. `get_agent_prompt`
Get the system prompt for a specific agent.

**Parameters:**
- `agentId` (string, required): Agent ID or name

#### 6. `update_agent_prompt`
Update the system prompt for an agent. Automatically saves to prompt history.

**Parameters:**
- `agentId` (string, required): Agent ID or name
- `prompt` (string, required): New system prompt/instructions

#### 7. `create_agent`
Create a new AI agent/assistant with specified LLM provider and model.

**Parameters:**
- `name` (string, required): Agent name
- `description` (string, optional): Agent description
- `llmProvider` (string, required): LLM provider ("openai", "google", or "anthropic")
- `llmModel` (string, required): Model name (e.g., "gpt-5.1", "claude-sonnet-4-5", "gemini-2.5-flash")
- `llmPrompt` (string, optional): System prompt
- `maxTokens` (number, optional): Max tokens for responses (default: 25000)
- `teamIds` (string[], optional): Array of team IDs to assign the agent to

#### 8. `update_agent`
Update an agent's core metadata. Only updates the fields you provide.

**Parameters:**
- `agentId` (string, required): Agent ID or name
- `name` (string, optional): New name
- `description` (string, optional): New description
- `prompt` (string, optional): New system prompt
- `llmProvider` (string, optional): LLM provider ("openai", "google", or "anthropic")
- `llmModel` (string, optional): Model name
- `maxTokens` (number, optional): Max tokens (default: 25000)
- `sessionTtlHours` (number or null, optional): Auto-expire sessions after this many hours of inactivity. Set to null to disable.

#### 9. `delete_agent`
Permanently delete an agent. This action cannot be undone.

**Parameters:**
- `agentId` (string, required): Agent ID, name, or URL

#### 10. `assign_agent_to_team`
Assign an agent to one or more teams. Can append to existing teams or replace them.

**Parameters:**
- `agentId` (string, required): Agent ID, name, or URL
- `teamIds` (string[], required): Array of team IDs
- `append` (boolean, optional): If true, append to existing teams; if false, replace (default: true)

#### 11. `remove_agent_from_team`
Remove an agent from a team.

**Parameters:**
- `agentId` (string, required): Agent ID, name, or URL
- `teamId` (string, required): Team ID to remove the agent from

#### 12. `update_agent_actions`
Enable or disable integration actions for an agent. Use `list_integrations` to see available action IDs.

**Parameters:**
- `agentId` (string, required): Agent ID or name
- `setActions` (string[], optional): Replace all actions with this list (action IDs like "jira.createTicket")
- `addActions` (string[], optional): Add these actions to existing allowed actions
- `removeActions` (string[], optional): Remove these actions from allowed actions

---

### Session Management (6 tools)

#### 13. `create_session`
Start a new chat session with an AI assistant. Deactivates any existing active session for the same user/channel/agent combination.

**Parameters:**
- `agentId` (string, required): Agent ID or name
- `metadata` (object, optional): Session metadata
- `channel` (string, optional): Channel identifier ("web", "telegram", "whatsapp", "email", "api"). Defaults to "web"
- `channelUserId` (string, optional): External user ID for the channel
- `channelMetadata` (object, optional): Channel-specific metadata

#### 14. `send_message`
Send a message to a chat session and get the assistant's response. Supports attachments.

**Parameters:**
- `sessionId` (string, required): Session ID
- `message` (string, required): User message content
- `attachments` (array, optional): Array of attachments with `type`, `url`/`data`, `mimeType`, `fileName`
- `waitForResponse` (boolean, optional): Wait for assistant response (default: true)
- `timeout` (number, optional): Response timeout in milliseconds (default: 60000)

#### 15. `get_session_messages`
Retrieve message history for a session with pagination. Returns messages in chronological order.

**Parameters:**
- `sessionId` (string, required): Session ID
- `limit` (number, optional): Max messages to return (default: 50)
- `offset` (number, optional): Pagination offset (default: 0)
- `sender` (string, optional): Filter by sender type ("user", "assistant", or "system")

#### 16. `list_sessions`
List chat sessions with optional filters. Returns session details including message counts and last activity.

**Parameters:**
- `agentId` (string, optional): Filter by agent ID or name
- `status` (string, optional): Filter by status ("active" or "inactive")
- `channel` (string, optional): Filter by channel ("web", "telegram", "whatsapp", etc.)
- `channelUserId` (string, optional): Filter by channel user ID
- `limit` (number, optional): Max sessions to return (default: 20)
- `offset` (number, optional): Pagination offset (default: 0)

#### 17. `clear_session`
Clear all messages from a session. The session remains active but with empty history.

**Parameters:**
- `sessionId` (string, required): Session ID

#### 18. `delete_session`
Permanently delete a session and all its messages.

**Parameters:**
- `sessionId` (string, required): Session ID

---

### Workspace Management (7 tools)

All workspace tools support three scopes:
- **company**: Company-wide shared data (no `scopeId` required)
- **session**: Session-specific data (requires `sessionId` as `scopeId`)
- **agent**: Agent-specific data (requires agent ID/name as `scopeId`) -- **default**

#### 19. `add_workspace_item`
Add or update a workspace item. Supports storing content directly or downloading from a URL for large files.

**Parameters:**
- `itemPath` (string, required): Path for the item (e.g., "/config/settings.json")
- `content` (any, optional): Content to store (string, object, array, etc.). Not required if `fileUrl` is provided
- `fileUrl` (string, optional): URL to download and store (for large files >50KB). Supports `file://`, `http://`, `https://`. Mutually exclusive with `content`
- `scope` (string, optional): "company", "session", or "agent" (default: "agent")
- `scopeId` (string, optional): Scope ID (required for session/agent scope)
- `metadata` (object, optional): Metadata with `contentType`, `description`, `tags`

#### 20. `get_workspace_item`
Get a specific workspace item's content and metadata.

**Parameters:**
- `itemPath` (string, required): Path of the item
- `scope` (string, optional): "company", "session", or "agent" (default: "agent")
- `scopeId` (string, optional): Scope ID

#### 21. `list_workspace_items`
List workspace item paths with optional prefix filtering.

**Parameters:**
- `scope` (string, optional): "company", "session", or "agent" (default: "agent")
- `scopeId` (string, optional): Scope ID
- `prefix` (string, optional): Path prefix to filter items (e.g., "/docs")

#### 22. `get_latest_workspace_items`
Get the most recently updated workspace items sorted by modification time. Returns metadata (path, timestamps, size, type) but excludes full content.

**Parameters:**
- `limit` (number, optional): Max items to return (1-100, default: 10)
- `scope` (string, optional): "company", "session", or "agent" (default: "company")
- `scopeId` (string, optional): Scope ID
- `prefix` (string, optional): Path prefix filter

#### 23. `delete_workspace_item`
Delete a workspace item. Returns error if item does not exist.

**Parameters:**
- `itemPath` (string, required): Path of the item to delete
- `scope` (string, optional): "company", "session", or "agent" (default: "agent")
- `scopeId` (string, optional): Scope ID

#### 24. `move_workspace_item`
Move/rename a workspace item from one path to another. Can move within the same scope or across scopes.

**Parameters:**
- `fromPath` (string, required): Source path
- `toPath` (string, required): Destination path
- `fromScope` (string, optional): Source scope (default: "agent")
- `toScope` (string, optional): Destination scope (default: same as fromScope)
- `fromScopeId` (string, optional): Source scope ID
- `toScopeId` (string, optional): Destination scope ID (default: same as fromScopeId)

#### 25. `vector_search_workspace`
Semantic search across workspace items using AI embeddings. Finds documents similar to your query based on meaning, not just keywords.

**Parameters:**
- `query` (string, required): Search query
- `scope` (string, optional): "company", "session", or "agent" (default: "agent")
- `scopeId` (string, optional): Scope ID
- `limit` (number, optional): Max results (default: 10, max: 50)
- `minScore` (number, optional): Minimum similarity threshold 0-1 (default: 0.7)

---

### Team Management (6 tools)

#### 26. `list_teams`
List all teams for the authenticated company.

**Parameters:**
- `limit` (number, optional): Max teams to return (default: 50)
- `offset` (number, optional): Pagination offset (default: 0)

#### 27. `create_team`
Create a new team for organizing agents.

**Parameters:**
- `name` (string, required): Team name
- `description` (string, required): Team description
- `icon` (string, optional): Icon value (emoji, Lucide icon name, or workspace file path)
- `iconType` (string, optional): "emoji" (default), "lucide", or "workspace"

#### 28. `update_team`
Update an existing team's attributes. Only provided fields will be updated.

**Parameters:**
- `teamId` (string, required): Team ID
- `name` (string, optional): New name
- `description` (string, optional): New description
- `icon` (string, optional): New icon
- `iconType` (string, optional): "emoji", "lucide", or "workspace"

#### 29. `delete_team`
Delete a team. Also removes the team from all agents that reference it. Cannot be undone.

**Parameters:**
- `teamId` (string, required): Team ID

#### 30. `get_team`
Get detailed information about a specific team including name, description, icon, and icon type.

**Parameters:**
- `teamId` (string, required): Team ID

---

### Cost Tracking (2 tools)

#### 31. `get_cost_summary`
Get aggregated cost summary with breakdowns by model, provider, and assistant.

**Parameters:**
- `startDate` (string, optional): Start date (ISO 8601, e.g., "2025-01-01")
- `endDate` (string, optional): End date (ISO 8601, e.g., "2025-01-31")
- `provider` (string, optional): Filter by provider ("openai", "anthropic", "google")

#### 32. `get_daily_costs`
Get daily cost breakdown for AI usage over time. Returns daily totals for cost, requests, and tokens with summary statistics.

**Parameters:**
- `days` (number, optional): Number of days to retrieve (default: 30)
- `startDate` (string, optional): Start date (ISO 8601). Overrides `days` parameter if provided
- `endDate` (string, optional): End date (ISO 8601). Defaults to today if `startDate` is provided
- `provider` (string, optional): Filter by provider ("openai", "anthropic", "google")

---

### Prompt History (2 tools)

#### 33. `list_prompt_history`
List the version history of an agent's system prompt. Shows version numbers, change types, descriptions, and previews.

**Parameters:**
- `agentId` (string, required): Agent ID or name
- `limit` (number, optional): Max versions to return (default: 10)
- `offset` (number, optional): Pagination offset (default: 0)

#### 34. `get_prompt_version`
Get the full content of a specific prompt version.

**Parameters:**
- `agentId` (string, required): Agent ID or name
- `version` (number, required): Version number to retrieve

---

### Model Management (1 tool)

#### 35. `list_models`
List all available LLM models grouped by provider (OpenAI, Anthropic, Google) with IDs, descriptions, and pricing.

**Parameters:**
- `provider` (string, optional): Filter by provider ("openai", "anthropic", or "google")

---

### Integration Management (5 tools)

#### 36. `list_integrations`
List all available integrations with their names, descriptions, icons, and available actions.

**Parameters:**
- `language` (string, optional): Language for descriptions ("en" or "he", default: "en")

#### 37. `get_integration_details`
Get detailed information about a specific integration including its actions, parameters, and business context.

**Parameters:**
- `integrationId` (string, required): Integration ID (e.g., "jira", "openai", "sendgrid")
- `includeActions` (boolean, optional): Include detailed action info with parameters (default: true)
- `language` (string, optional): Language for descriptions ("en" or "he", default: "en")

#### 38. `trigger_integration_action`
Execute any integration action for testing and debugging. Use `list_integrations` and `get_integration_details` to discover available actions.

**Parameters:**
- `integrationName` (string, required): Integration name (e.g., "jira", "openai")
- `actionName` (string, required): Action name (e.g., "createIssue", "searchIssues")
- `requestData` (any, required): Request data/parameters for the action
- `sessionId` (string, optional): Session ID for execution context

#### 39. `check_integration_status`
Check if integrations are properly configured (API keys set) for the company. Optionally tests the actual connection.

**Parameters:**
- `integrationIds` (string[], optional): Integration IDs to check (e.g., ["jira", "openai"]). If not provided, checks all integrations
- `testConnection` (boolean, optional): Also test actual connection for configured integrations (default: false)

---

### UI Context & Control (4 tools)

#### 40. `get_ui_context`
Get the current UI context from the connected frontend, including current route, workspace file being viewed, active session ID, and assistant ID.

**Parameters:** None

#### 41. `navigate_to_page`
Navigate the user's browser to a specific page/route in the application.

**Parameters:**
- `path` (string, required): Route path (e.g., "/admin/assistants", "/admin/costs", "/admin/teams")

#### 42. `open_workspace_file`
Open a specific workspace file in the frontend workspace viewer.

**Parameters:**
- `assistantId` (string, required): Agent ID or name that owns the workspace file
- `path` (string, required): Path to the file (e.g., "/README.mdx", "/docs/guide.md")

#### 43. `show_notification`
Display a notification message to the user in the frontend.

**Parameters:**
- `message` (string, required): Notification message
- `type` (string, optional): "success", "error", or "info" (default: "info")

---

## Testing

A comprehensive test utility is available at `tests/integration/ai-agent/testing-utils/test-mcp-tools.js`:

```bash
# List all tools
node test-mcp-tools.js list

# Test workspace operations
node test-mcp-tools.js workspace "Agent Name"

# Test agent operations
node test-mcp-tools.js agents

# Execute an agent
node test-mcp-tools.js execute "Agent Name" "Hello!"

# Call a specific tool
node test-mcp-tools.js tool list_agents '{"includeInactive":false}'

# Run all tests
node test-mcp-tools.js all
```

## Response Format

All responses follow the JSON-RPC 2.0 format:

**Success:**
```json
{
  "jsonrpc": "2.0",
  "result": {
    "content": [{
      "type": "text",
      "text": "{\"success\":true,...}"
    }]
  },
  "id": 1
}
```

**Error:**
```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32602,
    "message": "Invalid parameters: ..."
  },
  "id": 1
}
```

## Architecture

- **HTTP Server**: `src/mcp/http-server.ts` - Main MCP server implementation
- **Tools**: `src/mcp/tools/*.ts` - Individual tool implementations
- **Routes**: Registered at `/api/mcp` via Express router
- **Authentication**: Bearer token via Express middleware
- **Protocol**: JSON-RPC 2.0 over HTTP

## Workspace Scope Hierarchy

1. **Company Scope** (`/company/{companyId}`)
   - Shared across all agents and users in the company
   - No scopeId required
   - Use for: Policies, templates, shared configurations

2. **Session Scope** (`/session/{sessionId}`)
   - Temporary session-specific data
   - Requires sessionId as scopeId
   - Use for: Conversation context, temporary state

3. **Agent Scope** (`/agent/{agentId}`)
   - Agent-specific private data
   - Requires agent ID or name as scopeId
   - Use for: Agent memory, preferences, cached data

## Session Handling

The MCP server implements intelligent session management:

1. **Session Creation**: A new session is created on `initialize` and returned via `Mcp-Session-Id` header
2. **Session Validation**: Sessions expire after 1 hour of inactivity
3. **Auto-Recovery**: If a client sends a stale session ID but has valid authentication, the server automatically creates a new session instead of returning an error

This ensures smooth operation with clients like Claude Code that may cache session IDs across restarts.

## Tools Versioning

The server supports `list_changed` notifications to help clients detect when tools have been updated:

- **Version Constant**: `TOOLS_VERSION` in `http-server.ts`
- **Format**: `YYYY-MM-DD-vN`
- **Header**: `X-MCP-Tools-Version` included in `initialize` and `tools/list` responses
- Clients supporting `list_changed` will auto-refresh their tool cache when the version changes

## Error Codes

- `-32600`: Invalid Request / Session not found (for unauthenticated clients)
- `-32601`: Method Not Found (unknown tool)
- `-32602`: Invalid Params (validation failed)
- `-32603`: Internal Error
- `401`: Authentication required (no WWW-Authenticate header)
