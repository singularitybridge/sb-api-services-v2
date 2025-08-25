## Claude Code Sub-Agents Management

### Sub-Agent Location & Structure
- **Location**: `/Users/avi/.claude/agents/[agent-name].md`
- **Format**: YAML frontmatter + Markdown content
- **Key Fields**: name, description, model (e.g., sonnet), color

### Creating & Managing Sub-Agents
1. **Create Agent**: Use `/agents` command in Claude Code
2. **Update Agent**: Edit the `.md` file directly at `~/.claude/agents/`
3. **Trigger Agent**: Use `Task` tool with `subagent_type` parameter
4. **Available Agents**: 
   - `alfred-agent-manager`: AI system orchestration and testing
   - Custom agents can be created for specific domains

### Testing Sub-Agents with Testing Utilities
Located at `/Users/avi/dev/avio/sb/sb-api-services-v2/tests/integration/ai-agent/testing-utils/`:

#### Core Testing Scripts
- **`list-assistants.js`** - List all API assistants with IDs
- **`get-assistant-details.js <id>`** - Read assistant configuration and prompt
- **`update-assistant-prompt.js <id>`** - Update assistant prompts
- **`execute.js <id> "message"`** - Execute stateless requests
- **`set-assistant.js <id> [sessionId]`** - Set assistant for session

#### Usage Examples
```bash
# List all assistants
node list-assistants.js

# Read assistant prompt
node get-assistant-details.js 681b41850f470a9a746f280e

# Execute test query
node execute.js 681b41850f470a9a746f280e "What are your capabilities?"

# Update assistant prompt (now supports file input)
node update-assistant-prompt.js 681b41850f470a9a746f280e
# Or with file:
node update-assistant-prompt.js 681b41850f470a9a746f280e prompt-file.txt

# Test search capabilities
node execute.js 681b41850f470a9a746f280e "Find issues about ask assistant action"
```

### Alfred Agent Manager
The `alfred-agent-manager` is equipped to:
- Test AI assistants using the testing utilities
- Read and modify agent prompts programmatically
- Execute comprehensive test scenarios
- Manage multi-agent workflows
- Debug agent behavior issues

### AI Developer Chat System
- **Location**: `/Users/avi/dev/scytale/ai-scytale/ai-evidence/chat.md`
- **Purpose**: Multi-AI collaboration for debugging and issue resolution
- **Participants**:
  - Claude-Frontend: Frontend webapp developer
  - Claude-Backend: Control service developer
  - Claude-Views: Views service/API gateway developer
  - Claude-AgentHub: Agent Hub backend specialist (me)
- **Chat Viewer**: HTML viewer at `chat-viewer.html` for browser viewing
- **Recent Resolution**: Fixed image attachment format - requires `data:image/png;base64,` prefix

### AI Assistants & Voice Integration

#### Anat - Product Manager Agent
- **Assistant ID**: `681b41850f470a9a746f280e`
- **Role**: Product management, JIRA operations, agile methodologies
- **Key Improvements**: 
  - Intelligent search handling with automatic fallbacks
  - No longer requires projectKey for searches
  - Handles technical term variations (ask_assistant, askAssistant, etc.)
  - Parameter validation with user-friendly prompts
- **Test Suites**: 
  - `test-jira-integration.js` - Basic functionality tests
  - `test-jira-extended.js` - Comprehensive feature tests
  - `test-jira-edge-cases.js` - Edge case validation
  - `test-anat-validation.js` - Parameter validation tests
  - `test-anat-edge-cases.js` - Edge case handling

#### VAPI Voice Assistant Integration
- **Prompt Location**: `tests/integration/ai-agent/testing-utils/vapi-improved-prompt.txt`
- **Key Principles**:
  - Autonomous decision making (minimal clarification questions)
  - Rich initial requests with multiple search strategies
  - Context persistence across conversation
  - Speed over precision for voice UX
- **Integration**: Voice layer (Jordan) → Anat (execution layer)

## Recent Updates (January 2025)

### Vercel AI SDK V5 Migration ✅
- Successfully migrated from V4 to V5 with minimal changes
- Fixed TypeScript memory issues by importing Zod as `'zod/v3'`
- Replaced deprecated `maxSteps` with `stopWhen: stepCountIs(n)`
- Maintained backwards compatibility for `maxTokens`/`maxOutputTokens`
- Streaming and non-streaming requests working perfectly

### AI Cost Tracking System 🎯
**Complete cost tracking implementation with MongoDB persistence and REST API**

#### Database & Models
- Created `CostTracking` MongoDB model at `/src/models/CostTracking.ts`
- Tracks: company, assistant, user, model, tokens, costs, duration, provider
- Automatic cost calculation based on model pricing

