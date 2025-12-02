# Calendar Date Fix - Root Cause & Systemic Solution

## Problem
Calendar events were being created in **2023** instead of **2025**, despite multiple attempts to inject the current date.

**Example**: User says "Create meeting tomorrow 02/12/2025" → AI creates event for **February 12, 2025** instead of **December 3, 2025**.

## Root Cause Discovery

### Investigation Steps:
1. Initially tried hardcoding date in calendar agent prompt → Failed
2. Implemented dynamic date injection via Handlebars variables → Still failed
3. Added debug logging to verify template processing
4. Created test script to verify Handlebars syntax

### Critical Finding:
**Invalid Handlebars syntax in calendar agent prompt!**

The prompt contained:
```handlebars
Tomorrow is: {{currentMonth}} {{currentDay + 1}}, {{currentYear}}
```

**Handlebars does NOT support arithmetic operations** like `{{currentDay + 1}}`.

This caused:
1. `Handlebars.compile()` threw a parse error
2. `processTemplate` caught the error and returned the **original template** with raw variables
3. AI received literal text `"{{currentYear}}"` instead of `"2025"`
4. AI defaulted to dates within its training data cutoff (2023)

## Solution Implemented

### 1. Extended Session Context Data
**File**: `src/services/session-context.service.ts`

Added `currentDayPlusOne` to avoid arithmetic in templates:

```typescript
export interface SessionContextData {
  // ... existing fields
  currentDate: string;       // "2025-12-02"
  currentYear: number;        // 2025
  currentMonth: string;       // "December"
  currentDay: number;         // 2
  currentDayPlusOne: number; // 3 (for "tomorrow")
}
```

### 2. Fixed Calendar Agent Prompt
**Updated**: Calendar agent prompt in database

Changed from:
```handlebars
Tomorrow is: {{currentMonth}} {{currentDay + 1}}, {{currentYear}}  ❌ INVALID
```

To:
```handlebars
Tomorrow is: {{currentMonth}} {{currentDayPlusOne}}, {{currentYear}}  ✅ VALID
```

### 3. Added Debug Logging
**File**: `src/services/assistant/message-handling.service.ts`

Added logging to verify template processing:
```typescript
const dateMatch = systemPrompt.match(/Today's date:([^\n]*)/);
if (dateMatch) {
  console.log(`[DEBUG] Processed date in prompt: "Today's date:${dateMatch[1]}"`);
}
console.log(`[DEBUG] Processed prompt (first 300 chars): ${systemPrompt.substring(0, 300)}`);
```

## Verification

### Template Processing Test:
```bash
node test-handlebars-simple.js
```

**Result**: ✅ SUCCESS
```
Original: {{currentMonth}} {{currentDay}}, {{currentYear}}
Processed: December 2, 2025
```

## Testing

### To verify the fix works:

1. **Start a NEW chat session** with `calendar-dev-agent` (ID: 692d86223409ab61d7528fa3)
   - IMPORTANT: Must be a new session - old sessions have cached prompts

2. **Test command**:
   ```
   "Create meeting tomorrow at 13 in tel aviv"
   ```

3. **Expected result**:
   - Event created for **December 3, 2025** (NOT 2023!)
   - Server logs show: `[DEBUG] Processed date in prompt: "Today's date: December 2, 2025"`

4. **Verify in backend logs**:
   ```bash
   # Look for this in server output:
   [DEBUG] Processed date in prompt: "Today's date: December 2, 2025 (2025-12-02)"
   [DEBUG] Processed prompt (first 300 chars): ...December 2, 2025...
   ```

## Files Modified

1. `src/services/session-context.service.ts` - Added `currentDayPlusOne`
2. `src/services/assistant/message-handling.service.ts` - Added debug logging
3. Calendar agent prompt (database) - Fixed invalid Handlebars syntax

## Key Learnings

1. **Handlebars is NOT JavaScript** - No arithmetic, no functions, only simple variable replacement
2. **Template errors fail silently** - The processTemplate catch block returns original template
3. **GPT-4o-mini training cutoff is 2023** - It defaults to dates within its knowledge
4. **Always verify template processing** - Don't assume variables are being replaced

## Why Previous Attempts Failed

1. **Hardcoded date in prompt** - Didn't use Handlebars variables, so prompt was static
2. **First Handlebars attempt** - Used `{{currentDay + 1}}` which caused parse error
3. **Template returned unprocessed** - AI received `"{{currentYear}}"` as literal text
4. **AI defaulted to 2023** - Without real dates, AI used dates from its training data

## Success Criteria

✅ Template processing completes without errors
✅ AI receives actual dates ("December 2, 2025") not variables ("{{currentYear}}")
✅ Calendar events created in 2025, not 2023
✅ Debug logs confirm date injection working

---

## Part 2: Systemic Validation Solution (December 2, 2025)

### The Remaining Problem

Even after fixing the Handlebars template processing, the AI **still** created events with wrong dates:
- User: "Create meeting tomorrow 02/12/2025 at 13 in tel aviv"
- AI Generated: `startTime: "2025-02-12T13:00:00+02:00"` (February 12, 2025) ❌
- Expected: `startTime: "2025-12-03T13:00:00+02:00"` (December 3, 2025) ✅

**Why it Still Failed**:
- Template processing worked correctly - AI received "Today's date: December 2, 2025"
- But AI still misinterpreted the user input and generated wrong dates
- No validation layer to catch these errors before creating events

### Systemic Solution: Integration-Level Date Validation

Instead of relying on the AI to get dates right, we added **validation at the integration layer** to catch and reject invalid dates before they reach the Nylas API.

#### New Components:

### 1. Date Validation Utility (`src/utils/date-validation.ts`)

