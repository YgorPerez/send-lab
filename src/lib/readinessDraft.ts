// A partial readiness check, persisted locally per day so navigating away or
// reloading mid-answer doesn't lose it; it resets automatically on a new day.
import type { Answers } from '$lib/content';
import { isoToday } from '$lib/dates';
import { today } from '$lib/displayDate';

/** The app is client-only (ADR 0006), but the shell prerenders, so guard the
 *  `localStorage` reads rather than assuming a browser. */
const browser = typeof window !== 'undefined';

const KEY = 'sendlab:readinessDraft';

export function loadReadinessDraft(): { answers: Answers; probe: number | null } {
	if (browser) {
		try {
			const d = JSON.parse(localStorage.getItem(KEY) ?? 'null');
			// `day` is the ISO date; `date` is the legacy localized string, still
			// accepted so switching language doesn't discard a draft written today
			// under the old scheme (ADR-0003).
			if (d && (d.day === isoToday() || (d.day == null && d.date === today())))
				return { answers: (d.answers ?? {}) as Answers, probe: d.probe ?? null };
		} catch {
			// corrupt draft — start fresh
		}
	}
	return { answers: {}, probe: null };
}

export function saveReadinessDraft(answers: Answers, probe: number | null): void {
	if (browser) localStorage.setItem(KEY, JSON.stringify({ day: isoToday(), answers, probe }));
}
