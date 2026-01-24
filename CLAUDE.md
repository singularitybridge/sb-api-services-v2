## Claude Code Sub-Agents Management

### Sub-Agent Location & Structure
- **User agents**: `~/.claude/agents/[agent-name].md`
- **Project agents**: `.claude-agents/[agent-name].md` (version controlled)
- **Format**: YAML frontmatter + Markdown content
- **Key Fields**: name, description, model (e.g., sonnet), color

### Project Agents Setup
This project includes shared agents in `.claude-agents/`. To install them:
```bash
./scripts/setup-claude-agents.sh
```

**Available Project Agents:**
- `pricing-validator`: Validates AI model pricing against LiteLLM (see Monthly Tasks below)

### Creating & Managing Sub-Agents
1. **Create Agent**: Use `/agents` command in Claude Code
2. **Update Agent**: Edit the `.md` file directly at `~/.claude/agents/`
3. **Trigger Agent**: Use `Task` tool with `subagent_type` parameter
4. **Available Agents**:
   - `alfred-agent-manager`: AI system orchestration and testing
   - `pricing-validator`: AI model pricing validation (project agent)
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

### User Invite System (October 2025)

#### Overview
Complete invite-based user onboarding system with company assignment and auto-signup control.

#### Security & Configuration
- **ALLOW_AUTO_SIGNUP** environment variable controls automatic company creation
  - Default: `false` (production-safe - requires invite)
  - Set to `true` to allow users without invites to create new companies
  - Located in `.env` and `.env.example`

#### Components
- **MongoDB Model**: `Invite` at `/src/models/Invite.ts`
  - Secure token generation (nanoid, 132-bit entropy)
  - TTL index for automatic cleanup (7-day expiration)
  - Status tracking: pending, accepted, revoked, expired
  - Rate limiting: max 3 resends per invite
- **Service**: `invite.service.ts` - Business logic and validations
- **Routes**: `/api/invites/*` endpoints
- **Google OAuth Integration**: Auto-assignment to inviter's company

#### API Endpoints
```
POST   /api/invites              - Create new invite
GET    /api/invites              - List invites (with pagination & filters)
GET    /api/invites/:id          - Get specific invite
DELETE /api/invites/:id/revoke   - Revoke pending invite
```

#### Test Utilities
```bash
# Comprehensive test suite
node test-invite-system.js

# Quick bash tests
./quick-test-invite.sh
```

#### Features
- **Email Validation**: Using validator.js library
- **Duplicate Prevention**: MongoDB unique index on email+company+status
- **Rate Limiting**: 10 invites/hour per user
- **Metadata Tracking**: IP, user agent, invite source
- **Transaction Support**: Atomic invite acceptance
- **Email Enumeration Prevention**: Generic error messages
- **Auto-signup Control**: Environment variable to disable new company creation

### Prompt History System (January 2025)

#### Overview
Complete version control system for AI assistant prompts with automatic change tracking and AI-generated descriptions.

#### Components
- **MongoDB Model**: `PromptHistory` at `/src/models/PromptHistory.ts`
- **Services**: 
  - `prompt-history.service.ts` - Core CRUD operations and version management
  - `prompt-change-description.service.ts` - OpenAI GPT-4o-mini integration for change descriptions
- **Routes**: `/api/assistants/:id/prompt-history/*` endpoints
- **Automatic Tracking**: Integrated in assistant POST and PUT routes

#### API Endpoints
```
GET    /api/assistants/:id/prompt-history              - List all versions
GET    /api/assistants/:id/prompt-history/:version     - Get specific version
GET    /api/assistants/:id/prompt-history/compare      - Compare versions (?v1=X&v2=Y)
POST   /api/assistants/:id/prompt-history/:version/rollback - Rollback to version
GET    /api/assistants/:id/prompt-history/statistics   - Version statistics
DELETE /api/assistants/:id/prompt-history/cleanup      - Delete old versions (admin only)
```

#### Test Utilities
Located at `/tests/integration/ai-agent/testing-utils/test-prompt-history.js`

Usage:
```bash
# List prompt history
node test-prompt-history.js list <assistantId> [limit]

# Get specific version
node test-prompt-history.js get <assistantId> <version>

# Compare versions
node test-prompt-history.js compare <assistantId> <v1> <v2>

# Rollback to version
node test-prompt-history.js rollback <assistantId> <version>

# Get statistics
node test-prompt-history.js stats <assistantId>
```

#### Features
- **Automatic Version Numbering**: Sequential per assistant
- **AI Change Descriptions**: GPT-4o-mini analyzes and describes changes
- **Metadata Tracking**: Character count, line count, token estimate
- **Change Types**: initial, update, rollback
- **Company Isolation**: Each company's prompts are isolated
- **Fallback Handling**: Basic descriptions when OpenAI unavailable

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

#### Monthly Task: Pricing Validation
**Frequency**: Monthly (or when working on cost-tracking code)
**Agent**: `pricing-validator`

AI model pricing changes periodically. Run the pricing validator to ensure our costs are accurate:

1. **Automatic** (when using Claude Code on cost-tracking):
   - The `pricing-validator` agent should be triggered proactively
   - Compares `src/utils/cost-tracking.ts` against LiteLLM pricing database

2. **Manual validation**:
   ```bash
   # Fetch current LiteLLM prices
   curl -s "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json" | jq '.["gpt-4o", "claude-3-5-sonnet-20241022"]'
   ```

