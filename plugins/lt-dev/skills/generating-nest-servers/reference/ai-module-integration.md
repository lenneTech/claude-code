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
- `@AgentFunction()` methods of `@nestjs/ai` offered to the assistant and to MCP behind the module's gates, or models run through the AI SDK (nest-server 12.10.0+, [§5](#5-optional-nestjs-ai-and-the-ai-sdk-12100))

Skip it when the project only needs a stateless "wrap an LLM" call without auth/tools/audit — in that case a thin custom controller is fine.

## What ships built-in

Everything below is in the framework — consumers configure, do not implement:

- DB-backed LLM connections with AES-256-GCM-encrypted API keys, admin CRUD, `hasApiKey` projection
- Provider abstraction (OpenAI-compatible HTTP + Claude CLI subprocess) with auto-detected `supportsNativeTools` / `supportsJsonResponse` / `contextWindow`
- Prioritized connection-resolution chain (global default → tenant default → user default → client selection → tenant/admin enforced)
- Role-filtered `AiToolRegistry`, base class `AiTool`, `mutating` / `destructive` flags, optional `authorize()` pre-flight
- Tool parameters as JSON Schema or (12.10.0+) Standard Schema, validated before `authorize()` and `execute()`
- Tool results sanitized before the model, `actions[].result` and MCP see them (12.10.0+): `securityCheck(user)` on every model instance at any depth, then every secret field removed (`password`, tokens, `apiKeyEncrypted`, `security.secretFields`, also as SQL column)
- AI SDK transport (12.10.0+): `providerType: 'nestjs-ai'` for models of `@nestjs/ai`'s `AiModule.forRoot({ models })`, `LlmProviderFactory.registerAiSdkModel()` for any AI SDK provider on database connections
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
- MCP server at `/ai/mcp` + optional OAuth 2.1 with a built-in consent page and tokens bound to their resource (RFC 8707, 12.10.0+); `createMcpTokenVerifier()` makes it the identity provider of a project's own `@nestjs/mcp` endpoint (see `mcp-integration.md`)

## Opt-in surface (the only things you actually write)

### 0. Wire `CoreAiModule.forRoot()` into the server module

The framework controller stays dormant until the module is imported. In `src/server/server.module.ts`:

```typescript
import { CoreAiModule, CoreModule, TusModule } from '@lenne.tech/nest-server';
// ...
export const imports = [
  CoreModule.forRoot(envConfig),
  // ... other modules ...
  UserModule,

  // Mounts every /ai/* REST + GraphQL endpoint (chat/stream, connections,
  // preferences, budgets, interactions, slots, prompts, prompt-hints,
  // placeholders, usage). Tools are opt-in — register them via an
  // AiToolsModule (see §2). No tools registered = the assistant correctly
  // answers "I don't have a tool to do that" for domain questions.
  CoreAiModule.forRoot(),
];
```

Also add `CoreAiModule` to the module's `exports` if downstream modules
depend on its services. Without this line the `/ai/*` routes are 404 even
when the `ai` config block (§1) is set.

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

**Parameters as a schema (nest-server 12.10.0+).** `parameters` may be a Standard Schema with JSON Schema instead of a JSON Schema object. In this stack that is Valibot through `@valibot/to-json-schema`:

```typescript
import { toStandardJsonSchema } from '@valibot/to-json-schema';
import * as v from 'valibot';

readonly parameters = toStandardJsonSchema(v.object({ status: v.picklist(['open', 'paid', 'shipped']) }));
```

The registry stores its JSON Schema for the model and validates the arguments before `authorize()` and `execute()`; invalid arguments go back to the model as a failed call. Zod 4.2+ and ArkType work the same way; a schema without JSON Schema (Valibot without `toStandardJsonSchema()`, Zod before 4.2) stops the registration with a named error.

**What a tool returns is filtered (nest-server 12.10.0+).** In the chat loop, in `actions[].result` and over `/ai/mcp`, a result passes `securityCheck(user)` on every model instance at any depth, also inside `{ success, data }`, and then loses every secret field (`password`, `verificationToken`, `passwordResetToken`, `refreshTokens`, `tempTokens`, `apiKeyEncrypted`, `security.secretFields`, each also as SQL column). A tool that returns a field with such a name on purpose loses it; rename the field. Routing through `CrudService` stays the rule: the filter cleans the answer, it does not decide what the user may read.

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

