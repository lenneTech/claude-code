# MCP Server Integration with nest-server

Guide for exposing the AI tool registry of a `@lenne.tech/nest-server` based NestJS application as an MCP server. Enables Claude Code, ChatGPT Desktop, and any other MCP client to call the project's tools with the same authentication and role gating that the rest of the API uses.

## TL;DR — since 11.26.0 there is nothing to build

The framework ships a **complete, production-ready MCP server out of the box** as part of the AI module (`src/core/modules/ai/`). It exposes the project's `AiToolRegistry` over the MCP Streamable HTTP transport, supports both Bearer/session and OAuth 2.1 authentication, and is mounted automatically by `CoreModule.forRoot()` when the `ai.mcp` config flag is set.

**Consumer projects do NOT roll their own MCP module.** Building a parallel `modules/mcp/` tree (own controller, own OAuth provider, own MongoDB collections) is wasted work and silently bypasses the AI module's role filtering, audit logging, and tool grants.

If you find yourself writing files like `mcp.controller.ts`, `mcp.service.ts`, `mcp-oauth.provider.ts` in a consumer project: stop, delete them, and use the built-in instead.

## What you actually do

### 1. Install the SDK in your project

The MCP SDK is a peer-style optional dependency that the controller lazy-imports on the first MCP request. Projects that don't enable MCP pay no install cost.

```bash
pnpm add @modelcontextprotocol/sdk
```

If `ai.mcp` is set but the SDK is missing, `POST /ai/mcp` returns **503 Service Unavailable** with an actionable install-hint message instead of a 500 trace.

### 2. Enable MCP in `config.env.ts`

```typescript
// config.env.ts
ai: {
  // … your existing ai block (encryptionSecret, defaultConnection, etc.)
  mcp: true,                                              // Bearer / session auth
  // OR for generic MCP clients with auto-discovery:
  // mcp: { oauth: true, oauthSecret: process.env.NSC__AI__MCP_OAUTH_SECRET },
}
```

That is the entire wiring. `CoreModule.forRoot()` registers `CoreAiMcpController` on `POST/GET/DELETE /ai/mcp`, role-filtered against the calling user.

### 3. Mount the OAuth router (only when `ai.mcp.oauth: true`)

```typescript
// main.ts — after app.init(), before listen()
import { mountAiMcpOAuth } from '@lenne.tech/nest-server';

await mountAiMcpOAuth(app, { baseUrl: process.env.BASE_URL });
```

`mountAiMcpOAuth` mounts the SDK's `mcpAuthRouter` against `CoreAiMcpOAuthService.buildOAuthProvider()` — handles discovery (`/.well-known/oauth-authorization-server`), dynamic client registration, authorize, token, refresh.

### 4. Provide your login/consent UI

The interactive consent step is the only thing the framework cannot ship for you — it depends on your auth UI. Override `CoreAiMcpOAuthService.authorizeConsent()` (subclass it and pass via `CoreModule.forRoot(env, { ai: { /* … */ } })`). Inside:

1. Authenticate the user via your existing session/login flow
2. Show consent ("App X wants to act on your behalf — Allow / Deny")
3. On approve: call `this.saveAuthorizationCode(code, { clientId, codeChallenge, userId })`
4. Redirect to `redirect_uri?code=<code>&state=<state>`

All other OAuth pieces — HMAC-signed access tokens with `timingSafeEqual`, PKCE S256, single-use code consumption, refresh-token rotation bound to `client_id` — are built in.

### 5. Register your project tools (this is opt-in!)

The MCP server only exposes what the `AiToolRegistry` holds. Tools self-register when their module is imported:

```typescript
// src/server/modules/ai/tools/find-users.tool.ts
import { Injectable } from '@nestjs/common';
import { AiTool, AiToolContext, AiToolRegistry, RoleEnum } from '@lenne.tech/nest-server';
import { UserService } from '../../user/user.service';

@Injectable()
export class FindUsersAiTool extends AiTool {
  readonly description = 'Search users by email or username. Admin only.';
  readonly name = 'find_users';
  readonly parameters = {
    properties: { query: { type: 'string', description: 'Email or username substring' } },
    type: 'object',
  };
  readonly roles = [RoleEnum.ADMIN];

  constructor(registry: AiToolRegistry, private readonly userService: UserService) {
    super(registry);
  }

  async execute(args: Record<string, unknown>, ctx: AiToolContext) {
    // Routes through CrudService so @Restricted + securityCheck still apply.
    const users = await this.userService.find(
      { filterQuery: { email: { $regex: String(args.query), $options: 'i' } } },
      ctx.serviceOptions,
    );
    return { data: users, success: true };
  }
}
```

