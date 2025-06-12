# Jira Product Manager Actions - Test Flow (AAD Project)

This document outlines a simple testing flow for the new Jira product manager actions using the "AAD" project.

**Project Details:**
*   Project Key: `AAD`
*   Board ID: `3`
*   Sample Backlog Issue Key: `AAD-25`
*   Sample Active Sprint Issue Key: `AAD-2`

**Note:** Replace placeholders like `[ACTIVE_SPRINT_ID]`, `[FUTURE_SPRINT_ID]`, `[USER_ACCOUNT_ID]`, and `[TRANSITION_ID]` with actual values. You can obtain some of these by running initial query actions.

---

## Test Flow & Sample Prompts

**1. View Active Sprint & Its Contents**

*   **Prompt 1.1:** "Jira, what's the active sprint for board 3?"
    *   *Expected Action: `getActiveSprintForBoard`*
    *   *Note the ID of the active sprint from the response. Let's call it `[ACTIVE_SPRINT_ID]`.*

*   **Prompt 1.2:** "Jira, show issues in sprint `[ACTIVE_SPRINT_ID]`."
    *   *Expected Action: `getIssuesForSprint`*

**2. Inspect Specific Issues**

*   **Prompt 2.1:** "Jira, get details for issue `AAD-25`." (Backlog issue)
    *   *Expected Action: `getTicket`*

*   **Prompt 2.2:** "Jira, get details for issue `AAD-2`." (Active sprint issue)
    *   *Expected Action: `getTicket`*

**3. Modify Issue: Story Points**

*   **Prompt 3.1:** "Jira, set story points for `AAD-25` to 5."
    *   *Expected Action: `setStoryPoints`*
    *   *Verify: Use Prompt 2.1 again to check if story points are updated.*

*   **Prompt 3.2:** "Jira, clear story points for `AAD-25`."
    *   *Expected Action: `setStoryPoints` (with value `null`)*
    *   *Verify: Use Prompt 2.1 again.*

**4. Move Issues Between Sprint & Backlog**

*   **Prompt 4.1:** "Jira, move `AAD-25` (backlog issue) to sprint `[ACTIVE_SPRINT_ID]`."
    *   *Expected Action: `moveIssueToSprint`*
    *   *Verify: Use Prompt 1.2 again to see if `AAD-25` is now listed. Also, check `AAD-25` details.*

*   **Prompt 4.2:** "Jira, move `AAD-2` (active sprint issue) to the backlog."
    *   *Expected Action: `moveIssueToBacklog`*
    *   *Verify: Use Prompt 1.2 again (AAD-2 should be gone). Check `AAD-2` details (sprint field should be empty).*

*   **Prompt 4.3 (Optional - Move to a Future Sprint):**
    *   *(Requires a known `[FUTURE_SPRINT_ID]`)*
    *   "Jira, move `AAD-25` to future sprint `[FUTURE_SPRINT_ID]`."
    *   *Expected Action: `moveIssueToSprint`*
    *   *Verify: Check issues in `[FUTURE_SPRINT_ID]` and `[ACTIVE_SPRINT_ID]`.*

**5. Modify Issue: Status**

*   **Prompt 5.1 (For `AAD-2`, assuming it's now in backlog or an appropriate state):** "Jira, what can I do with issue `AAD-2`?"
    *   *Expected Action: `getAvailableTransitions`*
    *   *Note a relevant `[TRANSITION_ID]` from the response (e.g., to "In Progress" or "Selected for Development").*

*   **Prompt 5.2:** "Jira, update status for `AAD-2` using transition `[TRANSITION_ID]`. Add comment: 'Test transition'."
    *   *Expected Action: `transitionIssue`*
    *   *Verify: Use Prompt 2.2 again to check the new status.*

**6. Modify Issue: Assignee**

*   **Prompt 6.1:** "Jira, assign issue `AAD-25` to user `[USER_ACCOUNT_ID]`."
    *   *(Requires a known `[USER_ACCOUNT_ID]`. You can find one using the `searchUsers` action if needed: "Jira, search for user 'John Doe'.")*
    *   *Expected Action: `assignTicket`*
    *   *Verify: Use Prompt 2.1 again to check the assignee.*

---

This flow provides a basic sequence to test the core new functionalities. You can expand on it with more complex scenarios or different data.