### 5. Optional: NestJS AI and the AI SDK (12.10.0)

Three opt-in integrations. `ai`, `@nestjs/ai` and `@nestjs/resilience` are **optional peers**, loaded lazily and checked against the range the release was tested with: `ai` `>=7.0.0 <8` for `registerAiSdkModel()`, additionally `@nestjs/ai` `>=0.0.2 <0.0.3` and `@nestjs/resilience` `>=0.0.3 <0.0.4` for `providerType: 'nestjs-ai'` and `ai.agentFunctions`. Outside the range the boot or the first call fails with `AiSdkPackageError` naming it. A project that installs none of them loads nothing new. **Vendor mode:** the core names all three in literal `import()` calls, so the project declares them (the lt CLI adds them when vendoring; `nest-server-core-updater` when updating).

**`@AgentFunction()` methods as tools** (`ai: { agentFunctions: true }`, or `{ include: [...] }` / `{ exclude: [...] }`; needs `AiModule.forRoot({ models })` imported):

```typescript
@AgentFunction({
  description: 'Cancel a booking',
  inputSchema: toStandardJsonSchema(v.object({ id: v.string() })),
  name: 'cancel_booking',
})
@AiAgentFunction({ destructive: true, authorize: (args) => args.id !== 'locked' })
@Roles(RoleEnum.S_USER)
cancel({ id }: { id: string }) { ... }
```

The module's gates run first (role filter, policies and grants, `authorize()`, confirmation, plan mode, budgets), then `@nestjs/ai`'s own pipeline with the run's HTTP request as caller, so `@Roles()` is decided as over HTTP. Roles default to the method's `@Roles()`, else `S_USER`, never open. An agent function that requires `scopes` is not offered; a name that is already a registered tool stops the boot.

**A model registered in `@nestjs/ai`:** a connection with `providerType: 'nestjs-ai'` and `model` = the name in `AiModule.forRoot({ models })` (`baseUrl` is informative, e.g. `nestjs-ai:default`).

**Any AI SDK provider for database connections** (encrypted keys, per tenant), in a module of its own in `ServerModule.imports` (never `CoreModule.forRoot()` there, that starts the framework twice):

```typescript
@Module({})
export class AiProvidersModule implements OnModuleInit {
  constructor(private readonly factory: LlmProviderFactory) {}
  async onModuleInit() {
    await this.factory.registerAiSdkModel('anthropic', (connection, { fetch }) =>
      createAnthropic({ apiKey: connection.apiKey, fetch })(connection.model),
    );
  }
}
```

Hand the provider the `fetch` from the builder context: it is what applies `ai.allowedBaseUrlHosts` to the provider's requests.

**Guards on `@nestjs/ai` and `@nestjs/mcp` calls.** In any project with one of these packages installed, the framework's global guards decide agent function and MCP tool calls on the request the call runs in, never on the tool arguments (before 12.10.0 a model could pass `{ "user": { "roles": ["admin"] } }` as arguments and be read as that caller). A request-less caller (a queue job's `caller: { user, scopes }`, a durable run, MCP over stdio) is anonymous: public methods run, everything else answers 401. A job that runs a role-gated agent function authenticates and passes `caller: { request }`.

## Mandatory check before completing the integration

The framework will not stop a sloppy integration from booting — but it will leak. Verify ALL of the following:

