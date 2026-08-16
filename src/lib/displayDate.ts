// Locale-dependent date formatting, kept out of `dates.ts` on purpose: that
// module documents itself as dependency-free so the store and the pure analytics
// can share one definition of "which day is this". This one reaches for the
// active Paraglide locale, so it is display-only.
//
// ADR-0003: a formatted date is never an identity. Match on the ISO date or the
// epoch timestamp; render one of these only at the last moment. A stored display
// date is frozen in whatever language wrote it, which is how a language switch
// used to split today's entry in two.
import { isoDayOf, isoToday } from './dates';
import { getLocale } from './paraglide/runtime';

/** Today as a localized display date (e.g. "Jun 24"). Display only. */
export function today(): string {
	return new Date().toLocaleDateString(getLocale(), { month: 'short', day: 'numeric' });
}

/** Format a stored ISO calendar date (YYYY-MM-DD) for display in the active
 *  locale. Prefer this over a stored display date. */
export function displayDate(iso: string): string {
	const [y, m, d] = iso.split('-').map(Number);
	if (!y || !m || !d) return iso;
	return new Date(y, m - 1, d).toLocaleDateString(getLocale(), {
		month: 'short',
		day: 'numeric',
	});
}

/** Whether a dated log entry belongs to today. Prefers the locale-independent
 *  timestamp; falls back to the stored display date only for entries written
 *  before timestamps were recorded. */
export function isTodayEntry(e: { at?: number; date?: string }): boolean {
	if (typeof e.at === 'number') return isoDayOf(e.at) === isoToday();
	return e.date === today();
}