3. **Update process**:
   - Update `MODEL_PRICING` in `src/utils/cost-tracking.ts`
   - Update the "Pricing last validated" comment with current date
   - LiteLLM prices are per-token; our file uses per-1000-tokens (multiply by 1000)

**Source**: https://github.com/BerriAI/litellm (matches official OpenAI/Anthropic/Google prices)

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

### MCP Tools Versioning (January 2025)

#### Overview
MCP server supports `list_changed` notifications to help clients detect when tools have been updated after deployment.

#### Location
- **Version Constant**: `TOOLS_VERSION` in `/src/mcp/http-server.ts` (line ~287)
- **Format**: `YYYY-MM-DD-vN` (e.g., `2026-01-24-v1`)

#### When to Update TOOLS_VERSION
**IMPORTANT**: Update `TOOLS_VERSION` whenever you:
- Add a new MCP tool
- Remove an MCP tool
- Change a tool's name, description, or input schema
- Modify tool behavior significantly

#### How It Works
1. Server advertises `listChanged: true` capability
2. `X-MCP-Tools-Version` header included in `initialize` and `tools/list` responses
3. MCP clients can compare versions to detect changes
4. Clients supporting `list_changed` will auto-refresh their tool cache

#### Deployment Workflow
```bash
# 1. Add/modify MCP tools in /src/mcp/tools/

# 2. Update version in http-server.ts
const TOOLS_VERSION = '2026-01-25-v1';  # Increment date or version

# 3. Commit and push
git add . && git commit -m "Add new MCP tool X" && git push

# 4. After deployment, clients will detect the version change
```

#### Current Tools (36 total)
Agent management, workspace, teams, integrations, costs, prompt history, and UI control tools. See `http-server.ts` for full list.

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

### Local Development with PM2
Both frontend and backend run via PM2 for local development:

**Services:**
- `sb-api` - Backend API (port 3000)
- `sb-ui` - Frontend UI (Vite dev server)

**Common Commands:**
```bash
# View all processes
pm2 list

# View logs (last N lines)
pm2 logs sb-api --lines 50
pm2 logs sb-ui --lines 50

# Restart services
pm2 restart sb-api
pm2 restart sb-ui
pm2 restart all

# Stop/Start services
pm2 stop sb-api
pm2 start sb-api

# Monitor in real-time
pm2 monit
```

**Troubleshooting:**
- If a service shows "online" but doesn't respond, check logs for `[nodemon] app crashed`
- Use `pm2 restart sb-api` to recover from crashes
- WebSocket server runs on the same port as API: `ws://localhost:3000/realtime`

## Code Execution Integration (January 2025)

### Overview
Integrated OpenAI Code Interpreter for Python-based file processing with unified file management system.

### Core Components

#### 1. File Manager Service (`file-manager.service.ts`)
Unified file management with scope-based storage:

| Scope | TTL | Storage | Use Case |
|-------|-----|---------|----------|
| **temporary** | 10 min | Memory | Code execution outputs |
| **session** | 24 hours | Disk | Session working files |
| **agent** | 7 days | Disk | Agent test files |
| **team** | 30 days | GCP | Team resources |
| **company** | Permanent | GCP | Long-term docs |

#### 2. OpenAI Code Execution (`openai-code-execution.service.ts`)
- Uses OpenAI Assistants API with code_interpreter tool
- Default model: `gpt-4o-mini`
- Supports file URLs and base64 content
- Auto-cleanup of resources

#### 3. API Endpoints
```
# File Management
POST   /files/upload          - Upload with scope
GET    /files/:id/download    - Download file (no auth)
GET    /files/list            - List by scope
GET    /files/agent/:agentId  - Agent files
GET    /files/session/:id     - Session files
DELETE /files/:id             - Delete file

# Code Execution Actions
- executeCode: Custom Python code on files
- processFile: Predefined operations (analyze, transform, parse_excel)
```

### Usage Examples

#### Process CSV with URL:
```javascript
{
  userInput: "Process data from: http://example.com/data.csv
              Use executeCode with fileUrl parameter",
  // Agent will extract URL and use it
}
```

#### Process Excel:
```javascript
{
  userInput: "Parse Excel: http://example.com/data.xlsx
              Use processFile with operation='parse_excel'",
}
```

### Testing with Sub-Agent
Use the `code-execution-expert` sub-agent:
```javascript
await Task({
  subagent_type: 'code-execution-expert',
  description: 'Test code execution',
  prompt: 'Run comprehensive tests on CSV and Excel processing'
});
```

### File Storage Architecture
- **ContentFile**: Permanent GCP storage (existing)
- **FileManager**: Unified ephemeral/permanent storage (new)
- No duplication - different purposes

# Documentation Maintenance

### Updating Docs Before Pushing
**IMPORTANT**: Before pushing significant changes to remote, update the documentation project:

1. Navigate to `/Users/avio/dev/sb/sb-docs`
2. Update `/docs/changelog.md` with your changes under `[Unreleased]`
3. Update relevant documentation pages if APIs/features changed
4. Run `npm run build` to verify no broken links

### Categories for Changelog
- **Added** - New features, endpoints, integrations
- **Changed** - Modified behavior, API changes, refactoring
- **Fixed** - Bug fixes
- **Removed** - Deprecated features
- **Security** - Security improvements

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.