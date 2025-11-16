# System Agents Framework

## Overview

The System Agents Framework provides a centralized, manageable way to define and reuse AI prompts and configurations across the application. Instead of hardcoding prompts in the codebase, agents are stored as declarative configurations that can be easily updated, versioned, and shared.

## Directory Structure

```
.agents/
├── README.md                                    # This file
├── sys-team-avatar-generator/                   # System agent example
│   ├── config.json                             # Agent configuration
│   └── prompt.md                               # Prompt template
└── sys-{agent-name}/                           # Additional system agents
    ├── config.json
    └── prompt.md
```

## Agent Types

### System Agents (`sys-*`)
- **Prefix:** `sys-`
- **Purpose:** Built-in agents used by the application core features
- **Examples:**
  - `sys-team-avatar-generator` - Generates team avatars
  - `sys-code-reviewer` - Reviews code changes
  - `sys-email-composer` - Composes professional emails

### Custom Agents (Future)
- **Prefix:** `custom-`
- **Purpose:** User or company-specific agents
- **Use Case:** Companies can create their own agents for specific workflows

## Configuration Schema

### config.json

```json
{
  "id": "sys-agent-name",
  "name": "Human Readable Name",
  "description": "What this agent does",
  "version": "1.0.0",
  "type": "text-generation | image-generation | audio-generation | embedding",
  "provider": "openai | anthropic | google | custom",
  "model": "gpt-4 | dall-e-3 | claude-3-opus | etc",
  "config": {
    "model": "model-name",
    "temperature": 0.7,
    "max_tokens": 1000,
    "...": "provider-specific options"
  },
  "parameters": {
    "paramName": {
      "type": "string | number | boolean",
      "required": true,
      "description": "What this parameter does",
      "default": "optional default value"
    }
  },
  "metadata": {
    "createdAt": "2025-01-30",
    "category": "system | custom",
    "tags": ["tag1", "tag2"],
    "cost": {
      "perRequest": 0.04,
      "currency": "USD",
      "model": "pricing-model-name"
    }
  }
}
```

### prompt.md

The prompt file contains the actual prompt template with placeholders:

```markdown
# Agent Name - Prompt Template

## Base Prompt Structure

Your prompt with {{parameterName}} placeholders.

You can use {{teamName}} and {{teamPurpose}} which will be replaced
with actual values when generating the prompt.

---

## Documentation

Add examples, notes, and guidance here.
This section is not included in the final prompt.

## Example Prompts

Show how the prompt looks with real values.
```

## Usage

### Backend (Node.js/TypeScript)

```typescript
import { getSystemAgentService } from '../services/system-agent.service';

// Get the agent service
const agentService = getSystemAgentService();

// Load an agent
const agent = agentService.getAgent('sys-team-avatar-generator');

// Generate a prompt from template
const prompt = agentService.generatePrompt('sys-team-avatar-generator', {
  teamName: 'Engineering',
  teamPurpose: 'Building scalable infrastructure',
  styleIndex: 0
});

// Use with OpenAI
const response = await openai.images.generate({
  ...agent.config.config,
  prompt: prompt
});
```

### API Endpoint Example

```typescript
// POST /api/teams/generate-avatars
export const generateTeamAvatars = async (req, res) => {
  const { teamName, teamPurpose } = req.body;
  const agentService = getSystemAgentService();

  const avatars = [];

  // Generate 9 variations with different styles
  for (let i = 0; i < 9; i++) {
    const prompt = agentService.generatePrompt('sys-team-avatar-generator', {
      teamName,
      teamPurpose,
      styleIndex: i
    });

    const image = await generateDallEImage(prompt);
    avatars.push(image);
  }

  res.json({ avatars });
};
```

## Agent Service API

### Core Methods

```typescript
// Get a specific agent
getAgent(agentId: string): SystemAgent | null

// Get all agents
getAllAgents(): SystemAgent[]

// Reload agent from disk (hot reload)
reloadAgent(agentId: string): SystemAgent | null

// Reload all agents
reloadAllAgents(): void

// Generate prompt with parameters
generatePrompt(agentId: string, params: Record<string, any>): string

// Validate agent configuration
validateAgent(agentId: string): { valid: boolean; errors: string[] }

// Get agent metadata only
getAgentMetadata(agentId: string): SystemAgentConfig | null
```

### Query Methods

```typescript
// Get agents by category
getAgentsByCategory(category: string): SystemAgent[]

// Get agents by type
getAgentsByType(type: 'text-generation' | 'image-generation'): SystemAgent[]

// Get agents by tag
getAgentsByTag(tag: string): SystemAgent[]
```

## Creating a New System Agent

### 1. Create Directory

```bash
mkdir .agents/sys-your-agent-name
```

### 2. Create config.json

```json
{
  "id": "sys-your-agent-name",
  "name": "Your Agent Name",
  "description": "What it does",
  "version": "1.0.0",
  "type": "text-generation",
  "provider": "openai",
  "model": "gpt-4",
  "config": {
    "model": "gpt-4",
    "temperature": 0.7,
    "max_tokens": 1000
  },
  "parameters": {
    "input": {
      "type": "string",
      "required": true,
      "description": "User input"
    }
  },
  "metadata": {
    "createdAt": "2025-01-30",
    "category": "system",
    "tags": ["utility"]
  }
}
```

### 3. Create prompt.md

```markdown
# Your Agent Name

## Base Prompt Structure

Your prompt template with {{input}} placeholders.

---

## Notes

Additional documentation and examples.
```

### 4. Test the Agent

```typescript
const agentService = getSystemAgentService();
const agent = agentService.getAgent('sys-your-agent-name');

// Validate configuration
const validation = agentService.validateAgent('sys-your-agent-name');
console.log(validation);

// Generate prompt
const prompt = agentService.generatePrompt('sys-your-agent-name', {
  input: 'test value'
});
console.log(prompt);
```

## Benefits

✅ **Centralized Management:** All prompts in one place
✅ **Version Control:** Track changes to prompts via git
✅ **Easy Updates:** No code deployment needed to update prompts
✅ **Reusability:** Share agents across features
✅ **Type Safety:** TypeScript interfaces for configs
✅ **Hot Reload:** Reload agents without restarting server
✅ **Documentation:** Prompts are self-documented
✅ **Override Support:** Companies can override system agents (future)
✅ **Cost Tracking:** Built-in cost metadata

## Best Practices

1. **Naming Convention:** Use `sys-` prefix for system agents
2. **Versioning:** Update version in config.json when changing prompts
3. **Documentation:** Add examples and notes in prompt.md
4. **Parameters:** Define all parameters in config.json with types
5. **Testing:** Validate agents after creation
6. **Templates:** Use `{{paramName}}` for placeholders
7. **Sections:** Separate prompt from documentation with `---`

## Future Enhancements

- [ ] Company-level agent overrides
- [ ] Web UI for agent management
- [ ] Agent versioning and rollback
- [ ] Usage analytics per agent
- [ ] A/B testing different prompt variations
- [ ] Automatic prompt optimization based on feedback
- [ ] Multi-language support for prompts
- [ ] Agent marketplace (share/discover agents)

## Related Files

- **Service:** `src/services/system-agent.service.ts`
- **Types:** Defined in system-agent.service.ts
- **Example Usage:** Team creation wizard (`src/services/team.service.ts`)

## Support

For questions or issues with system agents, contact the platform team or open an issue in the repository.
