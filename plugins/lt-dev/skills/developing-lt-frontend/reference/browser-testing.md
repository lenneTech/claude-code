# Browser Testing (Chrome DevTools MCP)

**CRITICAL: For direct browser testing and debugging, always use the Chrome DevTools MCP (`mcp__chrome-devtools__*`) unless the user explicitly requests otherwise.** This applies to snapshots, navigation, interaction, network analysis, and performance traces. The Playwright-based Browser MCP (`mcp__MCP_DOCKER__browser_*`) is used for creating and running Playwright E2E tests.

**After implementing each feature, verify it works in the browser!**

## Available Tools

| Tool | Use Case |
|------|----------|
| `mcp__chrome-devtools__navigate_page` | Navigate to URL |
| `mcp__chrome-devtools__take_snapshot` | Get page structure with UIDs (preferred) |
| `mcp__chrome-devtools__take_screenshot` | Visual verification |
| `mcp__chrome-devtools__click` / `fill` | Interact with elements |
| `mcp__chrome-devtools__list_console_messages` | Check for JS errors |
| `mcp__chrome-devtools__list_network_requests` | Debug API calls |

## Workflow After Each Feature

```
┌────────────────────────────────────────────────────────────────┐
│  AFTER implementing a feature:                                 │
│                                                                │
│  1. NAVIGATE to the page:                                      │
│     mcp__chrome-devtools__navigate_page(url: "localhost:3001") │
│                                                                │
│  2. TAKE SNAPSHOT (preferred over screenshot):                 │
│     mcp__chrome-devtools__take_snapshot()                      │
│     - Check if on correct page (middleware may redirect)       │
│     - If redirected to /login: Handle authentication first     │
│                                                                │
│  3. CHECK CONSOLE for errors:                                  │
│     mcp__chrome-devtools__list_console_messages(types: error)  │
│     - Fix any JavaScript errors before proceeding              │
│                                                                │
│  4. VERIFY API calls work:                                     │
│     mcp__chrome-devtools__list_network_requests()              │
│     - Check for failed requests (4xx, 5xx)                     │
│                                                                │
│  5. ONLY proceed to next feature when current one works        │
└────────────────────────────────────────────────────────────────┘
```

## Authentication Handling

- Most pages require login
- If redirected to `/login` or `/auth/login`: Ask user for credentials
- Use `fill` and `click` tools to authenticate
- Then navigate back to intended page

## Nuxt UI MCP (Component Documentation)

**Use the Nuxt UI MCP tools for component documentation:**

| Tool | Use Case |
|------|----------|
| `mcp__nuxt-ui-remote__list-components` | List all available components |
| `mcp__nuxt-ui-remote__get-component` | Get component documentation |
| `mcp__nuxt-ui-remote__get-component-metadata` | Get props, slots, events |
| `mcp__nuxt-ui-remote__search-components-by-category` | Find components by category |
| `mcp__nuxt-ui-remote__list-composables` | List available composables |

**When to use:**
- Before using a Nuxt UI component you haven't used before
- When unsure about available props or slots
- When looking for the right component for a use case
