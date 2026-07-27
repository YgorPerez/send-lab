---
status: accepted
---

# Wildcard CORS and redirect_uri handling on the OAuth endpoints are deliberate

`svelte-doctor` raises two security rules against the OAuth server —
`no-broad-cors` and `no-dangerous-redirect-param` (twice). Both were reviewed and
neither is a defect, so the code stays as written and the three findings are
suppressed through a committed baseline (see Consequences). This records why, so
the next reader doesn't "fix" working code and doesn't re-derive the analysis.

**Wildcard CORS is required and safe here.** The discovery endpoints (RFC 8414 /
RFC 9728) are meant to be publicly readable cross-origin, and the token,
registration, and MCP endpoints have to be reachable by browser-based clients we
don't know the origins of in advance — dynamic client registration means there is
no origin allowlist to write. `Access-Control-Allow-Credentials` is deliberately
never set anywhere in the codebase, and none of these endpoints authenticate with
cookies: they take a Bearer token the caller must attach explicitly. A wildcard
origin without credentials mode cannot expose another user's data, because the
browser will not attach anyone's token for an attacker.

**The redirect_uri is allowlisted before every redirect.** The two flagged lines
don't redirect at all — one stores the URI on the authorization code, the other
compares it during the code exchange (the RFC 6749 §4.1.3 check). The actual
redirects live in the authorize endpoint, and every one of them — success, denial,
and each error path — happens only after the URI has been matched against the
client's registered `redirect_uris`. The login bounce is an internal relative
path. The rule is matching on the identifier name.

## Consequences

- These three findings are suppressed through a versioned baseline, so
  `pnpm verify` is green and can be read as a plain pass/fail signal again.
  `.svelte-doctor/baseline.json` is committed via a negation in `.gitignore`, and
  `pnpm doctor` passes `--baseline`.

  An earlier revision of this ADR rejected the baseline on the grounds that
  `.svelte-doctor/` is gitignored. That was wrong: a negated path is tracked
  normally, and svelte-doctor's gitignore sync deliberately preserves such
  negations. Disabling the two rules repo-wide was never the only alternative to
  a noisy gate.

  The baseline suppresses by fingerprint — rule, file, line, column and message —
  so `no-broad-cors` and `no-dangerous-redirect-param` stay active everywhere
  else. This was verified by introducing a fresh wildcard-CORS violation in
  another file: it still failed the gate while these three stayed suppressed.

  Because the fingerprint pins line numbers, editing `oauth.ts` around these
  sites makes the entries stop matching and the findings reappear. That is the
  intended behavior — the analysis above is re-reviewed rather than inherited.
  Regenerate with `npx svelte-doctor baseline` only after re-confirming the
  reasoning, never as a reflex to make the gate quiet.
- If CORS is ever tightened, `Access-Control-Allow-Credentials` must stay unset —
  the safety argument above depends on it, not on the origin value.
- Validating a redirect target before redirecting is load-bearing, not stylistic.
  Any new redirect path in the authorize endpoint has to keep that order.
