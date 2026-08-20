// Locale-dependent date formatting, kept out of `dates.ts` on purpose: that
// module documents itself as dependency-free so the store and the pure analytics
// can share one definition of "which day is this". This one reaches for the
// active Paraglide locale, so it is display-only.
//
// ADR-0003: a formatted date is never an identity. Match on the ISO date or the
// epoch timestamp; render one of these only at the last moment.
//
// This module used to also export `today()` and `isTodayEntry()`. Both existed to
// compare a *stored* display date against a freshly formatted one, as a fallback
// for entries written before timestamps were recorded. No entity stores a display
// date any more (#55), and #11's Out of scope guarantees no pre-timestamp data is
// ever ported, so the comparison could not match and the fallback could not fire.
// They went with the field.
import { getLocale } from './paraglide/runtime';

/** Format a stored ISO calendar date (YYYY-MM-DD) for display in the active
 *  locale. The only way a date reaches a screen. */
export function displayDate(iso: string): string {
	const [y, m, d] = iso.split('-').map(Number);
	if (!y || !m || !d) return iso;
	return new Date(y, m - 1, d).toLocaleDateString(getLocale(), {
		month: 'short',
		day: 'numeric',
	});
}
