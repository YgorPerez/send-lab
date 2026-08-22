// The `/api/state` request envelope, as a pure function of a parsed body.
//
// Split from `rows.ts` because they answer different questions and fail
// differently. `rows.ts` answers *is this a row* — and one bad row is a normal
// outcome that the rest of the batch survives. This module answers *is this a
// request at all*, where the answer is one 400 for the whole thing.
//
// It is pure and it takes an already-parsed body rather than a `Request`, so the
// MCP tools can hand it a payload they assembled themselves instead of one that
// arrived over HTTP. That is the shared-module requirement from the rendering
// decision: mutations are replayable as plain HTTP, and the endpoint is one
// caller of this rather than the place the rules live.
import type { UnsyncedWrite, WriteRejection } from '$lib/recordWire';
import { isCollection, sanitizeRow } from './rows';

/**
 * The most rows one request may carry.
 *
 * The outbox (#58) flushes a queue in one request, so this is not a small number
 * — but it is a number, because a body with no ceiling is a way to make one
 * request cost the whole function's memory. A week of dense training is a few
 * dozen rows; five hundred is a very long time offline, and a client with more
 * than that sends two requests.
 */
const MAX_WRITES = 500;

/** A parsed batch, or the one reason the request is not a request.
 *
 *  `UnsyncedWrite` and `WriteRejection` are `lib/recordWire.ts`'s — the client
 *  sends the one and reads the other, and a second declaration of either here
 *  would be the same shape under two names across one seam (ADR 0014). Every
 *  write in `writes` has been through `sanitizeRow`, so `row` is the parsed row
 *  and not the caller's object. */
export type ParsedBatch =
	| { readonly ok: true; readonly writes: UnsyncedWrite[]; readonly rejected: WriteRejection[] }
	| { readonly ok: false; readonly reason: string };

function isObject(v: unknown): v is Record<string, unknown> {
	return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Read a `PUT /api/state` body.
 *
 * The envelope is `{ writes: [{ collection, key, row, at }] }`, where a `row` of
 * `null` is a delete. One method and one shape for both, because they are the
 * same operation under the merge rule — a delete is a write whose content is
 * "gone", and giving it its own HTTP method would give it its own chance to
 * disagree about ordering.
 *
 * Every upsert is checked by `sanitizeRow` here, so nothing downstream has to
 * remember to. A row that fails lands in `rejected` and the batch continues.
 */
export function parseWriteBatch(body: unknown): ParsedBatch {
	if (!isObject(body)) return { ok: false, reason: 'body must be an object' };
	const raw = body.writes;
	if (!Array.isArray(raw)) return { ok: false, reason: '`writes` must be an array' };
	if (raw.length > MAX_WRITES) {
		return { ok: false, reason: `at most ${MAX_WRITES} writes per request, got ${raw.length}` };
	}

	const writes: UnsyncedWrite[] = [];
	const rejected: WriteRejection[] = [];

	for (const entry of raw) {
		if (!isObject(entry)) return { ok: false, reason: 'every write must be an object' };
		const { collection, key, row, at } = entry;
		// The three envelope fields are the batch's own shape rather than the row's,
		// so getting one wrong is a malformed request and not a rejected row: there
		// is nothing to name in the report.
		if (typeof collection !== 'string' || typeof key !== 'string') {
			return { ok: false, reason: '`collection` and `key` must be strings' };
		}
		if (typeof at !== 'number' || !Number.isFinite(at) || at < 0) {
			return { ok: false, reason: `\`at\` must be epoch ms, on ${collection}/${key}` };
		}

		// A delete carries no row, so there is nothing to check but the collection.
		// A key that names no row is not an error: it tombstones something that was
		// never there, which is what a delete replayed twice looks like.
		if (row === null) {
			if (!isCollection(collection)) {
				rejected.push({ collection, key, reason: `unknown collection "${collection}"` });
				continue;
			}
			writes.push({ collection, key, row: null, at });
			continue;
		}

		const check = sanitizeRow(collection, key, row);
		if (!check.ok) {
			rejected.push({ collection, key, reason: check.reason });
			continue;
		}
		writes.push({ collection, key, row: check.row, at });
	}

	return { ok: true, writes, rejected };
}
