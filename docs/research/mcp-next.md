# The MCP server on Next.js — research findings

Resolves ticket `05-mcp-server-on-next` of the Next.js rebuild map. Research only; no
implementation decisions are binding until the corresponding tickets close (01 for the OAuth
keep/drop, 06 for the architecture, 07 for the state model).

**Researched 2026-08-15.** Every claim is cited, and every spec claim names the revision it
applies to. MCP's authorization and transport stories have both changed more than once — a
statement true of `2025-06-18` is not necessarily true of `2026-07-28`.

## Spec revisions in play

| Revision | Status | Why it matters here |
| --- | --- | --- |
| `2024-11-05` | Superseded | Introduced HTTP+SSE. Our server still echoes this version. |
| `2025-03-26` | Superseded | Introduced Streamable HTTP; deprecated HTTP+SSE. |
| `2025-06-18` | Superseded | Introduced the `MCP-Protocol-Version` header. |
| `2025-11-25` | Superseded | The newest revision our current server claims. |
| **`2026-07-28`** | **Current** | Breaking rewrite: no sessions, no `initialize`, per-request `_meta`. |

> "The **current** protocol version is [**2026-07-28**]"
> — <https://modelcontextprotocol.io/specification/versioning>

The current revision is a *hard* break. It removed protocol-level sessions and the
`Mcp-Session-Id` header, removed the GET SSE endpoint and `Last-Event-ID` resumability, and
removed the entire `initialize` / `notifications/initialized` handshake
(<https://modelcontextprotocol.io/specification/2026-07-28/changelog>). Read every section below
with that in mind: the answer for "the spec today" and "the spec our clients actually speak" are
different, and both matter.

---

## 0. What the current server is, and what it relies on

Read from `src/routes/mcp/+server.ts`, `src/lib/server/apiToken.ts`, `src/lib/server/restApi.ts`,
`src/lib/server/stateOps.ts`, `src/lib/server/oauth.ts`.

**It is fully stateless request/response.** There is no session state of any kind:

- No `Mcp-Session-Id` is minted, echoed, or read anywhere in the file.
- No in-memory map, cache, or module-level mutable state. The only module-level values are the
  frozen `TOOLS` array and the `INSTRUCTIONS` string.
- Every `tools/call` does a full `loadUserState(userId)` → mutate → `saveUserState(userId, …)`
  round trip against SQLite/Turso, keyed only by the user id resolved from the bearer token.

So the server *does* carry state across calls — but it is durable per-athlete state in the
database, addressed by a credential the client re-sends on every request. It is not transport
session state. This distinction is the whole answer to question 2.

**Transport: a hand-rolled subset of Streamable HTTP.** It exports only `POST` and `OPTIONS`.
There is no `GET` and no `DELETE`. Every response is a single `application/json` JSON-RPC object
(via SvelteKit's `json()`); no SSE stream is ever opened. It handles exactly three methods —
`initialize`, `tools/list`, `tools/call` — replies `202` with an empty body to any notification
(a body with no `id`), and returns JSON-RPC `-32601` for anything else. It does not validate
`Origin`, and does not read the `MCP-Protocol-Version` header.

**Protocol negotiation is legacy-era only.** `LATEST_PROTOCOL = '2025-11-25'` and
`SUPPORTED_PROTOCOLS = ['2025-11-25', '2025-06-18', '2024-11-05']`; `initialize` echoes the
client's requested version when it is one of those three, else returns the latest. **`2026-07-28`
is not supported.** Under the current revision's compatibility matrix a modern-only client would
fail against it, and vice versa — see question 1.

**Authentication: bearer token, two accepted kinds.** `bearerFromRequest()` pulls
`Authorization: Bearer …`, and `resolveMcpUser()` accepts *either* a personal `sl_…` token
(`apiToken.ts` — one plaintext row per user, re-revealable in Settings, regenerable) *or* an OAuth
access token (`oauth.ts`). On failure it returns HTTP 401 with an RFC 9728 challenge:

```
WWW-Authenticate: Bearer resource_metadata="<origin>/.well-known/oauth-protected-resource/mcp"
```

The same personal token also authenticates the `/api/v1` REST API (`restApi.ts`
`requireUser()`), so the token table is not MCP-only.

**Tool surface: 17 tools, hand-written JSON Schema, hand-written validation.** Every
`inputSchema` is a literal object in `TOOLS`. Validation is imperative code inside `callTool()`
and its helpers (`applySetPhases`, `applyEditDay`, `applySetTarget`, `applySetAutoProgress`,
`isValidExerciseId`, `sanitizeCustomExercise`), throwing `Error` which the handler converts to
`{ content: [...], isError: true }`. Reads return objects that are emitted as
`structuredContent` plus a JSON text block; the eleven write tools share one `WRITE_OUTPUT`
schema attached in a loop.

**`sanitizeState()` is the persistence guard, not an argument guard.** Its own header comment
says the point is that MCP lets a user's AI rewrite any part of their account, so every write is
coerced into a complete valid document. It runs on *both* load and save, and never throws.

Also relevant, and slightly awkward: this repo's own `.mcp.json` registers
`https://send-lab-sable.vercel.app/mcp` as `"type": "http"` with **no headers**. That
configuration has no credential, so the client must attempt the OAuth flow — which is presumably
why `1ff5bc7` ("Fix OAuth token exchange blocked by SvelteKit's CSRF guard") and `7aaabed`
("Purge abandoned OAuth client registrations") exist. Adding a `headers` entry with the personal
token is the alternative, and question 4 is about whether that is legitimate.

---

## 1. Transport

**Streamable HTTP, and it is the only HTTP binding.** The current revision lists exactly two
standard transports — stdio and Streamable HTTP, where "each message is an HTTP POST to a single
MCP endpoint; replies arrive as a JSON object or a request-scoped SSE stream"
(<https://modelcontextprotocol.io/specification/2026-07-28/basic/transports>).

**HTTP+SSE is dead and on the shortest clock of any deprecated feature:**

> **Deprecated**: The HTTP+SSE transport from protocol version 2024-11-05 has been deprecated
> since protocol version `2025-03-26` … New implementations **SHOULD NOT** adopt it; existing
> implementations **SHOULD** migrate to Streamable HTTP.
> — <https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http#http-sse-transport-2024-11-05>

The deprecation registry lists its earliest removal as "three months after SEP-2596 reaches
Final" (<https://modelcontextprotocol.io/specification/2026-07-28/deprecated>). There is no reason
for the rebuild to touch it.

### What a compliant server MUST handle

On `2026-07-28`, the single endpoint is **POST-only**: "The server **MUST** provide a single HTTP
endpoint path … that supports POST." (`2025-11-25` said "both POST and GET".) From
[streamable-http](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http):

- Clients **MUST** send `Accept` listing both `application/json` and `text/event-stream`.
- **A single JSON response is fully compliant.** "If the body is a JSON-RPC *request*, the server
  **MUST** return either `Content-Type: application/json` (a single JSON object) or
  `Content-Type: text/event-stream` (an SSE response stream). The client **MUST** support both."
  The `2025-11-25` wording is materially the same. **Long-lived streams are optional for the
  server**, and the client is obliged to handle the JSON case.
- Notifications: "If the server accepts it, the server **MUST** return HTTP status code
  `202 Accepted` with no body." Our `202` is correct — and has been correct in every revision.
  Note that on `2026-07-28` clients **MUST NOT** POST JSON-RPC *responses* at all.
- `Origin` **MUST** be validated, with "HTTP 403 Forbidden" when present and invalid. **We do not
  do this.** It is the one clear compliance gap in the current implementation.
- Unknown method → "**MUST** respond with `404 Not Found` and a JSON-RPC error with code
  `-32601`". We return `-32601` inside a `200`.
- GET and DELETE: removed. A modern-only server "**SHOULD** respond with `405 Method Not
  Allowed`". (In `2025-11-25`, `405` was likewise the correct answer for "no stream here" —
  <https://modelcontextprotocol.io/specification/2025-11-25/basic/transports>.)

### Session ids

Not merely optional — **abolished**. Changelog major change 1: "Remove protocol-level sessions
and the `Mcp-Session-Id` header from the Streamable HTTP transport. … Servers that need
cross-call state use explicit, server-minted handles passed as ordinary tool arguments." A modern
server should "ignore it, and do not mint or echo session IDs."

Under `2025-11-25` session ids were already **OPTIONAL for the server** ("A server … **MAY**
assign a session ID at initialization time"), binding on the client only once returned. So our
never-setting-it behaviour was legal then and is mandatory now.

### The `initialize` handshake

Also removed on `2026-07-28`. Every request now carries
`io.modelcontextprotocol/protocolVersion` and `io.modelcontextprotocol/clientCapabilities` in
`params._meta` (both **Required**; a missing field → `-32602` and HTTP `400`), servers **MUST**
implement a new `server/discover` method, and version mismatches return
`UnsupportedProtocolVersionError` (`-32022`) instead of being negotiated
(<https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning>,
<https://modelcontextprotocol.io/specification/2026-07-28/server/discover>).

Our legacy-era negotiation ("echo the client's version if supported, else our latest") matches
`2025-11-25`'s rule closely enough — that revision said the server "**MUST** respond with the
same version" if supported, "otherwise … another protocol version it supports … **SHOULD** be the
*latest*" (<https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle>).

### Required headers on the current revision

`MCP-Protocol-Version` arrived in `2025-06-18` ("Require negotiated protocol version to be
specified via `MCP-Protocol-Version` header in subsequent requests when using HTTP"). On
`2026-07-28` it is required on **every** POST and must equal the `_meta` value, else `400` +
`-32020 HeaderMismatch`. Two new siblings join it: `Mcp-Method` (all requests) and `Mcp-Name`
(`tools/call`, `resources/read`, `prompts/get`). "These headers are **REQUIRED** for
compliance." Absent `MCP-Protocol-Version` **MAY** be treated as `2025-03-26` as a legacy
accommodation, otherwise it is a validation failure.

### Backwards compatibility

The spec anticipates dual-era servers: "A server that wishes to support both legacy clients …
and modern clients … **MAY** implement both behaviors," dispatching on request shape — "A request
carrying modern per-request `_meta` is served statelessly …; an `initialize` request selects
legacy semantics" — and **MAY** serve both eras on the same endpoint. The matrix is blunt about
the alternative: **modern client → legacy server fails**, and **legacy client → modern server
fails**.

**Conclusion for Q1.** The rebuild should target Streamable HTTP, POST-only, single-JSON
responses, no sessions, no SSE — which is very close to what we already have in *shape*. The real
work is not the transport style; it is that compliance now means serving **two eras**, and the
current server serves only the older one.

---

## 2. Serverless viability

**Yes, a stateless request/response implementation is spec-compliant — and on the current
revision it is compulsory.** From
<https://modelcontextprotocol.io/specification/2026-07-28/basic/index#statelessness>:

> The Model Context Protocol (MCP) is a **stateless protocol**: all the information needed to
> process a request is contained in the request itself. A server processes each request
> independently; no state should be inferred from previous requests, even those on the same
> connection or stream.
>
> - Servers **MUST NOT** rely on prior requests over the same connection to establish context …
> - State that needs to span multiple requests … **MUST** be referenced by an explicit identifier
>   the client passes on each request.

Our design already matches that model exactly: the "explicit identifier the client passes on each
request" is the bearer token, and the state lives in Turso. Nothing about Vercel's request scoping
threatens it.

### Vercel's actual limits (docs `last_updated 2026-07-01`)

| Limit | Value |
| --- | --- |
| `maxDuration` default | **300 s on every plan**, including Hobby |
| `maxDuration` max | 300 s Hobby · 800 s Pro/Enterprise (1800 s in beta) |
| Memory | 2 GB / 1 vCPU default; 4 GB / 2 vCPU max on Pro |
| Request **or** response body | **4.5 MB** → `413 FUNCTION_PAYLOAD_TOO_LARGE` |
| File descriptors | 1,024 shared across concurrent executions |

Sources: <https://vercel.com/docs/functions/limitations>,
<https://vercel.com/docs/functions/configuring-functions/duration>.

Streaming does **not** extend the Node limit: "For request handlers, this includes time spent
processing the request and sending the response, including streamed responses." Only the Edge
runtime has the split rule (25 s to first byte, then up to 300 s of streaming).

Two consequences worth carrying into the rebuild:

1. **The 4.5 MB payload cap is the limit to actually watch.** `get_state` and every write tool
   return the whole account document. At ~28 KB of state across five accounts today there are
   three orders of magnitude of headroom, but the ceiling is real and it is on the *response*,
   not just the request.
2. **In-memory session state is unsafe even with Fluid compute.** Fluid explicitly *does* share
   memory — "Fluid compute lets multiple invocations share the same physical instance and its
   global state" (<https://vercel.com/docs/fluid-compute>) — but nothing pins a client's requests
   to an instance ("Vercel routes traffic to instances based on load and availability"),
   instances are recycled, cold starts still happen, and multi-region multiplies the pool. So
   instance reuse is a *cache*, never a *store*. A `sessionIdGenerator` plus an in-process session
   map is not viable here. This is precisely why both the official SDK v2 and `mcp-handler` 2.x
   went fresh-server-per-request by design.

---

## 3. `@modelcontextprotocol/sdk` vs `mcp-handler` vs staying hand-rolled

The landscape moved since the ticket was written, and the movement is the deciding factor.

**`@modelcontextprotocol/sdk` is now the legacy v1 line.** The official TypeScript SDK shipped
**v2 as split packages** — `@modelcontextprotocol/server`, `@modelcontextprotocol/client`, plus
`@modelcontextprotocol/node|express|hono|fastify` adapters — released alongside the `2026-07-28`
spec. The repo README states: "This is the `main` branch — v2 of the SDK
(`@modelcontextprotocol/server`, `@modelcontextprotocol/client`), implementing the 2026-07-28 MCP
spec," and "v1.x continues to receive bug fixes and security updates for at least 6 months after
v2's release" (<https://github.com/modelcontextprotocol/typescript-sdk>).

| | v1 `@modelcontextprotocol/sdk` | v2 `@modelcontextprotocol/server` |
| --- | --- | --- |
| Version | 1.30.0 | 2.0.0 |
| Node | ≥18 | ≥20 |
| Zod | peer `^3.25 \|\| ^4.0` | dep `zod ^4.2.0` |
| Deps | 17 (bundles express, hono, cors, ajv, jose…) | **2** (`zod`, `@modelcontextprotocol/core`) |
| Fetch-native? | **No** — Node `req`/`res` only | **Yes** — `createMcpHandler` → `fetch` |

The decisive fact: **v2 exports `createMcpHandler` from the SDK itself, and "`handler.fetch` is a
web-standard `(Request) => Promise<Response>`"** — which drops straight into a Next App Router
route handler. It is stateless by construction: "The factory runs once per HTTP request: a fresh
instance serves every request, and the handler holds nothing between requests," so "the endpoint
is stateless and scales horizontally as-is"
(<https://ts.sdk.modelcontextprotocol.io/v2/serving/http>). Legacy 2025-era clients are served
from the same handler via the `legacy` option, `'stateless'` by default, with an
`isLegacyRequest(request)` helper.

That erases most of `mcp-handler`'s reason to exist. `mcp-handler` **2.1.1** is alive and
maintained (<https://github.com/vercel/mcp-handler>), but it now requires
`@modelcontextprotocol/server ^2.0.0` as a peer and is "Built on MCP SDK v2", serving 2025-era
clients "via the SDK's stateless legacy fallback from the same handler" — i.e. it wraps the SDK's
`createMcpHandler` rather than implementing transport. What remains is a terser callback form, a
CLI scaffolder, a `./next` entry, and the auth helpers. Also notable: **"Redis is no longer
needed or used."** In 1.x Redis was optional and only for SSE resumability, never for Streamable
HTTP; in 2.x SSE is gone and `/sse` returns `410 Gone`.

**Vercel's own docs are stale.** `vercel.com/docs/mcp/deploy-mcp-servers-to-vercel`
(`last_updated 2026-03-19`) still teaches the 1.x API — variadic `server.tool(...)`,
`app/api/[transport]/route.ts`, `{ basePath: '/api' }`, `AnthropicAI`-era import paths. Trust the
package README over the Vercel docs page here.

### The App Router route handler, each way

With SDK v2 directly:

```ts
// app/api/mcp/route.ts
import { createMcpHandler, McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';

const handler = createMcpHandler(() => {
  const server = new McpServer({ name: 'send-lab', version: '2' });
  server.registerTool('set_target', { description: '…', inputSchema: z.object({ … }) }, async (args, ctx) => { … });
  return server;
});

export const POST = handler.fetch;
```

With `mcp-handler` 2.x (README's canonical sample, abridged):

```ts
// app/api/mcp/route.ts
import { createMcpHandler } from 'mcp-handler';
const handler = createMcpHandler((server) => {
  server.registerTool('roll_dice', { title: 'Roll Dice', description: '…', inputSchema: z.object({ sides: z.number().int().min(2) }) }, async ({ sides }) => ({ content: [{ type: 'text', text: `🎲 ${1 + Math.floor(Math.random() * sides)}` }] }));
});
export { handler as GET, handler as POST };
```

Note the two `createMcpHandler`s are **different functions with different signatures** — the SDK's
takes a factory returning an `McpServer`; `mcp-handler`'s hands you the `server`.

### Weighing it honestly

The hand-rolled server works, is ~700 lines including all 17 tool definitions and their
descriptions, has no dependencies, and its statelessness is not an accident of the SDK's design —
it is the shape the problem actually has. "It already works" is a real argument and the SDK has to
beat it.

**What staying hand-rolled costs, specifically.** Not the transport shape (we have that), but:

- Writing the **`2026-07-28` era by hand**: per-request `_meta` parsing with `-32602`/`400` on
  missing required fields, `MCP-Protocol-Version` / `Mcp-Method` / `Mcp-Name` header validation
  against the body with `-32020` on mismatch, `server/discover` (a MUST), `-32022`
  `UnsupportedProtocolVersionError` with a `supported` list, `405` on GET/DELETE, `404` +
  `-32601` on unknown methods, `Origin` validation → `403`, plus keeping the legacy era working
  alongside it. That is a meaningful volume of pure protocol plumbing with no domain content, and
  it has to be re-done at the next revision.
- Continuing to hand-write and hand-maintain 17 JSON Schema literals *and* the imperative
  validators that must agree with them (see question 5).

**What the SDK costs.** `@modelcontextprotocol/server` + `@modelcontextprotocol/core` + `zod` v4
— three packages, and the SDK itself has only those two deps, so the tree stays shallow. This
repo currently has **no zod dependency**, so zod v4 is a genuine addition; in a React rebuild it
is also broadly useful beyond MCP. Node ≥20 is not a constraint on Vercel. Against that: the SDK
owns the wire format, so a bug there is a bug we cannot fix locally, and `registerTool`'s
ergonomics become the shape of our tool layer.

**Recommendation.** Adopt **`@modelcontextprotocol/server` v2 directly**, not `mcp-handler`, and
not hand-rolled. The SDK earns the dependency on exactly one argument: it serves both protocol
eras from one Fetch handler, and hand-writing the modern era is protocol busywork with zero
domain value. `mcp-handler` no longer adds transport — take it only if `withMcpAuth`'s RFC 9728
challenge handling is wanted for free (see question 4), and be aware that its 1.x route options
(`basePath`, `maxDuration`, `sessionIdGenerator`, `redisUrl`, …) are all removed in 2.x.

**The counter-case, stated fairly.** If ticket 01 shrinks the MCP surface substantially, or if the
rebuild is content to serve only the legacy era for now (which is what every client we actually
have speaks today — see question 6, where even the Inspector defaults to `legacy`), then keeping
the hand-rolled handler and porting it to a Next route handler is a legitimate, cheaper choice.
The decision rule: **hand-rolled is fine as long as we accept legacy-era-only. The moment we want
`2026-07-28`, take the SDK.**

---

## 4. Authentication — the consequential question

### Verdict: no. The OAuth server is not required for MCP.

**The spec makes authorization optional, in identical words in both the current and the previous
revisions.** From
<https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization> (and verbatim the
same at <https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization>):

> ### Protocol Requirements
>
> Authorization is **OPTIONAL** for MCP implementations. When supported:
>
> - Implementations using an HTTP-based transport **SHOULD** conform to this specification.
> - Implementations using an STDIO transport **SHOULD NOT** follow this specification, and instead
>   retrieve credentials from the environment.
> - Implementations using alternative transports **MUST** follow established security best
>   practices for their protocol.

Precision matters here, so be exact about what that does and does not say:

- **Required vs recommended.** Authorization as a whole is **OPTIONAL**. For a server that *does*
  implement authorization over HTTP, conforming to the OAuth spec is a **SHOULD**, not a MUST. The
  OAuth 2.1 authorization-code flow is the spec's *specified* mechanism; it is nowhere its
  *mandatory* mechanism.
- **The MUSTs inside that chapter are conditional.** "MCP servers **MUST** implement OAuth 2.0
  Protected Resource Metadata (RFC 9728)" and "Authorization servers **MUST** implement OAuth 2.1"
  both sit under the "When supported" framing. They bind a server that opts into the spec's
  authorization scheme; they do not force a server to opt in.
- **What the spec does forbid** is unrelated to us: tokens in the URI query string ("Access tokens
  **MUST NOT** be included in the URI query string"), accepting tokens not issued for this server,
  and token passthrough. A `Bearer` header is in fact the spec's own transport for credentials:
  "MCP client **MUST** use the Authorization request header field … `Authorization: Bearer
  <access-token>`."
- **The honest caveat.** A server whose only credential is an opaque bearer token it minted itself
  is not *conforming to the authorization specification* — it is declining to implement an
  optional chapter. If we want to claim conformance with that chapter, OAuth is how. Nothing in
  the spec penalises not claiming it.

### Claude as a client: bearer tokens are accepted, first-class, everywhere that matters

Anthropic's connector documentation enumerates the supported authentication types explicitly
(<https://claude.com/docs/connectors/building/authentication>):

| Type | Description | Availability |
| --- | --- | --- |
| `oauth_dcr` | OAuth 2.0 with Dynamic Client Registration | Supported out of the box |
| `oauth_cimd` | OAuth 2.0 with Client ID Metadata Document | Supported out of the box |
| `oauth_anthropic_creds` | OAuth 2.0 with Anthropic-held client credentials | Contact Anthropic |
| `custom_connection` | Custom URL or credentials at connection time | Contact Anthropic |
| **`static_headers`** | **Fixed credential (API key or bearer token) entered … as a request header when adding the connector** | **Beta** |
| `none` | No authentication (authless server) | Supported |

> "Static bearer tokens and API keys are supported in beta through request headers
> (`static_headers`)."

**There is no statement anywhere that a connector must implement OAuth.** On the custom-connector
page, OAuth is explicitly optional: "Optionally configure OAuth Client ID/Secret in Advanced
settings", and "the OAuth Client Secret field is **optional**."

### Remote connectors vs locally-configured servers — this is where they differ

This is the distinction the ticket asked for, and it is the only place the answer is nuanced.

**Locally-configured clients: bearer tokens work today, no beta, no gate.** Claude Code documents
the flag directly (<https://code.claude.com/docs/en/mcp>):

```bash
claude mcp add --transport http secure-api https://api.example.com/mcp \
  --header "Authorization: Bearer your-token"
```

`--header` is repeatable and also spellable `-H`. Scopes are `local` (default, `~/.claude.json`),
`project` (`.mcp.json`, committed), and `user`. An entry with a `url` but no `type` is a
configuration error. For send-lab this means the fix to our own `.mcp.json` is one field: add the
personal `sl_` token as an `Authorization` header alongside the existing `url`, and the OAuth flow
is never reached. The MCP Inspector accepts the same thing via a repeatable `--header "Name:
Value"` or a `headers` object in its config
(<https://modelcontextprotocol.io/docs/2026-07-28/tools/inspector/configuration>).

**The Claude API's MCP connector takes a bearer token as a plain parameter.** `mcp_servers` entries
are `{"type": "url", "url": …, "name": …, "authorization_token": …}` — the caller obtains and
refreshes the token itself; no OAuth flow is performed by the API. Managed Agents likewise support
a `static_bearer` vault credential type alongside `mcp_oauth`.

**Hosted remote connectors (claude.ai web / Desktop / mobile / Cowork): bearer tokens work, but
header auth is still gated.**

> "Request header authentication is in beta. This feature is being slowly rolled out to
> customers; contact Anthropic for early access."
> — <https://claude.com/docs/connectors/custom/remote-mcp>

Details that matter if the rebuild depends on this path: Claude "stores each header value
securely, does not show it again after you save, and sends it on every request"; the header name
must come from a reviewed allowlist that includes `authorization`, `x-api-key`, and
`x-auth-token`; up to four headers; the value is sent **verbatim with no scheme added**, so the
field must contain `Bearer sl_…` including the space. And the credential model is organisational,
not personal:

> "Request headers suit services where everyone in your organization shares one credential …
> If each person needs to sign in with their own account, use OAuth instead."

For a *multi-tenant* SaaS that sentence is a real argument for OAuth. For send-lab it is not: the
domain is "a single athlete per account" (CONTEXT.md), there are five accounts, and each athlete
configures their own client with their own token. One credential per organisation and one
credential per athlete are the same thing when the organisation is one athlete.

**One more first-party data point.** The same page notes that Claude Code "runs its own OAuth flow
on the user's machine and identifies itself with its own Client ID Metadata Document," and that
for high-traffic servers CIMD or Anthropic-held credentials are preferred over DCR because "DCR
causes Claude to register a new client on every fresh connection, which can result in very large
numbers of registered clients on your authorization server." Our hand-rolled server implements
DCR (`/oauth/register`) — the mechanism that both the current spec and Anthropic now steer away
from. On `2026-07-28`, DCR is demoted to a **MAY** and marked deprecated: authorization servers
and clients "**SHOULD** support OAuth Client ID Metadata Documents" and "**MAY** support …
Dynamic Client Registration … Note that Dynamic Client Registration is deprecated and retained
for backwards compatibility."

### So what does this mean for ticket 01

Stated as plainly as the evidence allows:

- **The MCP spec does not require the OAuth authorization-code flow.** Authorization is OPTIONAL;
  conformance is a SHOULD for servers that implement it.
- **Claude does not require it either.** Every surface accepts a bearer token: Claude Code and the
  Inspector via `--header` (GA), the Messages API via `authorization_token`, Managed Agents via a
  `static_bearer` vault credential, and hosted connectors via `static_headers` (beta, gated).
- **The one caveat**: if send-lab must be addable as a claude.ai *hosted* custom connector by
  someone without header-auth early access, OAuth is currently the only route for that surface.
  That is a product question — do we need the web connector, or is the locally-configured client
  the actual use case? — not a spec question. Today's `.mcp.json` says the actual use case is
  Claude Code.
- Deleting the OAuth server would also retire ADR-0004 (as the map already anticipates: "0004 dies
  if the OAuth server is dropped"), the three `svelte-doctor` baseline suppressions it exists to
  justify, the `oauthClient` / `oauthCode` / `oauthAccessToken` / `oauthRefreshToken` tables, the
  cleanup job in `oauthCleanup.ts`, and the four `.well-known` + `/oauth/*` routes. The 401 with
  `WWW-Authenticate` should arguably survive in reduced form — a bearer-only server can still
  return `401` and a plain `Bearer` challenge; only the `resource_metadata` pointer becomes
  meaningless.
- Zero registered clients and 5 tokens in use is not ambiguous evidence. It says the OAuth path
  has never carried load, and the bearer path carries all of it.

---

## 5. Tool definitions and schemas

**SDK v2 declares schemas via Standard Schema and both generates and enforces them.** From
<https://ts.sdk.modelcontextprotocol.io/v2/servers/tools>:

```ts
server.registerTool(
  'search',
  {
    description: 'Search the product catalog',
    inputSchema: z.object({
      query: z.string().describe('Substring to match against product names'),
      limit: z.number().int().max(50).optional(),
    }),
  },
  async ({ query, limit }) => { /* … */ },
);
```

Three properties matter for us:

1. **JSON Schema is derived, not written.** "From that one schema the SDK derives the JSON Schema
   the model sees", and `.describe()` flows into the JSON Schema `description`. The 17
   hand-written `inputSchema` literals become derived artefacts.
2. **Arguments are validated before the handler runs.** The docs show `limit: 999` producing
   `"Input validation error: Invalid arguments for tool search: limit: Too big: expected number
   to be <=50"` with `isError: true`, and state "The SDK rejects the arguments before your handler
   runs."
3. **`outputSchema` is enforced too.** "The SDK validates `structuredContent` against
   `outputSchema` before the result leaves your server." Our `WRITE_OUTPUT` contract goes from
   documentation to invariant.

Schema library: v2 "expects schema objects implementing the Standard Schema spec for
`inputSchema`, `outputSchema`, and `argsSchema`" — "Zod v4, ArkType, and Valibot all implement
the spec." Zod **v3 is hard-dead in v2**. Raw shapes (`{ name: z.string() }`) still work through
`@deprecated` overloads. In v1, by contrast, raw shapes were the normal form and the variadic
`server.tool(name, desc, shape, cb)` signature has been removed in v2.

### Which of our hand-written validation actually goes away

This splits into three buckets, and conflating them would be the mistake:

**Droppable — pure shape, expressible in Zod.** `ASSESS_GOALS` / `ASSESS_FOCI` /
`ASSESS_LEVELS` / `ASSESS_EQUIPMENT` / `INJURY_AREAS` membership checks; `REHAB_AREAS` /
`REHAB_STAGES` membership in `start_rehab` and `rehab_today`; `weekday ∈ WEEKDAYS` and
`dayKey ∈ DAY_TYPE_IDS` in `edit_day`; `answers` non-empty array of numbers in `assess_injury`
(and its `0–10` clamp becomes `z.number().min(0).max(10)`); the nullable numerics in `set_target`;
`isValidExerciseId`'s slug rule as `z.string().regex(/^[A-Za-z0-9_-]{1,40}$/)`; `phases[]` item
shape in `set_periodization`; `daysPerWeek` 1–7. That is most of the `throw new Error('… must be
one of …')` lines in `callTool` and a good part of `programOps`.

**Not droppable — domain invariants, not shapes.** `delete_exercise`'s "no such custom exercise
(built-in exercises cannot be deleted)" depends on the athlete's current document. `create_exercise`'s
`sanitizeCustomExercise` is coercion of a deeply nested variant structure, not validation.
`assess_baseline`'s "seed a marker only when it has no history yet — never clobber logged data".
`deepMerge`'s array-replace semantics. `rehab_today`'s weekday/week defaulting. These are
business rules that must stay wherever the tool layer lives.

**Must stay regardless — `sanitizeState`.** Its inputs are `update_state`'s arbitrary `patch` and
`replace_state`'s arbitrary `state`; those tools are *defined* as accepting an unconstrained
object, so no argument schema can constrain them. It is the guard that keeps a bad write from
producing a document the client cannot render, and it runs on load as well as save. An
`inputSchema` of `z.object({ patch: z.record(z.unknown()) })` type-checks nothing meaningful about
the patch. Do not let "the SDK validates for us" become a reason to weaken it.

Net: the SDK removes the *duplication* between hand-written JSON Schema and hand-written
validators — today the schema is documentation and the validator is enforcement, and they can
drift. It does not remove domain validation. Note also that ticket 07 may reshape the state model
entirely, in which case the `get_state` / `update_state` / `replace_state` contract needs
redesigning rather than re-declaring (the map flags exactly this).

---

## 6. Testing locally against a Next dev server

**MCP Inspector — one binary, three clients.** `@modelcontextprotocol/inspector` **2.2.0**, bin
`mcp-inspector`, Node ≥22.19 (<https://modelcontextprotocol.io/docs/2026-07-28/tools/inspector>):

```bash
npx @modelcontextprotocol/inspector          # web UI (default)
npx @modelcontextprotocol/inspector --cli    # scriptable
npx @modelcontextprotocol/inspector --tui    # terminal UI
```

Point it at the dev server with a token, no registration involved:

```bash
mcp-inspector --cli http://localhost:3000/api/mcp --transport http \
  --header "Authorization: Bearer sl_…" --method tools/list --format json
```

`--transport` accepts `stdio | sse | http`; `--header` is repeatable and works in all three
clients. Tool calls take `--tool-arg key=value` (values are JSON-parsed, so `count=1` becomes a
number) or `--tool-args-json '{"zip":"10001"}'` for verbatim arguments. Exit codes are a usable
taxonomy — `0` success, `2` no MCP app, `3` auth required, `4` unreachable, `5` tool error — and
every non-zero exit writes one JSON line to stderr, which makes a CLI assertion a reasonable CI
gate. Use `--stored-auth-only` in CI so a missing token fails fast instead of opening a browser.

**Gotcha worth knowing before it wastes an afternoon: the Inspector defaults to the *legacy*
protocol era.** `protocolEra` is `legacy | auto | modern` and **`legacy` is the default**, set per
server in the web UI's Server Settings or via `protocolEra` in a catalog/config file — "in the CLI
and TUI it comes from that same file". There is no `--protocol-era` flag, so exercising
`2026-07-28` from `--cli` means `--config ./mcp.json --server <name>` rather than a bare
`--server-url` (<https://modelcontextprotocol.io/docs/2026-07-28/tools/inspector/protocol-eras>).
Incidentally, that default is a decent proxy for where the ecosystem actually is, and supports the
"legacy-era-only is survivable for now" position in question 3.

**Claude Code as the test client, without re-registering.** Add once
(<https://code.claude.com/docs/en/mcp>, <https://code.claude.com/docs/en/mcp-quickstart>):

```bash
claude mcp add --transport http local-next http://localhost:3000/api/mcp \
  --header "Authorization: Bearer dev-token"
```

Then, for iterating on server code:

- **Tool-list changes need nothing** if the server emits the notification: "Claude Code supports
  MCP `list_changed` notifications, allowing MCP servers to dynamically update their available
  tools, prompts, and resources without requiring you to disconnect and reconnect."
- **The `/mcp` panel is the manual lever** — it "lets you reconnect or authenticate without
  leaving the session"; `claude mcp list` / `claude mcp get <name>` show health from the shell.
- **HMR drops self-heal**: "If an HTTP or SSE server disconnects mid-session, Claude Code
  automatically reconnects with exponential backoff: up to five attempts, starting at a one-second
  delay and doubling each time."
- **But editing `.mcp.json` does require a restart**: "Claude Code reads `.mcp.json` at session
  start. Exit and restart the session after editing the file."
- `headersHelper` (a command whose JSON stdout is merged into headers, re-run on 401/403) is a
  neat fit for short-lived dev tokens.

**Automated tests without a socket.** SDK v2's testing guide is explicit that the old in-memory
transport is legacy-only: "`createLinkedPair` connects 2025-era instances only; `handler.fetch`
is the in-process entry for 2026-07-28 coverage." The sanctioned modern pattern drives the real
handler in-process (<https://ts.sdk.modelcontextprotocol.io/v2/testing>):

```ts
const handler = createMcpHandler(createServer);
const transport = new StreamableHTTPClientTransport(new URL('http://test.local/mcp'), {
  fetch: (url, init) => handler.fetch(new Request(url, init)),
});
```

"The transport never dials `http://test.local/mcp` — `handler.fetch` serves every request
in-process." This exercises the full HTTP/JSON-RPC layer including header validation with zero
network, which makes it the right shape for the ticket-09 verify gate. Two documented hygiene
rules: assert on `structuredContent` because failures return `{ isError: true }` rather than
throwing, and close the client before the handler.

**`curl` still works, but the modern revision makes it verbose.** There is no official curl
recipe; the debugging guide only suggests "standard HTTP tooling". Under `2026-07-28` a compliant
POST needs `MCP-Protocol-Version`, `Mcp-Method`, `Mcp-Name` (for `tools/call`), `Accept` listing
both content types, and `params._meta` carrying `io.modelcontextprotocol/protocolVersion` and
`clientCapabilities`. Against a legacy-era server (what we have today) a two-line curl with just
`Authorization` and `Content-Type` is still enough — which is worth remembering as a smoke test.

**One security note that bites on localhost.** The SDK handler "validates neither `Host` nor
`Origin`", while the spec requires `Origin` validation with `403`. Compose
`localhostHostValidation()` / `localhostOriginValidation()` from `@modelcontextprotocol/node`, or
use `hostHeaderValidationResponse` / `originValidationResponse` from `@modelcontextprotocol/server`
on web-standard runtimes. Our current server does none of this.

---

## Carrying this into the rebuild

1. **Transport**: Streamable HTTP, POST-only, single JSON responses, no sessions, no SSE. Add the
   `Origin` → `403` check we currently lack.
2. **Serverless**: a non-issue. Statelessness is now mandated by the spec and matches our design.
   Watch the 4.5 MB response cap on whole-document returns; never keep session state in memory,
   Fluid compute notwithstanding.
3. **Library**: `@modelcontextprotocol/server` v2 + zod v4, `export const POST = handler.fetch`.
   Skip `mcp-handler` unless `withMcpAuth` is wanted. Hand-rolled stays defensible only if we
   accept legacy-era-only.
4. **Auth**: bearer token is sufficient and first-class. The OAuth server is not required by the
   spec or by Claude. Feed this to ticket 01 as a delete recommendation, with the single caveat
   about hosted claude.ai connectors and the `static_headers` beta gate.
5. **Schemas**: declare in Zod, let the SDK derive JSON Schema and validate arguments and outputs.
   Delete the shape checks; keep the domain invariants; keep `sanitizeState` unconditionally.
6. **Testing**: `mcp-inspector --cli` for manual probing (remember the `legacy` era default),
   Claude Code with `--header` for real-client testing, and `handler.fetch` driven by
   `StreamableHTTPClientTransport` for the automated gate.

### Open questions this research cannot settle

- Does any real user need send-lab as a **hosted** claude.ai connector, or is Claude Code /
  locally-configured clients the whole story? This is the only input that could keep OAuth alive.
- Which protocol era do the clients we actually care about speak today, and when will they move to
  `2026-07-28`? This sets the urgency behind the SDK recommendation, not its direction.
- Ticket 07 may reshape the account document, which would make the `get_state` / `update_state` /
  `replace_state` contract a redesign rather than a port.
