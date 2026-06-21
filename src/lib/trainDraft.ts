// Persist the Train tab's in-progress sets + note to localStorage so a page
// refresh doesn't lose what you've filled in (committed workouts go to the log).
import { browser } from '$app/environment';
import type { WorkoutSet } from './state.svelte';

const DRAFT_KEY = 'sendlab:train-draft';

interface TrainDraft {
	sets: Record<string, WorkoutSet[]>;
	note: string;
}

export function loadTrainDraft(): TrainDraft {
	if (browser) {
		try {
			const raw = localStorage.getItem(DRAFT_KEY);
			if (raw) {
				const d = JSON.parse(raw);
				return { sets: d.sets ?? {}, note: d.note ?? '' };
			}
		} catch {
			// ignore corrupt storage
		}
	}
	return { sets: {}, note: '' };
}

export function saveTrainDraft(draft: TrainDraft): void {
	if (browser) localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}