- [ ] `NSC__AI__ENCRYPTION_SECRET` set to a 32+ char value in production/staging — without it the app fails to boot (production guard)
- [ ] `apiKeyEncrypted` never appears in any API response (admin or otherwise) — schema-level `@Restricted(ADMIN)` PLUS interceptor strip
- [ ] At least one project tool is registered (otherwise the chat answers domain questions with "I don't have a tool for that")
- [ ] Every project tool routes through a `CrudService` with `context.serviceOptions` — direct `Model.find()` bypasses `@Restricted` + `securityCheck`
- [ ] Every mutating tool has `readonly mutating = true`, every destructive tool `readonly destructive = true`
- [ ] If MCP enabled (`ai.mcp`): `@modelcontextprotocol/sdk` installed
- [ ] If MCP OAuth enabled (`ai.mcp.oauth`): no `mountAiMcpOAuth(app)` in `main.ts` (`CoreModule` mounts the router itself since 11.43.0), `NSC__BASE_URL` set in every deployed environment, Better-Auth active for the built-in consent page; an own consent page issues codes on POST with a CSRF token only (`mcp-integration.md`, step 4)
- [ ] No tool returns a field named like a secret on purpose: from 12.10.0 it is removed from every tool result
- [ ] If `ai.agentFunctions`: `AiModule.forRoot({ models })` is imported; every agent function that is not for every signed-in user carries `@Roles()` or `@AiAgentFunction({ roles })`, and every one that changes data `mutating` / `destructive`; none requires `scopes` (those are not offered)
- [ ] If `registerAiSdkModel()`: the provider gets the `fetch` from the builder context; `ai` (and for `nestjs-ai` `@nestjs/ai` and `@nestjs/resilience`) installed in the tested range; in vendor mode all three declared
- [ ] Queue jobs or other request-less callers that run role-gated agent functions pass `caller: { request }`
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
| A field the client relied on is missing from a tool result | nest-server 12.10.0 removes secret-named fields from every tool result | Rename the field if it is no secret; if it is one, it never belonged in the result |
| `AiSdkPackageError: … tested with >=0.0.2 <0.0.3` | An `ai` / `@nestjs/ai` / `@nestjs/resilience` version outside the tested range | Install a version in the range, or update `@lenne.tech/nest-server` |
| `ai.agentFunctions is set, but the application imports no AiModule.forRoot()` | The bridge needs `@nestjs/ai`'s module | Import `AiModule.forRoot({ models })` or remove `ai.agentFunctions` |
| An agent function is missing from the tools | It requires `scopes`, or `include` / `exclude` leaves it out | Remove `scopes` and gate it with `@Roles()`; check the filter |
| A role-gated agent function answers 401 from a queue job | Request-less callers are anonymous | Authenticate in the job and pass `caller: { request }` |
| An AI SDK provider reaches a host outside `ai.allowedBaseUrlHosts` | The provider was built with its own `fetch` | Pass the `fetch` from the `registerAiSdkModel()` builder context |
| Vendor mode: `tsc` fails with TS2307 for `ai`, `@nestjs/ai` or `@nestjs/resilience` | The core imports them by literal `import()` | Declare them in the project (`nest-server-core-updater` Phase 7b) |

## Tests to add in the consumer project

For every project tool, and every agent function offered through `ai.agentFunctions`: at least one e2e test that exercises the tool via `POST /ai/prompt` as both a permitted user and a non-permitted user, asserting that the second case results in the LLM saying something like "I don't have a tool for that" (the registry filters it out before the LLM sees it) — NOT a 500.

For confirmation: one test that calls a mutating tool with the LLM's first attempt and verifies the response carries the "confirmation required" state instead of executing.

For budgets: one test that exhausts the user's `maxPrompts` or `maxTokens` for the period and verifies HTTP 429 with the `LTNS_0605` error code.

For MCP (if enabled): one test that hits `POST /ai/mcp` without auth → 401 + `WWW-Authenticate: Bearer …`, one test with auth that runs through `initialize` → `tools/list` → `tools/call`.

## Further reading

- `src/core/modules/ai/README.md` — full feature overview
- `src/core/modules/ai/INTEGRATION-CHECKLIST.md` — canonical step-by-step
- `migration-guides/11.25.x-to-11.26.0.md` — migration notes, breaking changes, troubleshooting
- `migration-guides/12.9.x-to-12.10.x.md` — Standard Schema parameters, agent functions, AI SDK transport, guards on `@nestjs/ai` / `@nestjs/mcp` calls, secret fields out of tool results, resource-bound MCP tokens
- `docs/REQUEST-LIFECYCLE.md` → "Agent function and MCP calls"
- `mcp-integration.md` (same directory) — MCP-server side, including DIY fallback for projects that opt OUT of the AI module
- `src/server/modules/ai/tools/` — reference tool implementations
- `src/core/modules/ai/inputs/core-ai-prompt.input.ts` — prompt input schema (mode, conversationId, attachments, requireConfirmation, rememberDecision, metadata)