Then group them in a module and add it to `ServerModule`:

```typescript
// src/server/modules/ai/ai-tools.module.ts
@Module({
  imports: [UserModule],
  providers: [FindUsersAiTool /*, more tools … */],
})
export class AiToolsModule {}
```

Reference implementations: `src/server/modules/ai/tools/` in the nest-server repo (`find-users.tool.ts`, `get-user.tool.ts`, `delete-user.tool.ts`, `update-user-job-title.tool.ts`).

## What you DO NOT do

If a previous integration (or an older version of this document!) led to any of the following in a consumer project, **delete them and switch to the built-in**:

- `modules/mcp/mcp.controller.ts` with `POST/GET/DELETE /mcp` → use built-in `CoreAiMcpController` at `/ai/mcp`
- `modules/mcp/mcp.service.ts` wrapping `McpServer` lifecycle → use built-in `CoreAiMcpService`
- `modules/mcp/mcp-oauth.provider.ts` implementing `OAuthServerProvider` → use built-in `CoreAiMcpOAuthService.buildOAuthProvider()`
- `modules/mcp/mcp-auth.middleware.ts` mounting `mcpAuthRouter` → use built-in `mountAiMcpOAuth(app)`
- A separate `mcp_oauth_clients` / `mcp_oauth_codes` / `mcp_oauth_refresh_tokens` MongoDB collection → the built-in uses `aiMcpOAuthClients` / `aiMcpOAuthCodes` / `aiMcpOAuthRefreshTokens` with TTL indexes
- A handwritten `tools/` registry feeding `McpServer.tool(…)` → use the framework's `AiToolRegistry`, `AiTool` base class, and the role/mutating/destructive metadata so the same tools also power `POST /ai/prompt`

## Customising the built-in

Every collaborator is overridable via `CoreModule.forRoot(env, { ai: { /* … */ } })`. The override surface for MCP specifically:

```typescript
CoreModule.forRoot(envConfig, {
  ai: {
    // Replace the entire MCP endpoint
    // controller: MyMcpController,             // extends CoreAiMcpController

    // Custom OAuth-server behaviour
    // (e.g. richer user lookup, audit fields, custom token TTL)
    // mcpOauthService: MyMcpOAuthService,     // extends CoreAiMcpOAuthService

    // Add/remove project-internal MCP client behaviour
    // mcpClientService: MyMcpClientService,    // extends CoreAiMcpClientService
  },
});
```

`authorizeConsent()` is the ONE method that virtually every consumer overrides — see "Provide your login/consent UI" above.

## Common pitfalls

| Symptom | Cause | Fix |
|---|---|---|
| `/ai/mcp` returns 503 with "MCP server unavailable" | `@modelcontextprotocol/sdk` not installed | `pnpm add @modelcontextprotocol/sdk` and restart |
| `/ai/mcp` returns 401 with `WWW-Authenticate: Bearer` | No valid token in request | Send the user's session token / JWT in `Authorization: Bearer …`, or use the OAuth flow when `ai.mcp.oauth: true` |
| `/ai/mcp` returns 404 | Server reachable but route not mapped | The AI module is not registered — verify `ai` config block is present and the server logs show `RoutesResolver CoreAiMcpController` at boot |
| `tools/list` returns empty | No project tools registered, or all tools require a role the caller does not hold | Verify `AiToolsModule` is in `ServerModule.imports`; check tool `roles` against the calling user |
| `authorizeConsent is not implemented` thrown on `/authorize` | OAuth enabled but project did not override the consent step | Subclass `CoreAiMcpOAuthService` and override `authorizeConsent()` |
| Two MCP servers respond (one at `/mcp`, one at `/ai/mcp`) | Project still has a handwritten `modules/mcp/` from a pre-11.26.0 integration | Delete the handwritten module, keep `/ai/mcp` |
| Confidential MCP client cannot authenticate at `/token` after secret leak rotation | Pre-fix `getClient()` stripped `client_secret` (bug fixed in 11.26.x) | Bump to the latest 11.26.x patch |

## Verifying the integration end-to-end

```bash
# 1. Server boots and registers the routes
curl -s -o /dev/null -w 'WWW-Authenticate header on 401: %{header.www-authenticate}\n' \
  -X POST http://127.0.0.1:3000/ai/mcp

# 2. Initialize a session as an authenticated user (Bearer / session cookie)
curl -i -X POST http://127.0.0.1:3000/ai/mcp \
  -H 'Authorization: Bearer <YOUR_TOKEN>' \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"id":1,"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"manual-test","version":"1.0"}}}'
# → mcp-session-id header + initialize result event

# 3. List tools
curl -X POST http://127.0.0.1:3000/ai/mcp \
  -H 'Authorization: Bearer <YOUR_TOKEN>' \
  -H 'mcp-session-id: <SESSION_ID_FROM_STEP_2>' \
  -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -d '{"id":2,"jsonrpc":"2.0","method":"tools/list"}'
# → only tools the calling user's roles allow
```

