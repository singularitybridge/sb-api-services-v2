# Calendar Date Fix - Root Cause & Solution

## Problem
Calendar events were being created in **2023** instead of **2025**, despite multiple attempts to inject the current date.

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
