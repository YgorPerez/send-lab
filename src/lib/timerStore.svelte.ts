// A single global interval timer, shared across pages. The engine (interval +
// state) lives here so it keeps running while you navigate; the Train tab shows
// full controls, a footer bar shows it everywhere else, and the Metrics tab can
// load a test protocol into it.
import { browser } from '$app/environment';

type TimerPhase = 'idle' | 'prepare' | 'work' | 'rest' | 'setRest' | 'done';

interface TimerState {
	name: string;
	prepare: number;
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
	/** A one-shot rest countdown (started when a set is marked done). */
	restOnly: boolean;
	/** Identifier of what's loaded, so callers can avoid redundant re-seeding. */
	key: string | undefined;
}

export const timer = $state<TimerState>({
	name: '',
	prepare: 0,
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
	restOnly: false,
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

/** Haptic feedback on phase changes (no-op where unsupported). */
function vibrate(pattern: number | number[]): void {
	if (browser && 'vibrate' in navigator) navigator.vibrate(pattern);
}

// Keep the screen awake while the timer runs (released when it stops). The OS
// drops the lock when the tab is hidden, so we re-acquire on visibility.
let wakeLock: { release: () => Promise<void> } | null = null;
async function acquireWake(): Promise<void> {
	if (!browser) return;
	const nav = navigator as Navigator & {
		wakeLock?: { request(type: 'screen'): Promise<{ release: () => Promise<void> }> };
	};
	if (!nav.wakeLock) return;
	try {
		wakeLock = await nav.wakeLock.request('screen');
	} catch {
		wakeLock = null;
	}
}
function releaseWake(): void {
	void wakeLock?.release();
	wakeLock = null;
}

function clearTick(): void {
	if (handle) clearInterval(handle);
	handle = undefined;
}

function finish(): void {
	clearTick();
	releaseWake();
	timer.running = false;
	timer.phase = 'done';
	timer.remaining = 0;
	beep(880);
	vibrate([140, 70, 140]);
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
		if (timer.remaining <= 3) beep(1000); // 3-2-1 countdown
		return;
	}
	vibrate(80); // a phase is changing
	if (timer.phase === 'prepare') {
		timer.phase = 'work';
		timer.remaining = Math.max(1, timer.work);
		beep(660);
	} else if (timer.phase === 'work') {
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
		if (timer.restOnly) {
			finish();
			return;
		}
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
		timer.restOnly = false;
		timer.set = 1;
		timer.round = 1;
		if (timer.prepare > 0) {
			timer.phase = 'prepare';
			timer.remaining = timer.prepare;
		} else {
			timer.phase = 'work';
			timer.remaining = Math.max(1, timer.work);
		}
	}
	timer.running = true;
	timer.loaded = true;
	beep(660);
	vibrate(80);
	void acquireWake();
	clearTick();
	if (browser) handle = setInterval(tick, 1000);
}

/** Start a one-shot rest countdown (e.g. after marking a set done). */
export function startRest(seconds: number, name: string): void {
	clearTick();
	timer.name = name;
	timer.restOnly = true;
	timer.prepare = 0;
	timer.work = 0;
	timer.rest = Math.max(1, Math.round(seconds));
	timer.rounds = 1;
	timer.sets = 1;
	timer.setRest = 0;
	timer.set = 1;
	timer.round = 1;
	timer.phase = 'rest';
	timer.remaining = Math.max(1, Math.round(seconds));
	timer.running = true;
	timer.loaded = true;
	timer.key = 'rest';
	beep(440);
	vibrate(80);
	void acquireWake();
	if (browser) handle = setInterval(tick, 1000);
}

export function pauseTimer(): void {
	timer.running = false;
	clearTick();
	releaseWake();
}

export function resetTimer(): void {
	clearTick();
	releaseWake();
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
	prepare: number;
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
	timer.prepare = c.prepare;
	timer.work = c.work;
	timer.rest = c.rest;
	timer.rounds = c.rounds;
	timer.sets = c.sets;
	timer.setRest = c.setRest;
	timer.key = c.key;
	timer.restOnly = false;
	if (force) timer.loaded = true;
	resetTimer();
}

// ---- pure compute helpers (call inside $derived to stay reactive) ----
function perSet(): number {
	return timer.rounds * timer.work + Math.max(0, timer.rounds - 1) * Math.max(0, timer.rest);
}

function body(): number {
	return timer.sets * perSet() + Math.max(0, timer.sets - 1) * Math.max(0, timer.setRest);
}

export function timerTotal(): number {
	if (timer.restOnly) return Math.max(0, timer.rest);
	return Math.max(0, timer.prepare) + body();
}

export function timerLeft(): number {
	if (timer.restOnly) return timer.phase === 'done' ? 0 : timer.remaining;
	const r = Math.max(0, timer.rest);
	const sr = Math.max(0, timer.setRest);
	if (timer.phase === 'idle') return timerTotal();
	if (timer.phase === 'done') return 0;
	if (timer.phase === 'prepare') return timer.remaining + body();
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
	if (phase === 'prepare') return 'var(--gold)';
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
				void acquireWake();
			} else {
				timer.running = false;
			}
		}
	} catch {
		// ignore corrupt storage
	}
	// The OS releases the wake lock when the tab is hidden — re-acquire on return.
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'visible' && timer.running && !wakeLock) void acquireWake();
	});
}