Centralized validation logic that checks:
- ✅ Dates are in the future (not past)
- ✅ Year is >= current year
- ✅ Dates are reasonable (not >24 months in future)
- ✅ End time is after start time
- ✅ Duration is reasonable (not >7 days)
- ✅ Detects suspicious patterns (e.g., month in past when current month expected)

**Functions**:
- `validateEventDate(dateString, options)` - Validates a single date
- `validateDateRange(startDate, endDate, options)` - Validates date range
- `logDateValidation(actionName, date, result)` - Logs validation for debugging

#### 2. Updated Calendar Actions with Validation

Added date validation to all calendar event actions:

**`nylasCreateCalendarEvent`** (line 465):
```typescript
// Validate dates before creating event
const dateValidation = validateDateRange(startTime, endTime);
logDateValidation('nylasCreateCalendarEvent', startTime, dateValidation);

if (!dateValidation.isValid) {
  throw new ActionValidationError(dateValidation.error!);
}
```

**`nylasBatchCreateEvents`** (line 1238):
```typescript
// Validate ALL events before creating any
const validationErrors: string[] = [];
eventList.forEach((event, index) => {
  if (event.startTime && event.endTime) {
    const validation = validateDateRange(event.startTime, event.endTime);
    if (!validation.isValid) {
      validationErrors.push(`Event ${index + 1}: ${validation.error}`);
    }
  }
});

if (validationErrors.length > 0) {
  throw new ActionValidationError(validationErrors.join('\n'));
}
```

**`nylasUpdateEvent`** (line 712):
- Validates dates if being updated
- Handles partial updates (only start or only end)

**`nylasMoveEvent`** (line 1329):
- Validates new date range before moving event

**`nylasFindAvailableSlots`** (line 905):
- Validates date range for availability search
- Allows past dates (since searching past is valid)

#### 3. Enhanced Parameter Descriptions

Updated AI parameter descriptions to guide better:
```typescript
startTime: {
  type: 'string',
  description: 'Start time in ISO 8601 format with timezone. MUST be a FUTURE date. Use current year or later. Example: "2025-12-03T13:00:00+02:00"'
}
```

### How It Works Now

**Before Validation**:
1. User: "Create meeting tomorrow 02/12/2025"
2. AI generates: `startTime: "2025-02-12T13:00:00+02:00"`
3. Event created for February 12, 2025 ❌

**After Validation**:
1. User: "Create meeting tomorrow 02/12/2025"
2. AI generates: `startTime: "2025-02-12T13:00:00+02:00"`
3. **Validation catches error**: "Event date 2025-02 is 10 month(s) ago. Current date: 2025-12-02"
4. **AI receives error** and can retry with correct date
5. AI retries: `startTime: "2025-12-03T13:00:00+02:00"` ✅
6. Event created for December 3, 2025 ✅

### Example Validation Error Messages

The validation provides clear, AI-friendly error messages:

```
Event start time (2025-02-12T13:00:00+02:00) is 294 day(s) in the past.
Current server date: 2025-12-02T11:30:00.000Z.
Please use a future date.
```

```
Event year 2023 is before current year 2025.
Current date is 2025-12-02.
Did you mean year 2025 or 2026?
```

```
Event date 2025-02 is 10 month(s) ago.
Current date: 2025-12-02.
Did you mean month 12 or later?
```

### Validation Rules

| Rule | Check | Action |
|------|-------|--------|
| **Past Date** | Event date < current date | Reject with days difference |
| **Wrong Year** | Event year < current year | Reject with suggestion |
| **Past Month** | Same year but month < current month | Reject (likely date parsing error) |
| **Too Far Future** | Event > 24 months away | Reject (likely error) |
| **Invalid Range** | End before start | Reject with dates |
| **Long Duration** | Duration > 7 days | Reject (likely error) |

### Debug Logging

Validation results are logged for debugging:

```
[DATE VALIDATION] nylasCreateCalendarEvent
  ✅ VALID
  Requested: 2025-12-03T13:00:00+02:00
  Parsed: 2025-12-03T11:00:00.000Z
  Current server time: 2025-12-02T11:30:00.000Z
```

or

```
[DATE VALIDATION ERROR] nylasCreateCalendarEvent
  Requested date: 2025-02-12T13:00:00+02:00
  Parsed as: 2025-02-12T11:00:00.000Z
  Current server time: 2025-12-02T11:30:00.000Z
  Error: Event date 2025-02 is 10 month(s) ago. Current date: 2025-12-02
```

### Files Modified (Part 2)

1. **NEW**: `src/utils/date-validation.ts` - Complete validation utility
2. `src/integrations/nylas/nylas.actions.ts` - Added validation to 5 calendar actions
3. `CALENDAR_DATE_FIX.md` - Updated with Part 2 solution

### Complete Success Criteria

✅ **Part 1 (Template Processing)**:
- Template variables replaced correctly
- AI receives actual current date

✅ **Part 2 (Validation)**:
- All calendar actions validate dates before API calls
- Invalid dates rejected with clear error messages
- AI can self-correct based on error messages
- No events created with wrong dates
- Validation logs show all checks

## Next Steps (if issue persists)

If events are STILL created in 2023 after this fix:

1. Check backend logs for `[DEBUG]` output - verify dates are being replaced
2. If dates ARE replaced but AI still uses 2023:
   - Problem is AI interpretation, not template processing
   - Consider adding date validation in the calendar action itself
   - Reject dates before current year in `nylasCreateCalendarEvent`

## References

- Calendar Agent ID: `692d86223409ab61d7528fa3`
- Test script: `test-handlebars-simple.js`
- Handlebars docs: https://handlebarsjs.com/
- Session context service: `src/services/session-context.service.ts`
- Template service: `src/services/template.service.ts`
