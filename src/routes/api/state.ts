// `/api/state` — the seam the whole rebuild writes through.
//
// A plain `Request`→`Response` server route (ADR 0006, #17): no middleware, no
// Server Actions. Authorization is per-handler through `withAthlete()`, which is
// also where the same-origin guard runs, and `pnpm check:routes` fails the gate
// if a method here ever stops going through it.
//
// TWO METHODS, AND WHY NOT THREE
// ------------------------------
// `GET` hydrates: every collection, tombstones excluded. `PUT` applies a batch of
// per-key writes, where a `data` of `null` is a delete. A delete does not get its
// own method because under last-write-wins it is not its own operation — it is a
// write whose content is "gone", ordered against the others by the same clock. A
// separate `DELETE` would be a second path to the same table with its own chance
// to disagree about ordering.
//
// THE BODY IS NOT THE TRUTH
// -------------------------
// Everything in a request is the athlete's own device talking, and their own AI
// through `/mcp` will talk to this module too — so every row goes through
// `sanitizeRow` before it reaches storage, and the account id comes from the
// session or the bearer token and never from the payload. A malformed row is
// rejected by name and the rest of the batch still lands: that is the per-key
// equivalent of what `sanitizeState` used to do to a whole document, and it is
// strictly better, because there is no longer any reason to guess at what the
// athlete meant.
//
// The write path is deliberately **online only**. ADR 0008 is explicit that
// `@tanstack/offline-transactions` is what makes a write durable offline, and the
// outbox is #58's — this ticket makes the writes correct, that one makes them
// survive a tunnel.
import { createFileRoute } from '@tanstack/react-router';
import { db } from '../../lib/server/db';
import { applyWritesIn, readRecordIn } from '../../lib/server/record/store';
import { parseWriteBatch } from '../../lib/server/record/wire';
import { withAthlete } from '../../lib/server/withAthlete';

export const Route = createFileRoute('/api/state')({
	server: {
		handlers: {
			GET: withAthlete(async ({ athlete }) => {
				return Response.json(await readRecordIn(db, athlete.accountId));
			}),

			PUT: withAthlete(async ({ request, athlete }) => {
				let body: unknown;
				try {
					body = await request.json();
				} catch {
					return Response.json({ error: 'body must be JSON' }, { status: 400 });
				}

				const batch = parseWriteBatch(body);
				if (!batch.ok) return Response.json({ error: batch.reason }, { status: 400 });

				const outcome = await applyWritesIn(db, athlete.accountId, batch.writes);
				// 200 with a report, not 4xx, even when rows were rejected: the batch is
				// many independent writes and most of them worked. The client needs to
				// know *which* it lost — a status code cannot say that, and retrying a
				// malformed row would only fail again.
				return Response.json({ ...outcome, rejected: batch.rejected });
			}),
		},
	},
});
