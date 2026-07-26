// Calendar-date helpers. Dependency-free so both the reactive state module and
// the pure analytics can share one definition of "which day is this".
//
// A training day is a *local* calendar day. Deriving it via toISOString() would
// use UTC and roll over early for anyone behind UTC — an evening session in
// UTC-3 would land on tomorrow — so every ISO day here is built from local parts.

/** A Date as an ISO calendar date (YYYY-MM-DD) in local time. */
export function isoDay(d: Date): string {
	const month = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${d.getFullYear()}-${month}-${day}`;
}

/** Today as an ISO calendar date (YYYY-MM-DD) in local time. */
export function isoToday(): string {
	return isoDay(new Date());
}

/** Epoch ms as an ISO calendar date (YYYY-MM-DD) in local time. */
export function isoDayOf(ms: number): string {
	return isoDay(new Date(ms));
}
