# AI Module Integration with nest-server

Quick reference for integrating the built-in AI assistant module (`@lenne.tech/nest-server` ≥ 11.26.0) into a consumer project. Covers when to use it, how to opt in, the four things you must wire yourself, and the audit points that distinguish a correct integration from a leaky one.

> **Companion reference:** `mcp-integration.md` covers the MCP-server side of the same module. Read both when the project exposes its tools over MCP.

## When to use it

Use the AI module when the project needs ANY of:

- A chat-style assistant endpoint (`POST /ai/prompt` or `POST /ai/stream`) backed by an OpenAI-compatible LLM
- Role-filtered tool calling — the LLM may only invoke tools the calling user is allowed to invoke
- Multi-turn conversations persisted per user with budget enforcement and audit logging
- An MCP server exposing the project's tools to external MCP clients (Claude Code, ChatGPT Desktop)
- Plan-mode workflows where the LLM proposes all steps up front and the framework runs an all-or-nothing pre-flight authorization
- Tenant-scoped admin-editable system prompts ("slots") plus a governed learning loop on top of tool failures

Skip it when the project only needs a stateless "wrap an LLM" call without auth/tools/audit — in that case a thin custom controller is fine.

## What ships built-in

Everything below is in the framework — consumers configure, do not implement:

- DB-backed LLM connections with AES-256-GCM-encrypted API keys, admin CRUD, `hasApiKey` projection
- Provider abstraction (OpenAI-compatible HTTP + Claude CLI subprocess) with auto-detected `supportsNativeTools` / `supportsJsonResponse` / `contextWindow`
- Prioritized connection-resolution chain (global default → tenant default → user default → client selection → tenant/admin enforced)
- Role-filtered `AiToolRegistry`, base class `AiTool`, `mutating` / `destructive` flags, optional `authorize()` pre-flight
- Plan mode (`input.mode: 'plan'`) with all-or-nothing pre-flight
- Confirmation policy (`mutating.default` / `enforced`, `destructive` always-confirm, persistent tool grants)
- Tool policies (deny / ask / allow against tool arguments via regex)
- Lifecycle hooks (`PreToolUse`, `PostToolUse`, `SessionStart`, `Stop`)
- Token budgets per user AND per tenant with HTTP-429 + i18n
- Multi-turn conversations capped at 500 messages, `$push`-only writes
- SSE streaming endpoint + REST + GraphQL parity
- Multi-modal attachments (image URLs / data URLs)
- Named agent modes with `allowedTools` filter
- Self-optimizing prompts — editable tenant-scoped slots with override/reset
- Governed learning loop (`aiPromptHints`)
- User-facing prompt templates with placeholder substitution
- Runtime placeholder registry (`{{userId}}`, `{{roles}}`, `{{tools}}`, …)
- LLM-driven context compaction + hard-trim fallback
- Deferred tool schemas + built-in `search_tools` meta-tool
- Built-in `ask_user_question` interactive-clarification tool
- Audit logging in `aiInteractions`
- MCP server at `/ai/mcp` + optional OAuth 2.1

## Opt-in surface (the only four things you actually write)

### 1. Config block in `config.env.ts`

```typescript
ai: {
  encryptionSecret: process.env.NSC__AI__ENCRYPTION_SECRET,  // REQUIRED in prod, 32+ chars
  maxIterations: 5,
  rateLimit: { max: 20, windowSeconds: 60 },
  audit: true,                                                // required for budgets
  budget: {
    period: 'day',
    user: { maxTokens: 100_000, maxPrompts: 50 },
    tenant: { maxTokens: 2_000_000 },
  },
  defaultConnection: {                                        // optional one-time seed
    name: 'Default LLM',
    baseUrl: process.env.AI_BASE_URL,
    model: process.env.AI_MODEL,
    apiKeyEnv: 'AI_API_KEY',
  },
  mcp: true,                                                  // optional, enables /ai/mcp
}
```

Presence of the `ai` block implies enabled — no separate `enabled: true` needed.

### 2. Project tools (this is opt-in for a reason)

The framework ships ZERO domain tools by default. Without project-registered tools, every domain question gets the answer *"I don't have a tool to do that"* — and that is correct, not a bug.

Pattern: extend `AiTool`, route through a `CrudService` with `context.serviceOptions` so `@Restricted` + `securityCheck` still apply, mark mutating tools `mutating: true` and destructive ones `destructive: true`. Group them in an `AiToolsModule` and add it to `ServerModule.imports`.

```typescript
// src/server/modules/ai/tools/find-orders.tool.ts
@Injectable()
export class FindOrdersAiTool extends AiTool {
  readonly description = 'Search the caller\'s orders by status. Returns at most 50.';
  readonly name = 'find_orders';
  readonly parameters = {
    properties: { status: { type: 'string', enum: ['open', 'paid', 'shipped'] } },
    type: 'object',
  };
  readonly roles = [RoleEnum.S_USER];

  constructor(registry: AiToolRegistry, private readonly orders: OrderService) {
    super(registry);
  }

  async execute(args: Record<string, unknown>, ctx: AiToolContext) {
    const orders = await this.orders.find(
      { filterQuery: { status: args.status }, take: 50 },
      ctx.serviceOptions,  // carries currentUser → @Restricted, securityCheck apply
    );
    return { data: orders, success: true };
  }
}
```

Reference implementations: `src/server/modules/ai/tools/` (`find-users.tool.ts`, `get-user.tool.ts`, `delete-user.tool.ts` — read, restricted-read, destructive-write patterns).

### 3. Optional: override one collaborator

`CoreModule.forRoot(env, { ai: { /* … */ } })` accepts an override for every collaborator. The most common ones:

