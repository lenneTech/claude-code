---
type: llm
focus: { source: file, path: app/components/Task/TaskForm.vue }
weight: 2
---

This is a Nuxt 4 form component (Vue, Nuxt UI, Valibot) that creates and edits a task through a generated API client (`taskControllerCreate`, `taskControllerUpdate`). The task: add an optional due date (`dueDate`, an ISO calendar day YYYY-MM-DD, null for "no date") that the user picks with a date picker and that must not lie in the past. The project already has a `FormDateField` component (a labelled date input with optional `min`/`max`, bound to a YYYY-MM-DD string or null) and an auto-imported `todayIsoDate()` util; using a Nuxt UI date input directly would also be acceptable.

PASS only if all of these hold:
- The form has a due date field with a date picker in the template, bound to the form state.
- When an existing task is edited, the field starts with the task's current `dueDate`; for a new task it starts empty.
- The Valibot schema accepts an empty due date, including null (what FormDateField sets when the field is cleared), and rejects a day before today. A `min` on the input alone is not enough, because a typed date bypasses it.
- The due date reaches the API in both the create and the update request. Clearing the date of an existing task sends null, so the stored date is removed; an empty string is never sent.

FAIL if any of these is missing or wrong.
