---
description: Work on a Linear issue by ID
argument-hint: [issue-id]
disable-model-invocation: true
---

# Fix Linear Issue

## When to Use This Command

- Working on an assigned Linear issue
- Implementing a feature or fix from a Linear ticket
- Need structured workflow for issue resolution

## Related Commands

| Command | Purpose |
|---------|---------|
| `/lt-dev:create-story` | Create a new user story for Linear |
| `/lt-dev:resolve-ticket` | Resolve ticket end-to-end with TDD |
| `/lt-dev:review` | Comprehensive 7-dimension code review after implementation |
| `/review` | Claude Code built-in: quick PR-level review (after PR creation) |
| `/lt-dev:comment` | Generate testing comment for the issue |
| `/lt-dev:backend:sec-review` | Security review of code changes |
| `/lt-dev:backend:test-generate` | Generate tests for changes |

## Description
Work on a single assigned issue, ensuring high-quality, consistent implementation and adherence to all requirements.

## Prompt
### STEP 1: ISSUE ANALYSIS & PLANNING (30-45 min thinking time)

1.  **Retrieve Issue Details:** Access the Management Control Panel (MCP) to retrieve the specific Linear Issue **#$ARGUMENTS** and any associated resources (e.g., a Figma design link).
2.  **Understand Requirements:** Deeply read the issue description, comments, and review the Figma design (if applicable) to fully grasp the objective, scope, and visual requirements.
3.  **Consistency Check:** Review existing application code in relevant areas to understand current implementation patterns, architecture, and coding styles. The new code **must** be consistent.
4.  **Create Plan:** Develop a concrete implementation plan, including:
    * Required code changes/new files.
    * Approach for handling edge cases.
    * Testing strategy for the new feature/fix.

Ultrathink: What is the most robust, consistent, and maintainable way to solve this issue?

### STEP 2: EXECUTION

Implement the plan completely, focused on high quality and consistency:

1.  **Implement:** Write production-quality code that directly addresses the issue requirements.
2.  **Consistency & Guidelines:** Strictly adhere to established coding guidelines and ensure the implementation style is consistent with the surrounding application code.
3.  **Testing:** Implement unit/integration tests as defined in the plan, or manually test the feature thoroughly.
4.  **Update Status:** Update the Linear Issue **#$ARGUMENTS** status in the MCP upon completion.

**Only interrupt for critical blockers** (e.g., unclear requirements, missing credentials). Make smart decisions autonomously, prioritizing code quality and long-term maintainability.

**After implementation, guide the user through the quality pipeline:**

1. `/lt-dev:review $ARGUMENTS` — Comprehensive 7-dimension quality check
2. Address any findings from the review
3. `/lt-dev:comment $ARGUMENTS` — Post testing comment on the ticket
4. Ask the user: "Soll ich eine PR erstellen?" — If yes, create PR with `gh pr create` using the issue title and a summary of changes
5. After PR creation: suggest running `/review` for a final PR-level check

**BEGIN ANALYSIS NOW.**