# Agent Hub MCP Server

HTTP-based Model Context Protocol (MCP) server for the SB Agent Hub platform. Provides unified access to AI agents, workspace management, and team operations via a standardized JSON-RPC 2.0 interface.

## Overview

The MCP server exposes 13 tools for managing AI agents, workspace items, and team operations. All tools are accessible via HTTP POST requests to `/api/mcp` with Bearer token authentication.

## Authentication

All requests (except `initialize` and `tools/list`) require Bearer token authentication:

```bash
curl -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"list_agents"},"id":1}'
```

## Available Tools

### Agent Management

#### 1. `execute`
Execute an AI assistant with a user prompt.

**Parameters:**
- `agentId` (string, required): Agent ID or name
- `userInput` (string, required): User's message/prompt
- `systemPromptOverride` (string, optional): Override agent's system prompt
- `sessionId` (string, optional): Session context
- `stream` (boolean, optional): Enable streaming responses

**Example:**
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "execute",
    "arguments": {
      "agentId": "Test MCP Agent",
      "userInput": "What are your capabilities?",
      "stream": false
    }
  },
  "id": 1
}
```

#### 2. `list_agents`
List all AI agents for the authenticated company.

**Parameters:**
- `includeInactive` (boolean, optional): Include inactive agents (default: false)

**Example:**
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "list_agents",
    "arguments": {
      "includeInactive": false
    }
  },
  "id": 2
}
```

#### 3. `list_agents_by_team`
List agents belonging to a specific team.

**Parameters:**
- `teamId` (string, required): Team ID
- `includeInactive` (boolean, optional): Include inactive agents

**Example:**
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "list_agents_by_team",
    "arguments": {
      "teamId": "66d41ac3487c19f6d4c23fa2"
    }
  },
  "id": 3
}
```

#### 4. `get_agent_info`
Get detailed information about a specific agent.

**Parameters:**
- `agentId` (string, required): Agent ID or name

**Example:**
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "get_agent_info",
    "arguments": {
      "agentId": "Test MCP Agent"
    }
  },
  "id": 4
}
```

#### 5. `get_agent_prompt`
Get the system prompt for an agent.

**Parameters:**
- `agentId` (string, required): Agent ID or name

**Example:**
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "get_agent_prompt",
    "arguments": {
      "agentId": "Test MCP Agent"
    }
  },
  "id": 5
}
```

#### 6. `update_agent_prompt`
Update the system prompt for an agent.

**Parameters:**
- `agentId` (string, required): Agent ID or name
- `systemPrompt` (string, required): New system prompt

**Example:**
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "update_agent_prompt",
    "arguments": {
      "agentId": "Test MCP Agent",
      "systemPrompt": "You are a helpful assistant specialized in..."
    }
  },
  "id": 6
}
```

#### 7. `create_agent`
Create a new AI agent.

**Parameters:**
- `name` (string, required): Agent name
- `description` (string, required): Agent description
- `llmProvider` (string, required): LLM provider (openai, anthropic, etc.)
- `llmModel` (string, required): Model name
- `systemPrompt` (string, optional): System prompt
- `maxTokens` (number, optional): Max tokens for responses

**Example:**
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "create_agent",
    "arguments": {
      "name": "New Agent",
      "description": "A new AI assistant",
      "llmProvider": "anthropic",
      "llmModel": "claude-3-5-sonnet-20241022",
      "systemPrompt": "You are a helpful assistant."
    }
  },
  "id": 7
}
```

#### 8. `assign_agent_to_team`
Assign an agent to one or more teams.

**Parameters:**
- `agentId` (string, required): Agent ID or name
- `teamIds` (string[], required): Array of team IDs
- `replaceExisting` (boolean, optional): Replace existing teams (default: false)

**Example:**
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "assign_agent_to_team",
    "arguments": {
      "agentId": "Test MCP Agent",
      "teamIds": ["66d41ac3487c19f6d4c23fa2"],
      "replaceExisting": false
    }
  },
  "id": 8
}
```

### Workspace Management

All workspace tools support three scopes:
- **company**: Company-wide shared data (no `scopeId` required)
- **session**: Session-specific data (requires `sessionId` as `scopeId`)
- **agent**: Agent-specific data (requires agent ID/name as `scopeId`) - **default**

#### 9. `add_workspace_item`
Add or update a workspace item.

**Parameters:**
- `itemPath` (string, required): Path for the item (e.g., "/config/settings.json")
- `content` (any, required): Item content (string, object, array, etc.)
- `scope` (string, optional): "company", "session", or "agent" (default: "agent")
- `scopeId` (string, optional): ID for the scope (required for session/agent)
- `metadata` (object, optional): Additional metadata

**Example (Agent Scope):**
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "add_workspace_item",
    "arguments": {
      "itemPath": "/config/settings.json",
      "content": {
        "theme": "dark",
        "notifications": true
      },
      "scope": "agent",
      "scopeId": "Test MCP Agent",
      "metadata": {
        "contentType": "application/json",
        "description": "User preferences"
      }
    }
  },
  "id": 9
}
```

**Example (Company Scope):**
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "add_workspace_item",
    "arguments": {
      "itemPath": "/policies/data-retention.json",
      "content": {
        "retentionDays": 90,
        "autoArchive": true
      },
      "scope": "company"
    }
  },
  "id": 10
}
```

#### 10. `get_workspace_item`
Get a specific workspace item.

**Parameters:**
- `itemPath` (string, required): Path of the item to retrieve
- `scope` (string, optional): "company", "session", or "agent" (default: "agent")
- `scopeId` (string, optional): ID for the scope (required for session/agent)

**Example:**
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "get_workspace_item",
    "arguments": {
      "itemPath": "/config/settings.json",
      "scope": "agent",
      "scopeId": "Test MCP Agent"
    }
  },
  "id": 11
}
```

#### 11. `list_workspace_items`
List workspace items with optional prefix filtering.

**Parameters:**
- `scope` (string, optional): "company", "session", or "agent" (default: "agent")
- `scopeId` (string, optional): ID for the scope (required for session/agent)
- `prefix` (string, optional): Path prefix to filter items

**Example:**
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "list_workspace_items",
    "arguments": {
      "scope": "company",
      "prefix": "/policies"
    }
  },
  "id": 12
}
```

#### 12. `delete_workspace_item`
Delete a workspace item.

**Parameters:**
- `itemPath` (string, required): Path of the item to delete
- `scope` (string, optional): "company", "session", or "agent" (default: "agent")
- `scopeId` (string, optional): ID for the scope (required for session/agent)

**Example:**
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "delete_workspace_item",
    "arguments": {
      "itemPath": "/config/settings.json",
      "scope": "agent",
      "scopeId": "Test MCP Agent"
    }
  },
  "id": 13
}
```

### Team Management

#### 13. `list_teams`
List all teams for the authenticated company.

**Parameters:** None

**Example:**
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "list_teams"
  },
  "id": 14
}
```

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

## Error Codes

- `-32600`: Invalid Request
- `-32601`: Method Not Found (unknown tool)
- `-32602`: Invalid Params (validation failed)
- `-32603`: Internal Error
- `401`: Authentication required (no WWW-Authenticate header)
