// One fixture snapshot per locale, per screen.
//
// `getPrototypeFixtures()` rebuilds 35 days of session history, recomputes the
// readiness verdict and re-derives the stats on every call. That is fine once a
// screen; it is not fine on every keystroke in a set field, which is what
// happens without the memo — the channel bar and the screen inside it both want
// the same numbers, and `/train` re-renders on every character typed.
//
// The snapshot is taken at mount and re-taken only when the locale changes.
import { useMemo } from 'react';
import { getPrototypeFixtures, type PrototypeFixtures } from '../../prototype-fixtures';
import { useLocale } from './locale';

/** The whole prototype dataset for the active locale. */
export function usePrototype(): PrototypeFixtures {
	const locale = useLocale();
	// `getPrototypeFixtures()` reads the locale through Paraglide's runtime
	// rather than taking it as an argument, so the dependency is invisible to
	// the exhaustive-deps analysis. Carrying it in the memoized value — rather
	// than suppressing the rule — makes it a real one.
	const snapshot = useMemo(() => ({ locale, data: getPrototypeFixtures() }), [locale]);
	return snapshot.data;
}