For the OAuth flow, the discovery document is at `GET /.well-known/oauth-authorization-server` once `mountAiMcpOAuth(app)` is mounted.

## Automated MCP tests (required when MCP is enabled)

An MCP client reaches the same services as the REST and GraphQL API, through a different door: its
own authentication, its own role filter (`AiToolRegistry.forUser()`), its own session handling, and
error results instead of HTTP status codes. API tests prove nothing about that door. So wherever API
tests are written, MCP tests are written too, as soon as the project exposes MCP.

### When they are required

| Where | Condition | What gets an MCP test |
|---|---|---|
| nest-server itself | always (the MCP server is part of the AI module) | a change to the AI module, the tool registry, MCP auth or sessions, role or tenant checks a tool relies on, and every tool the repo ships |
| a project | MCP is **present and enabled**: `ai.mcp` is `true` or an object without `enabled: false` (e.g. `{ oauth: true, … }`) in `config.env.ts` for any environment, or the project runs its own MCP module (`@modelcontextprotocol/sdk` imported under `src/`) | every tool it registers, and every change to what a tool reads, writes or permits |

Check the condition before writing the tests, from the code rather than from memory:

```bash
grep -nE "mcp\s*:" src/config.env.ts                       # built-in /ai/mcp enabled?
grep -rln "@modelcontextprotocol/sdk" src/ --include=*.ts   # project-own MCP module?
```

If `ai.mcp` is enabled only for deployed environments, enable it in the `e2e` / `ci` block too: the
tests run there, and a disabled MCP answers 404 to every test.

### What each tool needs

1. **`tools/list` shows it to the roles that may use it and hides it from one that may not.** Use a
   least-privilege user for the negative side, as for API tests.
2. **`tools/call` with valid arguments returns the expected result** for a permitted user. The
   built-in returns the tool's own result as JSON in `result.content[0].text`.
3. **`tools/call` by a user outside its roles is refused without running the tool**:
   `result.isError: true`, and the payload does not appear in the response.
4. **Data isolation**: a tool that returns records returns only those the caller may see, never
   another user's or tenant's.
5. **Invalid input** gives `isError: true` with a message, not a crash or a 500.

Once per project, not per tool: an unauthenticated request gets 401, and a session opened by one
user answers 404 to another user (not 403: confirming that a session id exists would turn the
endpoint into an oracle).

### How to write them

MCP tests are API-level tests: they go through HTTP with a real token, like every TestHelper test,
and never call `CoreAiMcpService` or a tool's `execute()` directly. The user's normal Better-Auth
token is accepted as `Authorization: Bearer …`; no extra MCP token is needed.

**Use the TestHelper's MCP helpers where they exist** (nest-server 11.42.5 and later). Check the
project itself rather than its version, because vendor-mode projects carry the helper in their own
source tree (`src/core/test/`) and never update through npm:

```bash
grep -l "mcpSession" node_modules/@lenne.tech/nest-server/src/test/test.helper.ts src/core/test/test.helper.ts src/test/test.helper.ts 2>/dev/null
```

With a hit, a test reads like this; the helpers handle the `Accept` header, the session header, the
SSE stream and the `initialize` handshake:

```typescript
it('find_users: listed for admins, hidden from users, refused when called by a user', async () => {
  const userSession = await testHelper.mcpSession({ token: userToken });
  expect((await userSession.listTools()).map(tool => tool.name)).not.toContain('find_users');

  const refused = await userSession.callTool('find_users', { query: 'a' });
  expect(refused.isError).toBe(true);

  const adminSession = await testHelper.mcpSession({ token: adminToken });
  const result = await adminSession.callTool('find_users', { query: '@test.com' });
  expect(result.isError).toBeFalsy();
  // `json` is the first text content parsed as JSON: the tool's own `{ data, success }`
  expect(result.json.data.length).toBeGreaterThan(0);
});

// HTTP-level cases a session hides: a single message with an expected status
await testHelper.mcp({ id: 1, method: 'initialize', params: {} }, { statusCode: 401 });
await testHelper.mcp(
  { id: 2, method: 'tools/list' },
  { sessionId: adminSession.sessionId, statusCode: 404, token: userToken },
);
```

`session.request(method, params)` sends any other request and returns the whole JSON-RPC message;
`session.close()` ends the session. The reference is `src/test/README.md` → "MCP Testing" in the
installed nest-server (`src/core/test/README.md` in a vendor-mode project).

