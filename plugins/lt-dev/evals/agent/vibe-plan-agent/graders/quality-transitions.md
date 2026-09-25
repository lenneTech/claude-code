---
type: llm
focus: { source: file, path: IMPLEMENTATION_PLAN.md }
weight: 1
---

This is an implementation plan written from the following spec for an appointments module in a @lenne.tech/nest-server API (REST, MongoDB). Spec rules: (1) users see, edit and delete only their own appointments, admins all; (2) a user's appointments must not overlap, also when two requests for the same slot arrive at the same moment; (3) status transitions planned to confirmed to done, planned or confirmed to cancelled, all others rejected, done/cancelled not editable; (4) reminder email 24 h before startsAt, exactly once, also after a move or a server restart, none for cancelled; (5) UTC storage, ISO 8601 with offset. Done when every rule has an API test that fails without it, for user and admin where they differ.

PASS only if the plan defines the allowed transitions of rule 3 explicitly (a table, map or state machine), rejects all others, blocks edits of done/cancelled appointments, and plans tests for at least one allowed and one rejected transition. FAIL if transitions are left implicit.
