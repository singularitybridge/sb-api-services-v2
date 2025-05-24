# Session ID Fix Verification Guide

## Overview
This guide helps verify that the session ID mismatch issue for action execution messages has been resolved.

## Fix Summary
The fix ensures that action execution messages use the current request's session ID instead of a cached one:

1. **Location**: `src/services/assistant/message-handling.service.ts`
2. **Implementation**: Each tool's `executeFunc` now:
   - Fetches the current session using `Session.findById(sessionId)` 
   - Passes the current session ID to `executeFunctionCall`

## Enhanced Logging Added
To help trace the session ID flow, logging has been added to:

1. **message-handling.service.ts**:
   - `[Tool Execution] Function {name} called with sessionId from closure: {sessionId}`
   - `[Tool Execution] Retrieved current session ID: {sessionId}, company ID: {companyId}`

2. **executors.ts**:
   - `[executeFunctionCall] Starting execution with sessionId: {sessionId}, companyId: {companyId}`
   - `[executeFunctionCall] Sending 'started' update for action {actionId} to session {sessionId}`

## Testing Instructions

### 1. Manual Testing
1. Start the API server in development mode
2. Open a chat session and note the session ID from the logs
3. Execute any action (e.g., "show debug info")
4. Check the server logs for:
   ```
   [Tool Execution] Function debug_getSessionInfo called with sessionId from closure: {CURRENT_SESSION_ID}
   [Tool Execution] Retrieved current session ID: {CURRENT_SESSION_ID}, company ID: {COMPANY_ID}
   [executeFunctionCall] Starting execution with sessionId: {CURRENT_SESSION_ID}, companyId: {COMPANY_ID}
   [executeFunctionCall] Sending 'started' update for action debug.getSessionInfo to session {CURRENT_SESSION_ID}
   [Pusher] Publishing session message for sessionId: {CURRENT_SESSION_ID}, channel: sb-{CURRENT_SESSION_ID}, event: chat_message
   ```
5. Verify all session IDs match the current session

### 2. Multiple Session Testing
1. Open two different chat sessions (Session A and Session B)
2. Execute actions in both sessions
3. Verify that:
   - Actions in Session A publish to `sb-{SESSION_A_ID}`
   - Actions in Session B publish to `sb-{SESSION_B_ID}`
   - No cross-session message pollution occurs

### 3. Tool Caching Verification
1. Execute the same action multiple times in different sessions
2. Verify that despite tool caching:
   - Each execution uses the correct session ID
   - Pusher messages go to the correct channel

## Success Criteria
- [x] Fix implemented in message-handling.service.ts
- [x] Enhanced logging added for debugging
- [x] Test documentation created
- [ ] Manual testing confirms correct session ID usage
- [ ] Multiple session testing shows no cross-pollution
- [ ] Frontend receives action updates in correct session

## Running the Test
```bash
npm test tests/unit/services/session-id-flow.test.js
```

## Rollback Plan
If issues persist:
1. Check if `sessionId` in the closure is correctly capturing the current request's session
2. Verify that tool caching key doesn't include session-specific data
3. Check for any async context loss in the execution chain
