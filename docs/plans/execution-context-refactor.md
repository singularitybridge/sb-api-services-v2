# Execution Context Refactor Plan

## Problem Statement

The `executeFunctionCall` function in `executors.ts` derives execution context by looking up a session from the database. This fails when `sessionId` is `"stateless_execution"` because it's not a valid MongoDB ObjectId.

**Current broken flow:**
```
debug_triggerIntegrationAction(sessionId="stateless_execution")
  → triggerAction(sessionId, companyId, ...)
    → executeFunctionCall(sessionId, companyId, ...)
      → getSessionById("stateless_execution")  ❌ FAILS
```

**Impact:** ALL integration actions fail when called via `debug_triggerIntegrationAction` in stateless execution mode.

---

## Current Architecture Analysis

### What Works (Context-First)

**Stateless Execution** (`stateless-execution.service.ts:317-325`):
```typescript
const actionContext = {
  sessionId: 'stateless_execution',
  companyId,
  language: assistant.language as SupportedLanguage,
  userId,
  assistantId: assistant._id.toString(),
  isStateless: true,
};
// → createFunctionFactory(actionContext, allowedActions)
// → Tools work fine!
```

**Session Execution** (`message-handling.service.ts:392-399`):
```typescript
const actionContext = {
  sessionId: sessionId.toString(),
  companyId: session.companyId.toString(),
  language: session.language as SupportedLanguage,
  userId: session.userId.toString(),
  assistantId: assistant._id.toString(),
};
// → createFunctionFactory(actionContext, allowedActions)
// → Tools work fine!
```

### What's Broken (Session-Derived)

**executeFunctionCall** (`executors.ts:100-126`):
```typescript
export const executeFunctionCall = async (
  call: FunctionCall,
  sessionId: string,      // ← Only receives sessionId
  companyId: string,
  allowedActions: string[],
) => {
  // ❌ Tries to DERIVE context from session lookup
  const session = await getSessionById(sessionId);  // FAILS for "stateless_execution"
  const currentSession = await getCurrentSession(session.userId, companyId);
  // ... builds context from session data
};
```

---

## Proposed Solution: Context-First executeFunctionCall

### Option B: Unified on ActionContext

Modify `executeFunctionCall` to accept `ActionContext` directly, with backward compatibility for session-based calls.

### Phase 1: Add Context-First Overload

**File: `src/integrations/actions/executors.ts`**

```typescript
// NEW: Context-first execution (primary path)
export const executeFunctionCallWithContext = async (
  call: FunctionCall,
  context: ActionContext,
  allowedActions: string[],
): Promise<{ result?: unknown; error?: DetailedError }> => {
  console.log(
    `[executeFunctionCall] Starting execution with context:`,
    { sessionId: context.sessionId, companyId: context.companyId, isStateless: context.isStateless }
  );

  let functionFactory: FunctionFactory;
  try {
    functionFactory = await createFunctionFactory(context, allowedActions);
  } catch (error) {
    console.error('[executeFunctionCall] Critical error creating function factory:', error);
    functionFactory = {};
  }

  // ... rest of execution logic (same as current, but using context directly)
};

// LEGACY: Session-derived execution (backward compatible)
export const executeFunctionCall = async (
  call: FunctionCall,
  sessionId: string,
  companyId: string,
  allowedActions: string[],
): Promise<{ result?: unknown; error?: DetailedError }> => {
  // Build context from session (existing logic)
  const session = await getSessionById(sessionId);
  const currentSession = await getCurrentSession(session.userId, companyId);
  const activeSessionId = currentSession ? currentSession._id.toString() : sessionId;
  const updatedSession = await getSessionById(activeSessionId);

  const context: ActionContext = {
    sessionId: activeSessionId,
    companyId,
    language: updatedSession.language as SupportedLanguage,
    assistantId: updatedSession.assistantId?.toString(),
    userId: updatedSession.userId?.toString(),
    isStateless: false,
  };

  return executeFunctionCallWithContext(call, context, allowedActions);
};
```

### Phase 2: Update triggerAction

**File: `src/services/integration.service.ts`**

```typescript
// NEW: Context-first trigger
export async function triggerActionWithContext(
  integrationName: string,
  service: string,
  data: any,
  context: ActionContext,
  allowedActions: string[],
): Promise<IntegrationActionResult> {
  const fullServiceId = sanitizeFunctionName(`${integrationName}.${service}`);
  const call = {
    function: {
      name: fullServiceId,
      arguments: JSON.stringify(data),
    },
  };
  const sanitizedAllowedActions = allowedActions.map(sanitizeFunctionName);

  const result = await executeFunctionCallWithContext(call, context, sanitizedAllowedActions);

  if (result.error) {
    return { success: false, error: result.error.message };
  }
  return { success: true, data: result.result };
}

// LEGACY: Keep for backward compatibility
export async function triggerAction(
  integrationName: string,
  service: string,
  data: any,
  sessionId: string,
  companyId: string,
  allowedActions: string[],
): Promise<IntegrationActionResult> {
  // ... existing implementation (calls executeFunctionCall)
}
```