**Without the helpers** (no hit above), `TestHelper.rest()` covers the JSON answers (the 401, the
404 on a foreign session), while `initialize`, `tools/list` and `tools/call` answer as an SSE stream
and go through `supertest`, reading the `data:` line. Mention in the final report that a nest-server
update brings the helpers.

```typescript
import request from 'supertest';

/** One JSON-RPC message to /ai/mcp; a request answers as SSE, a notification with 202 and no body. */
async function mcpPost(token: string, body: Record<string, unknown>, sessionId?: string) {
  const req = request(app.getHttpServer())
    .post('/ai/mcp')
    .set('Authorization', `Bearer ${token}`)
    .set('Accept', 'application/json, text/event-stream')
    .set('Content-Type', 'application/json');
  if (sessionId) req.set('mcp-session-id', sessionId);
  const res = await req.send(body);
  const data = (res.text || '').split('\n').find((line) => line.startsWith('data: '));
  return { json: data ? JSON.parse(data.slice(6)) : res.body, res };
}

/** initialize + notifications/initialized, as every MCP client sends them; returns the session id. */
async function mcpSession(token: string): Promise<string> {
  const init = await mcpPost(token, {
    id: 1, jsonrpc: '2.0', method: 'initialize',
    params: { capabilities: {}, clientInfo: { name: 'e2e', version: '1.0.0' }, protocolVersion: '2025-03-26' },
  });
  expect(init.res.status).toBe(200);
  const sessionId = init.res.headers['mcp-session-id'];
  await mcpPost(token, { jsonrpc: '2.0', method: 'notifications/initialized' }, sessionId);
  return sessionId;
}

// tools/call: the tool's result is JSON in result.content[0].text
const call = await mcpPost(adminToken, {
  id: 2, jsonrpc: '2.0', method: 'tools/call', params: { arguments: { query: '@test.com' }, name: 'find_users' },
}, await mcpSession(adminToken));
expect(JSON.parse(call.json.result.content[0].text).data.length).toBeGreaterThan(0);
```

The same pattern runs in nest-server's own `tests/ai.e2e-spec.ts` (block "MCP server (/ai/mcp)"),
which is the place to look for the current shape. Test data follows the usual rules: `@test.com`
users, cleaned up in `afterAll`.

A project with its **own** MCP module (path `/mcp`, its own token format) keeps the same five
points; the appendix below shows how to mint its tokens in tests. The better fix is to move it to
the built-in, which makes these tests shorter and the role filter shared.

## Further reading

- `src/core/modules/ai/INTEGRATION-CHECKLIST.md` — the canonical step-by-step
- `src/core/modules/ai/README.md` — full AI-module feature overview
- `src/core/modules/ai/core-ai-mcp.controller.ts` — controller source
- `src/core/modules/ai/services/core-ai-mcp-oauth.service.ts` — OAuth implementation
- `tests/unit/ai.spec.ts` — unit tests covering both the MCP controller HTTP path and the OAuth 2.1 store flow
- `migration-guides/11.25.x-to-11.26.0.md` — migration notes

---

## Appendix: Building MCP from scratch (fallback path)

The rest of this document describes how to build a **standalone, hand-rolled MCP server** inside a NestJS project without relying on the framework's built-in AI module. **Use the main section above for almost every case** — it is shorter, gets every MCP request through the same audit and role-filter pipeline as `/ai/prompt`, and is automatically maintained by the framework.

**Only fall back to this section when:**

- The project deliberately does NOT use the `ai` config block (e.g. wants MCP without bringing in conversations, audit, budgets, slots, prompt-hints, and the orchestrator)
- The MCP server needs a fundamentally different surface — a non-`/ai/mcp` mount path, a totally separate auth realm, or transports the built-in does not provide
- The project is on a nest-server version older than 11.26.0 and a framework upgrade is genuinely not an option

If none of those apply, scroll back up and use `ai: { mcp: true }` instead.

> The original DIY guide follows. It assumes you are NOT using the AI module at all — if you mix both you will end up with two MCP servers responding under different paths, two OAuth client stores, and two sets of tool registrations.


### Architecture Decision: Remote HTTP MCP

**Preferred approach:** Embed the MCP server directly in the NestJS API as a module.

| Approach | Pros | Cons |
|----------|------|------|
| **Remote HTTP (recommended)** | No separate npm package, direct service access, instant updates | Requires OAuth implementation |
| Stdio npm package | Standard MCP approach, works offline | Separate package to maintain, HTTP roundtrips, version management |

### Required Dependencies

```bash
pnpm add @modelcontextprotocol/sdk
```

