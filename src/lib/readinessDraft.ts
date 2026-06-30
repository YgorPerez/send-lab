// A partial readiness check, persisted locally per day so navigating away or
// reloading mid-answer doesn't lose it; it resets automatically on a new day.
import { browser } from '$app/environment';
import type { Answers } from '$lib/content';
import { today } from '$lib/state.svelte';

const KEY = 'sendlab:readinessDraft';

export function loadReadinessDraft(): { answers: Answers; probe: number | null } {
	if (browser) {
		try {
			const d = JSON.parse(localStorage.getItem(KEY) ?? 'null');
			if (d && d.date === today())
				return { answers: (d.answers ?? {}) as Answers, probe: d.probe ?? null };
		} catch {
			// corrupt draft — start fresh
		}
	}
	return { answers: {}, probe: null };
}

export function saveReadinessDraft(answers: Answers, probe: number | null): void {
	if (browser) localStorage.setItem(KEY, JSON.stringify({ date: today(), answers, probe }));
}