#### Service Layer
- Cost tracking service at `/src/services/cost-tracking.service.ts`
- Functions: `saveCostTracking`, `getCostSummary`, `getDailyCosts`
- Aggregation by model, provider, and assistant with friendly names

#### API Endpoints
Routes at `/src/routes/cost-tracking.routes.ts`:
- `GET /api/costs` - Filtered cost records with pagination
- `GET /api/costs/summary` - Aggregated costs with breakdowns
- `GET /api/costs/daily` - Daily cost trends
- `GET /api/costs/by-assistant/:id` - Assistant-specific costs
- `GET /api/costs/by-model/:model` - Model-specific costs

#### Real-time Logging & Insights
- Console logs show: Company ID, Assistant ID/Name, Model, Tokens, Cost
- O3 model warnings (30-200+ second response times)
- CSV processing progress indicators
- Streaming chunk updates for long operations

#### UI/UX Documentation
- **Product Specification**: `/docs/cost-tracking-feature-guide.md`
  - Complete replacement for sessions menu
  - Detailed shadcn/ui component specifications
  - Lucide icon integration throughout
  - Responsive table layout with filtering
  - 4-week phased migration plan
- **API Documentation**: `/docs/cost-tracking-api-guide.md`
  - All endpoints with request/response examples
  - React component examples
  - TypeScript interfaces
  - Custom hooks for data fetching

#### Test Utilities
- `/test-costs-api.js` - Comprehensive API testing
- `/test-costs-curl.sh` - Quick curl-based verification

### AI Assistant Access Tracking
- Added `lastAccessedAt` field to Assistant model for usage tracking
- Automatically updates when assistant is accessed via:
  - Execute endpoint (`/api/assistants/:id/execute`)
  - Session message handling
- GET `/api/assistants` endpoint now supports sorting:
  - `?sortBy=name` - Alphabetical by name (default)
  - `?sortBy=lastUsed` - By most recently accessed

### OpenAI Integration Cleanup
- Removed deprecated O1 model actions (`askO1Model`, `askO1ModelWithFiles`)
- O1 models (o1-preview, o1-mini) are no longer supported
- Remaining OpenAI actions:
  - `generateOpenAiSpeech` - Text-to-speech generation
  - `transcribeAudioWhisperFromURL` - Audio transcription
  - `webSearch` - Web search capabilities

## AI Context Service Integration

- Located at @src/integrations/ai_context_service for integration logic
- Reference @docs/integrations_framework for understanding the integrations framework
- Context item creation endpoint: `POST /context/ai_context_service/controls/items`
- Supports flexible field structure with optional `id`
- Sample request includes:
  - `id`: Optional unique identifier (UUID)
  - `key`: Unique control key
  - `data`: Object with name and description
  - `metadata`: Additional categorization info
  - `tags`: Categorization tags

## Infrastructure & Deployment

### Server Environment
- **Provider**: Hetzner Cloud (Germany)
- **Current Server**: CX32 (4 vCPU Intel, 8GB RAM, 80GB NVMe)
- **Previous**: CPX21 (3 vCPU AMD, 4GB RAM) - upgraded due to build resource constraints
- **Access**: SSH root@135.181.95.194
- **Deployment Platform**: Coolify (self-hosted PaaS)
- **Domain**: api.singularitybridge.net (HTTPS)

### Build & Deployment Process
- **Build System**: Multi-stage Dockerfile (replaced Nixpacks due to environment mismatches)
- **Node Version**: 21-slim in Docker
- **TypeScript Build**: Memory limited with NODE_OPTIONS='--max-old-space-size=2048'
- **Auto-deploy**: GitHub push triggers Coolify deployment
- **Important**: Always use capital 'D' Dockerfile, not lowercase

### Known Issues & Solutions

#### Google OAuth IPv6 Solution
Google blocks IPv4 requests from Hetzner data center IPs. Solution implemented:
```javascript
// Force IPv6 for Google APIs
const httpsAgent = new https.Agent({
  family: 6, // Force IPv6
});
```
This bypasses the 403 Forbidden errors from Google APIs.

#### Build Performance
- TypeScript compilation can be memory-intensive
- Multi-stage Docker build prevents OOM issues
- Local builds use Docker, ensuring parity with production

### Performance Characteristics
- Handles 50+ concurrent requests without issues
- Typical memory usage: ~800MB
- CPU usage remains low even under load
- 4GB swap space configured as safety buffer

### Development Workflow
1. Local development with `npm run dev`
2. Test Docker build locally: `docker build -t test .`
3. Git push triggers automatic Coolify deployment
4. Monitor deployment logs in Coolify dashboard
5. SSH access available for troubleshooting

### Key Commands
- Check server resources: `ssh root@135.181.95.194 'free -h && df -h /'`
- Monitor containers: `docker stats`
- View logs: `docker logs [container-name] --tail 50`
- Test build locally: `docker build -t sb-api-test .`

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.