The MCP SDK (`@modelcontextprotocol/sdk`) provides:
- `McpServer` — Tool/resource/prompt registration
- `StreamableHTTPServerTransport` — HTTP transport (POST/GET/DELETE)
- `mcpAuthRouter` — Express middleware for OAuth 2.1 endpoints
- `OAuthServerProvider` — Interface for implementing OAuth

### Module Structure

```
modules/mcp/
  mcp.module.ts              # NestJS module
  mcp.controller.ts          # POST/GET/DELETE /mcp (Streamable HTTP)
  mcp.service.ts             # McpServer lifecycle
  mcp-tools.service.ts       # Tool implementations (calls other services)
  mcp-oauth.provider.ts      # OAuthServerProvider wrapping Better Auth
  mcp-auth.middleware.ts      # Factory for mcpAuthRouter integration
```

### OAuth Integration with Better Auth

Since Better Auth doesn't have a native MCP plugin, implement `OAuthServerProvider` manually:

#### OAuthServerProvider Implementation

```typescript
import { OAuthServerProvider } from '@modelcontextprotocol/sdk/server/auth/provider.js';
import { OAuthRegisteredClientsStore } from '@modelcontextprotocol/sdk/server/auth/clients.js';

export class McpOAuthProvider implements OAuthServerProvider {
  // Store OAuth clients in MongoDB collection 'mcp_oauth_clients'
  get clientsStore(): OAuthRegisteredClientsStore { ... }

  // Check Better Auth session → show consent → redirect with auth code
  async authorize(client, params, res): Promise<void> { ... }

  // Return stored code_challenge for PKCE verification
  async challengeForAuthorizationCode(client, code): Promise<string> { ... }

  // Exchange auth code for HMAC-signed access token
  async exchangeAuthorizationCode(client, code): Promise<OAuthTokens> { ... }

  // Rotate refresh token, issue new access token
  async exchangeRefreshToken(client, refreshToken): Promise<OAuthTokens> { ... }

  // Verify HMAC-signed token, return AuthInfo with userId
  async verifyAccessToken(token): Promise<AuthInfo> { ... }
}
```

#### Key Design Decisions

1. **Token format**: HMAC-signed base64url payload (not JWT) — simpler, no library needed
2. **Auth codes**: Stored in MongoDB with TTL (10 min), deleted on exchange
3. **Refresh tokens**: Stored in MongoDB, rotated on each use
4. **PKCE**: Enforced by the SDK's `mcpAuthRouter` (S256)
5. **User identity**: Extracted from Better Auth session cookies during `authorize`

#### MongoDB Collections

| Collection | Purpose | TTL |
|------------|---------|-----|
| `mcp_oauth_clients` | Dynamically registered OAuth clients | No expiry |
| `mcp_oauth_codes` | Authorization codes with PKCE challenge | 10 min |
| `mcp_oauth_refresh_tokens` | Refresh tokens linked to users | No expiry |

### MCP Controller Pattern

```typescript
@ApiExcludeController()  // Hide from Swagger
@Controller('mcp')
@Roles(RoleEnum.S_EVERYONE)  // See "Why S_EVERYONE" below
export class McpController {
  private readonly transports = new Map<string, StreamableHTTPServerTransport>();

  @Post()
  async handlePost(@Req() req, @Res() res): Promise<void> {
    // 1. Verify Bearer token → 401 if missing/invalid
    // 2. Check Mcp-Session-Id header for existing session
    // 3. If init request: create new transport, connect to McpServer
    // 4. Forward request to transport.handleRequest()
    // 5. Register transport AFTER handleRequest (sessionId is set during processing)
  }

  @Get()   // SSE stream for server→client notifications
  @Delete() // Close MCP session
}
```

#### Why `@Roles(S_EVERYONE)` on the MCP Controller

The MCP controller handles authentication **manually** via Bearer tokens (not via Better Auth sessions). But NestJS's `BetterAuthRolesGuard` runs globally and would reject unauthenticated requests before the controller code executes.

`@Roles(RoleEnum.S_EVERYONE)` tells the guard "let all requests through" — the controller's `verifyRequest()` then handles the actual MCP OAuth token verification and returns the proper `401 + WWW-Authenticate` headers that the MCP protocol requires.

**Do NOT use `@Restricted()` here** — `@Restricted` is for model/property-level security, not route access.

#### Pitfall: One McpServer Per Session

`McpServer` from the SDK can only be connected to **one transport at a time**. Calling `connect()` twice throws `"Already connected to a transport"`.

**Wrong:** Single shared McpServer instance
```typescript
// WRONG — second session crashes
private mcpServer = new McpServer(...);
await this.mcpServer.connect(newTransport); // throws on 2nd call
```

