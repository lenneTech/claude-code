---
name: developing-lt-frontend-informed-trade-off-pattern
description: Frontend instances of the framework-wide Informed-Trade-off Pattern — Composition-vs-Options API, readonly state, SSR guards, v-html, deprecated APIs, useFetch vs fetch
---

# Informed-Trade-off Pattern (Frontend Instances)

Several Nuxt/Vue framework conventions have a **standard safe path** and an **opt-out for good reasons**. The opt-out is never implicit — it requires a documented justification and awareness of what the opt-out bypasses.

This is the **frontend-specific** manifestation of a framework-wide meta-rule. The full pattern definition (five elements, severity framework, instance composition) lives in the backend skill: `generating-nest-servers/reference/informed-trade-off-pattern.md`. The meta-shape is identical; this file enumerates the frontend-specific instances and what each one bypasses.

## The Pattern in One Paragraph

Standard path → opt-out with documented reason → mandatory analysis of what the opt-out skips → code comment at the opt-out site → review severity depends on what is actually bypassed. Opt-outs are allowed when justified and analyzed. Silent bypasses of security or framework guarantees are findings.

## Frontend Instances

### Instance A: Composition API vs Options API

- **Standard path:** Composition API (`<script setup>`, `ref`, `computed`, composables).
- **Opt-out:** Options API (`export default { data, methods, computed }`) in new code.
- **Legitimate reasons:** integrating a library requiring Options API, legacy component modified in non-refactor scope.
- **What is bypassed:** typed reactivity with `ref<T>()`/`computed<T>()`, composable extraction, HMR consistency.
- **Documentation:** code comment naming the library/legacy reason.

### Instance B: Composable state returned mutable vs `readonly()`

- **Standard path:** composables return `readonly()` references for state; only expose explicit mutator functions.
- **Opt-out:** return mutable refs directly.
- **Legitimate reasons:** v-model bindings that need two-way on the consumer, performance-critical high-frequency updates where the `readonly` wrapper is measurable.
- **What is bypassed:** single-source-of-truth guarantees, controlled mutation paths, easier tests.
- **Documentation:** comment + the mutator functions still exposed alongside.

### Instance C: SSR-safe patterns vs `process.client` escape hatches

- **Standard path:** `onMounted()` for browser-only code, `useRuntimeConfig()` for config, SSR-safe composables.
- **Opt-out:** `if (process.client)` / `if (import.meta.client)` guards, `onBeforeMount()` abuses, `<ClientOnly>` wraps of logic that should be universal.
- **Legitimate reasons:** third-party libraries with no SSR story, browser-only APIs (Web Audio, IntersectionObserver) outside `onMounted()` scope, gradual migration of existing client-only code.
- **What is bypassed:** universal rendering correctness, hydration consistency, SEO/perf defaults.
- **Documentation:** comment naming the browser-only requirement.

### Instance D: Deprecated Nuxt / Vue / nuxt-extensions / Nuxt UI APIs

- **Standard path:** current non-deprecated API surface.
- **Opt-out:** continued call to a `@deprecated` symbol.
- **Legitimate reasons:** gradual migration in progress, replacement API not yet stable at the current framework version, upstream bug in the replacement.
- **What is bypassed:** security / SSR / XSS hardening in the replacement. Many Vue/Nuxt deprecations remove input sanitization, CSP constraints, or SSR-safety guards — always inspect the `@deprecated` message for security language.
- **Documentation:** comment naming the migration ticket or upstream blocker.

### Instance E: `v-html` vs sanitized bindings

- **Standard path:** `{{ }}` text interpolation, component composition.
- **Opt-out:** `v-html` (or `innerHTML`).
- **Legitimate reasons:** rendering trusted rich-text from a known-sanitized source (rich-text editor with built-in sanitization, trusted CMS).
- **What is bypassed:** auto-escaping. XSS risk if the content path is not verified sanitized.
- **Documentation:** mandatory comment naming the sanitization source. Unjustified `v-html` is High severity in review.

### Instance F: `useFetch` / `$fetch` vs `fetch()` raw calls

- **Standard path:** `useFetch()` / `useAsyncData()` for SSR-aware requests, `$fetch` for client-only event handlers.
- **Opt-out:** `fetch()` or `axios` directly.
- **Legitimate reasons:** streaming response bodies, specific `Request` API features not surfaced by `$fetch`, third-party integration constrained to native APIs.
- **What is bypassed:** automatic base URL, SSR cookie forwarding, Nuxt runtime error handling, request deduplication, useAsyncData key tracking.
- **Documentation:** comment + manual reproduction of any missing behavior (cookie forwarding on SSR paths especially).

## Applying the Pattern

1. Default to the standard path.
2. If the opt-out is needed, state the legitimate reason in a code comment.
3. Check what the opt-out bypasses (list above per instance).
4. Either confirm the bypass is safe in this context, or add the compensating logic (sanitization, readonly wrapper, SSR-safe guard, cookie forwarding, etc.).
5. Expect the reviewer to check the same five points.

## Review Treatment

Severity is a function of **what is actually bypassed**, not the presence of the opt-out. Unjustified `v-html` is High (XSS class); unjustified Options API is Low (style drift); unjustified SSR escape is Medium (hydration risk). Full severity framework: backend skill `generating-nest-servers/reference/informed-trade-off-pattern.md`.

## Cross-site composition

A single component can instantiate multiple trade-offs at once (for example, an Options-API component with a `v-html` binding and a raw `fetch()` call). Each instance must be independently justified and analyzed — justifications do not compound.