### Phase 3: Update debug.service.ts

**File: `src/integrations/debug/debug.service.ts`**

```typescript
export const triggerIntegrationAction = async (
  sessionId: string,
  companyId: string,
  integrationName: string,
  service: string,
  data: any,
  // NEW: Optional context override
  contextOverride?: Partial<ActionContext>,
): Promise<{ success: boolean; data?: any; error?: string }> => {
  try {
    const fullFunctionName = `${integrationName}.${service}`;
    const allowedActions: string[] = [fullFunctionName];

    // Build context - use override if provided, otherwise try session lookup
    let context: ActionContext;

    if (contextOverride || sessionId === 'stateless_execution' || !isValidObjectId(sessionId)) {
      // Stateless mode - build context from available data
      context = {
        sessionId,
        companyId,
        language: contextOverride?.language || 'en',
        userId: contextOverride?.userId,
        assistantId: contextOverride?.assistantId,
        isStateless: true,
        ...contextOverride,
      };
    } else {
      // Session mode - lookup and build context
      const session = await Session.findById(sessionId);
      if (!session) throw new Error('Session not found');
      context = {
        sessionId,
        companyId,
        language: session.language as SupportedLanguage,
        userId: session.userId?.toString(),
        assistantId: session.assistantId?.toString(),
        isStateless: false,
      };
    }

    const result = await triggerActionWithContext(
      integrationName,
      service,
      data,
      context,
      allowedActions,
    );

    return {
      success: result.success,
      data: result.data,
      error: result.error,
    };
  } catch (error: any) {
    console.error('Error in triggerIntegrationAction:', error);
    return {
      success: false,
      error: error.message || 'Failed to trigger integration action',
    };
  }
};
```

### Phase 4: Pass Context from Stateless Execution

**File: `src/services/assistant/stateless-execution.service.ts`**

When building tools for stateless execution, ensure the ActionContext is passed to any tool that might call `triggerIntegrationAction`:

```typescript
// In tool execution for debug_triggerIntegrationAction
execute: async (args: any) => {
  return debugService.triggerIntegrationAction(
    actionContext.sessionId,
    actionContext.companyId,
    args.integrationName,
    args.service,
    JSON.parse(args.requestData),
    actionContext,  // Pass full context
  );
}
```

---

## Implementation Order

### Step 1: Add new functions (non-breaking) ✅ COMPLETE
- [x] Add `executeFunctionCallWithContext` to `executors.ts`
- [x] Add `triggerActionWithContext` to `integration.service.ts`
- [x] Add helper `isValidObjectId` check

### Step 2: Update debug service ✅ COMPLETE
- [x] Modify `triggerIntegrationAction` to accept optional context
- [x] Add stateless detection logic
- [x] Use `triggerActionWithContext` when context is available

### Step 3: Test ✅ COMPLETE (2026-01-24)
- [x] Test stateless execution with workspace actions
- [x] Test session-based execution still works
- [x] Test MCP execute endpoint
- [x] Test debug.triggerIntegrationAction with company scope

### Step 4: Cleanup (optional, later)
- [ ] Deprecate `executeFunctionCall` in favor of `executeFunctionCallWithContext`
- [ ] Update all callers to use context-first approach

---

## Testing Plan

### Test 1: Stateless Workspace Action
```bash
# Via MCP execute
mcp__agent-hub-sb__execute({
  assistantId: "integration-testing-agent",
  userInput: "Use storeContent to store at company scope: path='test/stateless-test.md', content='test', scope='company'"
})
```

### Test 2: Session-Based Execution
```bash
# Verify existing session-based chat still works
# Send message to an agent in a real session
```

### Test 3: Direct triggerIntegrationAction
```bash
# Test the debug action directly
node -e "
const { triggerIntegrationAction } = require('./src/integrations/debug/debug.service');
triggerIntegrationAction(
  'stateless_execution',
  'companyId',
  'unified_workspace',
  'storeContent',
  { path: 'test.md', content: 'test', scope: 'company' }
).then(console.log);
"
```

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Breaking existing session-based execution | Keep legacy functions, add new context-first ones |
| Missing context fields in stateless mode | Default to sensible values (language: 'en') |
| Pusher notifications fail for stateless | Already non-critical, logged but don't block |
| Tool caching issues | Stateless doesn't use user-based cache keys anyway |

---

## Success Criteria

1. ✅ Agents can call `storeContent` with company scope via stateless execution
2. ✅ Agents can call ANY integration action via stateless execution
3. ✅ Session-based execution continues to work unchanged
4. ✅ No database lookups fail for "stateless_execution" sessionId

---

## Future Improvements

1. **Deprecate session-derived path**: Once all callers migrate to context-first, remove the legacy functions
2. **Unified context builder**: Create a single `buildExecutionContext()` function used by all entry points
3. **Context validation**: Add runtime validation that required context fields are present
4. **OpenTelemetry integration**: Add tracing spans for context propagation