**Correct:** Create a new McpServer per session
```typescript
// CORRECT — each session gets its own server
const server = this.mcpService.createMcpServer(); // factory creates + registers tools
await server.connect(transport);
```

#### Pitfall: Transport Session ID Timing

The `StreamableHTTPServerTransport`'s `sessionId` is **not available after `connect()`** — it's generated during `handleRequest()` when the `initialize` message is processed.

```typescript
// WRONG — sessionId is null here
await mcpServer.connect(transport);
this.transports.set(transport.sessionId, transport); // sessionId is null!

// CORRECT — register after handleRequest
await transport.handleRequest(req, res, req.body);
if (transport.sessionId && !this.transports.has(transport.sessionId)) {
  this.transports.set(transport.sessionId, transport);
}
```

#### Important: Token Verification in Controller

The MCP controller must verify Bearer tokens manually (not via NestJS guards), because:
- MCP expects 401 with `WWW-Authenticate` header for OAuth discovery
- NestJS guards would return a different error format
- The `WWW-Authenticate` header must include the resource metadata URL

```typescript
res.status(401).set({
  'WWW-Authenticate': `Bearer resource_metadata="${baseUrl}/.well-known/oauth-protected-resource/mcp"`,
}).json({ error: 'Unauthorized: Bearer token required' });
```

### Mounting the Auth Router

The `mcpAuthRouter` from the SDK is an Express middleware. Mount it in `main.ts` **before** NestJS route handling:

```typescript
// In bootstrap(), after app.init():
const { getConnectionToken } = await import('@nestjs/mongoose');
const { mcpAuthRouter } = await import('@modelcontextprotocol/sdk/server/auth/router.js');

// IMPORTANT: Use getConnectionToken() — NOT the Mongoose Connection class directly.
// server.get(Connection) throws "Nest could not find NativeConnection element"
// because Mongoose registers the connection under a string token, not the class.
const connection = server.get(getConnectionToken());

const middleware = mcpAuthRouter({
  provider: oauthProvider, // pass connection to provider constructor
  issuerUrl: new URL(baseUrl),
  resourceServerUrl: new URL(`${baseUrl}/mcp`),
});
server.use(middleware);
```

#### Pitfall: Mongoose Connection via DI

In NestJS, `@InjectConnection()` works inside modules because Mongoose registers the connection under a **string token** (`getConnectionToken()`), not under the `Connection` class. In `main.ts` where you access the DI container directly via `server.get(...)`, you **must** use the token:

```typescript
// WRONG — throws "Nest could not find NativeConnection element"
import { Connection } from 'mongoose';
const conn = server.get(Connection);

// CORRECT
import { getConnectionToken } from '@nestjs/mongoose';
const conn = server.get(getConnectionToken());
```

This also applies in E2E tests when setting up the OAuth provider via `app.get(...)`.

This creates these endpoints automatically:
- `GET /.well-known/oauth-authorization-server` — OAuth metadata
- `GET /.well-known/oauth-protected-resource/mcp` — Resource metadata
- `POST /authorize` — Authorization endpoint
- `POST /token` — Token exchange
- `POST /register` — Dynamic client registration
- `POST /revoke` — Token revocation

### CORS Configuration for MCP

Add these headers to the CORS config:

```typescript
server.enableCors({
  allowedHeaders: [...existing, 'Mcp-Session-Id'],
  exposedHeaders: ['Mcp-Session-Id'],
  origin: (origin, callback) => {
    // Allow MCP clients (no origin for CLI tools)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
});
```

### Tool Registration Pattern

Use `McpServer.registerTool()` with Zod schemas for input validation:

```typescript
import { z } from 'zod';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
type ToolExtra = RequestHandlerExtra<any, any>;

mcp.registerTool(
  'tool_name',
  {
    description: 'Description with full documentation of what this tool does',
    inputSchema: {
      id: z.string().describe('Resource ID'),
      status: z.string().optional().describe('Filter by status'),
    },
  },
  async (args, extra: ToolExtra) => {
    // extra.authInfo.extra.userId contains the authenticated user ID
    const user = await userModel.findById(extra.authInfo.extra.userId);
    const result = await myService.doSomething(args.id, { currentUser: user });
    return {
      content: [{ text: JSON.stringify(result, null, 2), type: 'text' }],
    };
  },
);
```

#### Pitfall: Tools Without inputSchema Don't Receive authInfo

If you omit `inputSchema` entirely, the MCP SDK does **not** pass `authInfo` to the tool callback. Always provide at least an empty schema:

