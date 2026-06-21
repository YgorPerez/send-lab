// A single global interval timer, shared across pages. The engine (interval +
// state) lives here so it keeps running while you navigate; the Train tab shows
// full controls, a footer bar shows it everywhere else, and the Metrics tab can
// load a test protocol into it.
import { browser } from '$app/environment';

type TimerPhase = 'idle' | 'work' | 'rest' | 'setRest' | 'done';

interface TimerState {
	name: string;
	work: number;
	rest: number;
	rounds: number;
	sets: number;
	setRest: number;
	phase: TimerPhase;
	set: number;
	round: number;
	remaining: number;
	running: boolean;
	/** True once something is explicitly loaded or started (drives the footer bar). */
	loaded: boolean;
	/** Identifier of what's loaded, so callers can avoid redundant re-seeding. */
	key: string | undefined;
}

export const timer = $state<TimerState>({
	name: '',
	work: 7,
	rest: 3,
	rounds: 6,
	sets: 1,
	setRest: 0,
	phase: 'idle',
	set: 0,
	round: 0,
	remaining: 0,
	running: false,
	loaded: false,
	key: undefined,
});

let handle: ReturnType<typeof setInterval> | undefined;

function beep(freq: number): void {
	if (!browser) return;
	try {
		const ctx = new AudioContext();
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		osc.frequency.value = freq;
		osc.connect(gain);
		gain.connect(ctx.destination);
		gain.gain.setValueAtTime(0.12, ctx.currentTime);
		gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
		osc.start();
		osc.stop(ctx.currentTime + 0.2);
	} catch {
		// audio unavailable — silent timer is fine
	}
}

function clearTick(): void {
	if (handle) clearInterval(handle);
	handle = undefined;
}

function finish(): void {
	clearTick();
	timer.running = false;
	timer.phase = 'done';
	timer.remaining = 0;
	beep(880);
}

/** Advance past the end of a set (into the inter-set rest, next set, or done). */
function endOfSet(): void {
	if (timer.set >= timer.sets) {
		finish();
		return;
	}
	if (timer.setRest > 0) {
		timer.phase = 'setRest';
		timer.remaining = timer.setRest;
		beep(330);
	} else {
		timer.set += 1;
		timer.round = 1;
		timer.phase = 'work';
		timer.remaining = Math.max(1, timer.work);
		beep(660);
	}
}

function tick(): void {
	if (timer.remaining > 1) {
		timer.remaining -= 1;
		return;
	}
	if (timer.phase === 'work') {
		if (timer.round < timer.rounds && timer.rest > 0) {
			timer.phase = 'rest';
			timer.remaining = timer.rest;
			beep(440);
		} else if (timer.round < timer.rounds) {
			timer.round += 1;
			timer.remaining = Math.max(1, timer.work);
			beep(660);
		} else {
			endOfSet();
		}
	} else if (timer.phase === 'rest') {
		timer.round += 1;
		timer.phase = 'work';
		timer.remaining = Math.max(1, timer.work);
		beep(660);
	} else if (timer.phase === 'setRest') {
		timer.set += 1;
		timer.round = 1;
		timer.phase = 'work';
		timer.remaining = Math.max(1, timer.work);
		beep(660);
	}
}

export function startTimer(): void {
	if (timer.phase === 'idle' || timer.phase === 'done') {
		timer.set = 1;
		timer.round = 1;
		timer.phase = 'work';
		timer.remaining = Math.max(1, timer.work);
	}
	timer.running = true;
	timer.loaded = true;
	beep(660);
	clearTick();
	if (browser) handle = setInterval(tick, 1000);
}

export function pauseTimer(): void {
	timer.running = false;
	clearTick();
}

export function resetTimer(): void {
	clearTick();
	timer.running = false;
	timer.phase = 'idle';
	timer.set = 0;
	timer.round = 0;
	timer.remaining = 0;
}

/** Clear the timer entirely and hide the footer bar. */
export function dismissTimer(): void {
	resetTimer();
	timer.loaded = false;
	timer.name = '';
	timer.key = undefined;
}

interface TimerConfig {
	name: string;
	work: number;
	rest: number;
	rounds: number;
	sets: number;
	setRest: number;
	key?: string;
}

/** Load intervals into the timer. `force` overrides a running session and marks
 *  the timer as loaded (showing the footer bar); otherwise it only applies when
 *  the timer is idle and leaves the "loaded" flag untouched (passive default). */
export function configureTimer(c: TimerConfig, force = false): void {
	if (!force && timer.phase !== 'idle' && timer.phase !== 'done') return;
	timer.name = c.name;
	timer.work = c.work;
	timer.rest = c.rest;
	timer.rounds = c.rounds;
	timer.sets = c.sets;
	timer.setRest = c.setRest;
	timer.key = c.key;
	if (force) timer.loaded = true;
	resetTimer();
}

// ---- pure compute helpers (call inside $derived to stay reactive) ----
function perSet(): number {
	return timer.rounds * timer.work + Math.max(0, timer.rounds - 1) * Math.max(0, timer.rest);
}

export function timerTotal(): number {
	return timer.sets * perSet() + Math.max(0, timer.sets - 1) * Math.max(0, timer.setRest);
}

export function timerLeft(): number {
	const r = Math.max(0, timer.rest);
	const sr = Math.max(0, timer.setRest);
	if (timer.phase === 'idle') return timerTotal();
	if (timer.phase === 'done') return 0;
	if (timer.phase === 'setRest')
		return timer.remaining + perSet() + Math.max(0, timer.sets - timer.set - 1) * (sr + perSet());
	const inSet =
		timer.phase === 'work'
			? timer.remaining + (timer.rounds - timer.round) * (timer.work + r)
			: timer.remaining +
				(timer.rounds - timer.round) * timer.work +
				Math.max(0, timer.rounds - timer.round - 1) * r;
	return inSet + (timer.sets - timer.set) * (sr + perSet());
}

export function timerClock(s: number): string {
	const sec = Math.max(0, Math.round(s));
	return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

export function phaseColor(phase: TimerPhase): string {
	if (phase === 'work') return 'var(--flag)';
	if (phase === 'rest') return 'var(--teal)';
	if (phase === 'setRest') return 'var(--violet)';
	return 'var(--ink-faint)';
}

// ---- persistence: survive page refresh via localStorage ----
const STORAGE_KEY = 'sendlab:timer';

/** Save the timer on every change (call once from a component init). */
export function startTimerPersistence(): void {
	$effect(() => {
		const snapshot = JSON.stringify(timer);
		if (browser) localStorage.setItem(STORAGE_KEY, snapshot);
	});
}

// Restore on load, resuming the interval if it was running.
if (browser) {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw) {
			Object.assign(timer, JSON.parse(raw));
			if (timer.running && timer.phase !== 'idle' && timer.phase !== 'done') {
				handle = setInterval(tick, 1000);
			} else {
				timer.running = false;
			}
		}
	} catch {
		// ignore corrupt storage
	}
}