```typescript
CoreModule.forRoot(envConfig, {
  ai: {
    // service: MyAiService,                   // custom orchestration / logging
    // resolver: MyAiResolver,                 // re-declare GraphQL decorators!
    // connectionResolver: MyConnectionResolver,  // custom selection chain
    // slotService: MySlotService,             // custom prompt-fragment assembly
    // placeholderRegistry: MyPlaceholderRegistry,  // project placeholders
    // mcpOauthService: MyMcpOAuthService,     // override authorizeConsent()
  },
});
```

The full list: `service`, `resolver`, `controller`, `connectionService`, `connectionResolver`, `conversationService`, `interactionService`, `budgetService`, `preferenceService`, `promptBuilder`, `promptService`, `promptHintService`, `slotService`, `placeholderRegistry`, `mcpClientService`, `mcpOauthService`, `modeService`, `toolGrantService`, `toolPolicyService`. All listed in `ICoreModuleOverrides.ai`.

### 4. Optional: project placeholders for slots and user prompts

Register at boot from any provider:

```typescript
this.placeholderRegistry.register({
  name: 'currentOrderId',
  description: 'The id of the order the user is currently viewing',
  resolve: (ctx) => ctx.metadata?.currentOrderId,
});
```

Used as `{{currentOrderId}}` in slot content and user prompts; appears in `GET /ai/placeholders` automatically.

## Mandatory check before completing the integration

The framework will not stop a sloppy integration from booting — but it will leak. Verify ALL of the following:

- [ ] `NSC__AI__ENCRYPTION_SECRET` set to a 32+ char value in production/staging — without it the app fails to boot (production guard)
- [ ] `apiKeyEncrypted` never appears in any API response (admin or otherwise) — schema-level `@Restricted(ADMIN)` PLUS interceptor strip
- [ ] At least one project tool is registered (otherwise the chat answers domain questions with "I don't have a tool for that")
- [ ] Every project tool routes through a `CrudService` with `context.serviceOptions` — direct `Model.find()` bypasses `@Restricted` + `securityCheck`
- [ ] Every mutating tool has `readonly mutating = true`, every destructive tool `readonly destructive = true`
- [ ] If MCP enabled (`ai.mcp`): `@modelcontextprotocol/sdk` installed
- [ ] If MCP OAuth enabled (`ai.mcp.oauth`): `mountAiMcpOAuth(app)` mounted in `main.ts`; `CoreAiMcpOAuthService.authorizeConsent()` overridden with project login/consent UI
- [ ] If budgets enabled: `ai.audit: true` is also set (budgets read from `aiInteractions`)
- [ ] `ai.allowedBaseUrlHosts` set in production when defaultConnection or admin-created connections point at external hosts (SSRF allowlist)

## Common review findings

| Symptom | Cause | Fix |
|---|---|---|
| Chat answers "I don't have a tool for that" for every domain question | No project tools registered | Build an `AiToolsModule` with one `AiTool` per operation that should be reachable from chat |
| `apiKeyEncrypted` leaks in `GET /ai/connections` admin response | Custom resolver/controller skipped `securityCheck` | Use the default endpoints OR ensure the custom one returns model instances (not `.lean()` / spreads) |
| Mutating tool runs without confirmation despite `confirmation.mutating.default: true` | Tool missing `readonly mutating = true` | Add the flag |
| Destructive tool runs without confirmation | Same — `readonly destructive = true` is what triggers the always-confirm path | Add the flag |
| Plan mode silently authorizes ALL steps after the first denied one | Tool's `authorize()` returns truthy or is absent | Implement `authorize()` to return `{ allowed: false, reason: '…' }` for unauthorized targets |
| Tool sees data the calling user should not see | Tool calls `Model.find()` or `.lean()` directly | Route through `CrudService.find(..., ctx.serviceOptions)` so `@Restricted` + `securityCheck` run |
| Tenant-A admin sees tenant-B's slots / prompts / hints / budgets | Mutation skipped `RequestContext.getTenantId()` | Use the framework `SlotService` / `PromptService` etc. — they auto-record `tenantId` from the request context |
| Budget shows 0 used / no enforcement | `ai.audit: false` (or absent) | Budgets read from `aiInteractions` — set `ai.audit: true` |
| `/ai/prompt` returns 500 BSONError on `conversationId: "null"` | Older 11.26.x patch | Bump to the latest patch; the orchestrator now treats the literal strings `"null"` / `"undefined"` as "no conversation" |

## Tests to add in the consumer project

For every project tool: at least one e2e test that exercises the tool via `POST /ai/prompt` as both a permitted user and a non-permitted user, asserting that the second case results in the LLM saying something like "I don't have a tool for that" (the registry filters it out before the LLM sees it) — NOT a 500.

For confirmation: one test that calls a mutating tool with the LLM's first attempt and verifies the response carries the "confirmation required" state instead of executing.

For budgets: one test that exhausts the user's `maxPrompts` or `maxTokens` for the period and verifies HTTP 429 with the `LTNS_0605` error code.

For MCP (if enabled): one test that hits `POST /ai/mcp` without auth → 401 + `WWW-Authenticate: Bearer …`, one test with auth that runs through `initialize` → `tools/list` → `tools/call`.

## Further reading

- `src/core/modules/ai/README.md` — full feature overview
- `src/core/modules/ai/INTEGRATION-CHECKLIST.md` — canonical step-by-step
- `migration-guides/11.25.x-to-11.26.0.md` — migration notes, breaking changes, troubleshooting
- `mcp-integration.md` (same directory) — MCP-server side, including DIY fallback for projects that opt OUT of the AI module
- `src/server/modules/ai/tools/` — reference tool implementations
- `src/core/modules/ai/inputs/core-ai-prompt.input.ts` — prompt input schema (mode, conversationId, attachments, requireConfirmation, rememberDecision, metadata)
