// `/api/tokens` — the account's one personal API token.
//
// Kept from the SvelteKit app by #12 alongside the hand-rolled `apiToken.ts`,
// specifically so the token can be re-revealed on Settings: `@better-auth/api-key`
// hashes at rest and cannot. A plain `Request`→`Response` route through
// `withAthlete` like every other (ADR 0006), and `pnpm check:routes` fails the
// gate if a method here ever stops going through it.
//
// `GET` reads, minting on first call so a freshly created account is never
// without one. `POST` regenerates: the old token stops authenticating the
// instant the row changes, which is why the client puts an alert dialog in
// front of it.
import { createFileRoute } from '@tanstack/react-router';
import { getOrCreateToken, regenerateToken } from '../../lib/server/apiToken';
import { withAthlete } from '../../lib/server/withAthlete';

export const Route = createFileRoute('/api/tokens')({
	server: {
		handlers: {
			GET: withAthlete(async ({ athlete }) => {
				return Response.json({ token: await getOrCreateToken(athlete.accountId) });
			}),
			POST: withAthlete(async ({ athlete }) => {
				return Response.json({ token: await regenerateToken(athlete.accountId) });
			}),
		},
	},
});
