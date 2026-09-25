---
type: llm
focus: { source: file, path: app/pages/app/products/index.vue }
weight: 2
---

This is a Nuxt 4 page (Vue, Nuxt UI) that lists products through a generated API client (`productControllerFindAll` from `sdk.gen.ts`, types from `types.gen.ts`) and opens a create modal.

PASS only if all of these hold:
- It shows a loading state while the list is fetched, an empty state when there are no products, and an error state (message and a way to retry, or a toast plus a visible fallback) when the request fails.
- Each product row shows name, price and whether it is active.
- The modal is opened programmatically (for example `useOverlay()`), not by conditionally rendering a component with `v-if`.
- After the modal reports a successful create, the list shows the new product (refetch or insert), without a full page reload.
- Types come from the generated client; there is no `any` for API data.

FAIL if any state is missing, the list does not update after a create, or API data is typed as `any` or with a hand-written interface.
