---
status: accepted
---

# Wildcard CORS and redirect_uri handling on the OAuth endpoints are deliberate

`svelte-doctor` reports two security errors against the OAuth server on every run
— `no-broad-cors` and `no-dangerous-redirect-param` (twice). Both were reviewed
and neither is a defect, so the code stays as written. This records why, so the
next reader doesn't "fix" working code and doesn't re-derive the analysis.

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

- `pnpm verify` exits non-zero on these three findings. Making it green would mean
  disabling `no-broad-cors` and `no-dangerous-redirect-param` repo-wide, which
  would also hide a genuine open redirect introduced anywhere else later; a
  baseline file is not an option because `.svelte-doctor/` is gitignored. The
  noisy gate is the lesser cost, but it does mean the chain can't be used as a
  simple pass/fail signal without reading which findings came up.
- If CORS is ever tightened, `Access-Control-Allow-Credentials` must stay unset —
  the safety argument above depends on it, not on the origin value.
- Validating a redirect target before redirecting is load-bearing, not stylistic.
  Any new redirect path in the authorize endpoint has to keep that order.
