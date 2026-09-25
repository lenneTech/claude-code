---
type: llm
focus: { source: file, path: app/components/Product/ProductCreateModal.vue }
weight: 2
---

This is a Nuxt 4 modal component (Vue, Nuxt UI) with a form that creates a product through a generated API client (`productControllerCreate` from `sdk.gen.ts`).

PASS only if all of these hold:
- A Valibot schema validates the form: name required (non-empty), price not negative, active a boolean.
- The form uses Nuxt UI (`<UForm>` with the schema, form fields for the inputs, a switch or checkbox for active).
- While the request runs, submitting again is prevented (loading or disabled state).
- A failed request is reported to the user (for example a toast or an inline error) and the modal stays open.
- On success the modal closes and hands the result back to its caller (emit or overlay close with the created product or a success flag).
- No `any`; the form state and the API call use the generated types or types inferred from the schema.

FAIL if validation is missing or wrong, double submits are possible, errors are swallowed, or success is not reported back.