```typescript
// WRONG — extra.authInfo is undefined
mcp.registerTool('list_items', { description: '...' }, async (_args, extra) => {
  extra.authInfo; // undefined!
});

// CORRECT — empty inputSchema ensures authInfo is passed
mcp.registerTool('list_items', { description: '...', inputSchema: {} }, async (_args, extra) => {
  extra.authInfo; // AuthInfo with userId
});
```

#### Tips for Tool Descriptions

- Include complete documentation of all input schemas in the tool description
- This is the primary way Claude learns what data structures to send
- For complex schemas (e.g., content blocks), embed the full type reference
- Use `z.record(z.string(), z.unknown())` for flexible object fields (not `z.record(z.unknown())`)

### Testing MCP Endpoints

This section covers a hand-rolled module at `/mcp` with its own token format. When MCP tests are
required and what each tool needs is the same as for the built-in: see "Automated MCP tests" above.

`TestHelper.rest()` supports custom `headers` and works for all JSON-based MCP responses (401, 400, 404, consent).
For SSE-based responses (initialize, tool calls), use `supertest` directly with an `Accept: text/event-stream` header.

```typescript
import request from 'supertest';

// Create test token matching the OAuth provider's format
function createTestToken(userId: string): string {
  const payload = { sub: userId, cid: 'test-client', exp: Math.floor(Date.now() / 1000) + 3600, type: 'mcp_access' };
  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', secret).update(payloadStr).digest('base64url');
  return `${payloadStr}.${signature}`;
}

// JSON responses (auth, errors, consent) → use TestHelper.rest()
await testHelper.rest('/mcp', {
  headers: { Authorization: `Bearer ${token}` },
  method: 'POST',
  payload: { id: 1, jsonrpc: '2.0', method: 'initialize', params: {} },
  returnResponse: true,
  statusCode: 401,
});

// SSE responses (initialize, tool calls) → use supertest directly
function mcpPost(server, token, body, sessionId?) {
  let req = request(server)
    .post('/mcp')
    .set('Authorization', `Bearer ${token}`)
    .set('Content-Type', 'application/json')
    .set('Accept', 'application/json, text/event-stream');
  if (sessionId) req = req.set('Mcp-Session-Id', sessionId);
  return req.send(body);
}

// MCP SSE responses need parsing — extract JSON from "data: {...}" lines
function parseMcpResponse(res) {
  if (res.headers['content-type']?.includes('text/event-stream')) {
    const lines = (res.text || '').split('\n').filter(l => l.startsWith('data: '));
    for (const line of lines) {
      try { const p = JSON.parse(line.replace('data: ', '')); if (p.result || p.error) return p; } catch {}
    }
    return {};
  }
  return res.body;
}

// Full MCP handshake (required before tool calls)
const initRes = await mcpPost(httpServer, token, {
  id: 1, jsonrpc: '2.0', method: 'initialize',
  params: { capabilities: {}, clientInfo: { name: 'test', version: '1.0.0' }, protocolVersion: '2025-03-26' },
}).expect(200);
const sessionId = initRes.headers['mcp-session-id'];
await mcpPost(httpServer, token, { jsonrpc: '2.0', method: 'notifications/initialized' }, sessionId).expect(202);

// Tool call (SSE response)
const res = await mcpPost(httpServer, token, {
  id: 2, jsonrpc: '2.0', method: 'tools/call',
  params: { name: 'tool_name', arguments: { id: '...' } },
}, sessionId).expect(200);
const result = parseMcpResponse(res);
```

### OAuth Flow (End-to-End)

```
Claude Code                          NestJS API
    |                                    |
    |  1. POST /mcp (no token)           |
    |------------------------------------→|
    |  2. 401 + WWW-Authenticate         |
    |←------------------------------------|
    |  3. GET /.well-known/oauth-*        |
    |------------------------------------→|
    |  4. POST /register (dynamic)       |
    |------------------------------------→|
    |  5. Browser → /authorize           |
    |     (user logs in via Better Auth)  |
    |  6. Redirect with auth code        |
    |←------------------------------------|
    |  7. POST /token (code exchange)    |
    |------------------------------------→|
    |  8. Access token returned          |
    |←------------------------------------|
    |  9. POST /mcp (Bearer token)       |
    |------------------------------------→|
    |     MCP tools work!                 |
```

### MCP Apps (Interactive UI)

Tools can render interactive HTML dashboards in hosts like Claude Desktop via [MCP Apps](https://modelcontextprotocol.io/extensions/apps/overview). CLI hosts (Claude Code) fall back to JSON text output.

#### Additional Dependency

```bash
pnpm add @modelcontextprotocol/ext-apps
```

#### Pattern

1. **Create HTML** in `modules/mcp/apps/my-dashboard.html` — self-contained with inline CSS/JS
2. **Load `App` class** in the HTML via CDN: `import { App } from 'https://esm.sh/@modelcontextprotocol/ext-apps'`
3. **Register resource** via `registerAppResource()` from `@modelcontextprotocol/ext-apps/server`
4. **Register tool** via `registerAppTool()` with `_meta.ui.resourceUri` pointing to the resource
5. **Enable capability** in `McpServer`: `capabilities: { resources: {}, tools: {} }`

#### Code Example

```typescript
const { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } = require('@modelcontextprotocol/ext-apps/server');
const HTML = readFileSync(join(__dirname, 'apps', 'dashboard.html'), 'utf-8');
const URI = 'ui://my-tool/dashboard.html';

// Resource: serves the HTML
registerAppResource(mcp, 'dashboard', URI,
  { mimeType: RESOURCE_MIME_TYPE },
  async () => ({ contents: [{ uri: URI, mimeType: RESOURCE_MIME_TYPE, text: HTML }] }),
);

// Tool: returns data + renders UI
registerAppTool(mcp, 'my_tool', {
  title: 'Dashboard',
  description: 'Shows an interactive dashboard',
  inputSchema: { id: z.string() },
  _meta: { ui: { resourceUri: URI, csp: { connectDomains: ['https://esm.sh'], resourceDomains: ['https://esm.sh'] } } },
}, async (args, extra) => {
  const data = await service.getData(args.id);
  return { content: [{ text: JSON.stringify(data, null, 2), type: 'text' }] };
});
```

#### HTML App Template

```html
<script type="module">
  import { App } from 'https://esm.sh/@modelcontextprotocol/ext-apps';
  const app = new App({ name: 'My Dashboard', version: '1.0.0' });
  app.connect();
  app.ontoolresult = (result) => {
    const data = JSON.parse(result.content.find(c => c.type === 'text').text);
    // Render dashboard with data
  };
</script>
```

#### CSP Configuration

MCP Apps run in sandboxed iframes with deny-by-default CSP. Declare allowed domains in `_meta.ui.csp`:
- `connectDomains` — Network requests (fetch/XHR)
- `resourceDomains` — Static resources (scripts, styles, images)

#### Further Reading

- [MCP Apps Overview](https://modelcontextprotocol.io/extensions/apps/overview) — Architecture, use cases, security model, client support
- [Build Guide](https://modelcontextprotocol.io/extensions/apps/build) — Step-by-step setup, server + UI implementation, testing

#### Real-World Example

See the offers project: `modules/mcp/apps/analytics-dashboard.html` — renders KPI cards, scroll depth charts, download stats, and visitor lists via `get_offer_analytics`.

### Checklist

- [ ] `@modelcontextprotocol/sdk` installed
- [ ] MCP module created (controller, service, tools, OAuth provider)
- [ ] Module registered in `server.module.ts`
- [ ] `mcpAuthRouter` mounted in `main.ts` via `getConnectionToken()` (not `Connection`)
- [ ] OAuth provider injected into MCP controller via `setOAuthProvider()`
- [ ] `@Roles(RoleEnum.S_EVERYONE)` on MCP controller (not `@Restricted`)
- [ ] CORS headers updated (`Mcp-Session-Id` in allowed + exposed)
- [ ] Token verification returns proper `WWW-Authenticate` header
- [ ] HMAC signature verified with `timingSafeEqual` (not `===`)
- [ ] One `McpServer` per session (factory pattern, not singleton)
- [ ] Transport registered AFTER `handleRequest()` (sessionId timing)
- [ ] All tools have `inputSchema` (even empty `{}`) for authInfo passthrough
- [ ] Tools use `extra.authInfo.extra.userId` for user context
- [ ] Session TTL cleanup (prevents memory leaks from abandoned clients)
- [ ] Consent endpoint has CSRF protection (Origin header validation)
- [ ] Client registration has rate limiting
- [ ] MongoDB TTL + unique indexes on OAuth collections
- [ ] E2E tests use `TestHelper.rest()` for JSON responses, `supertest` for SSE responses
- [ ] E2E tests cover: 401, token manipulation, init handshake, tool calls, CSRF, cross-user isolation

**MCP Apps (optional):**
- [ ] `@modelcontextprotocol/ext-apps` installed
- [ ] `resources: {}` added to McpServer capabilities
- [ ] HTML app file in `modules/mcp/apps/` (self-contained, inline CSS/JS)
- [ ] `registerAppResource` serves HTML as `ui://` resource
- [ ] `registerAppTool` with `_meta.ui.resourceUri` and CSP config
- [ ] HTML uses `App` class from `esm.sh` CDN (not local import)
- [ ] Dark mode support via `prefers-color-scheme` media query
