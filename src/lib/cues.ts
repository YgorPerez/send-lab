// Timer cues: the sounds and the buzz that tell the athlete a segment changed
// while they are hanging off a board and not looking at the phone.
//
// **Segment, not phase** — the glossary reserves *phase* for a stretch of weeks
// and lists it on Segment's `_Avoid_` list (#75).
//
// Carried over from the SvelteKit app's `timerStore.svelte.ts`, at the athlete's
// request — *"beep/haptic same sound we have now"*. Same frequencies, same
// envelope, same vibration patterns, so a session sounds identical after the
// rebuild. What changed is where it lives and how the context is managed.
//
// WHY IT IS A MODULE AND NOT PART OF THE TIMER COMPONENT
// -----------------------------------------------------
// The interval protocol is a pure function (`step` in `lib/protocol.ts`), and so
// is the decision about which cue a transition fires (`planCues`, beside it).
// This is the imperative half: it plays what it is handed and decides nothing,
// and mixing the two is what made the Svelte version impossible to test. Naming
// the cues after *what happened* rather than after what they sound like keeps
// the planner out of the audio business: it says `'rest'`, not `beep(440)`.
//
// ONE AUDIO CONTEXT, NOT ONE PER BEEP
// -----------------------------------
// The original constructed `new AudioContext()` on every cue. Browsers cap the
// number of contexts a document may hold (~6 in Chrome) and closing is not
// automatic, so a long interval session eventually throws and the timer goes
// silent partway through — exactly when the athlete has stopped watching it.
// One context is created lazily, on the first cue, which is always downstream of
// a tap on Start: an `AudioContext` constructed before a user gesture starts
// `suspended` and stays that way.
//
// HAPTICS
// -------
// #54 declined haptics as a product decision, on the grounds that iOS has no
// `navigator.vibrate` and Apple formally opposes the spec. The athlete trains on
// Android, has since asked for the buzz back, and this is the one place in the
// app that has it — a segment change nobody is looking at. Reversed here, for the
// timer only. Everywhere else the decision stands.

import type { BuzzedCue, Cue, Delivery } from './protocol';

/** One tone, or several played in sequence for a distinct cue. */
const TONES: Record<Cue, number[]> = {
	start: [660],
	// A rising two-note chime, so "go" is the one cue that cannot be mistaken
	// for any of the single beeps around it.
	go: [784, 1175],
	rest: [440],
	work: [660],
	setRest: [330],
	countdown: [1000],
	done: [880],
};

/** `navigator.vibrate` argument. No countdown entry: the planner never buzzes
 *  one, and `BuzzedCue` says so — see `protocol.ts`. */
const BUZZ: Record<BuzzedCue, number | number[]> = {
	start: 80,
	go: 80,
	rest: 80,
	work: 80,
	setRest: 80,
	done: [140, 70, 140],
};

const GAIN = 0.14;
const DECAY_SEC = 0.2;
const NOTE_GAP_SEC = 0.14;

type AudioContextCtor = new () => AudioContext;

let context: AudioContext | null = null;
let audioUnavailable = false;

function audio(): AudioContext | null {
	if (context || audioUnavailable) return context;
	const Ctor =
		typeof window === 'undefined'
			? undefined
			: ((window.AudioContext ??
					(window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext) as
					| AudioContextCtor
					| undefined);
	if (!Ctor) {
		audioUnavailable = true;
		return null;
	}
	try {
		context = new Ctor();
	} catch {
		// No audio on this device, or the document is not allowed any. A silent
		// timer is a working timer; there is nothing worth telling the athlete.
		audioUnavailable = true;
	}
	return context;
}

function tone(ctx: AudioContext, frequency: number, at: number): void {
	const osc = ctx.createOscillator();
	const gain = ctx.createGain();
	osc.frequency.value = frequency;
	osc.connect(gain);
	gain.connect(ctx.destination);
	gain.gain.setValueAtTime(GAIN, at);
	// Exponential, not linear: a linear fade to zero clicks at the end, and a
	// click on every rep of a 6×(7s on / 3s off) protocol is 12 clicks a set.
	gain.gain.exponentialRampToValueAtTime(0.001, at + DECAY_SEC);
	osc.start(at);
	osc.stop(at + DECAY_SEC);
}

function sound(name: Cue): void {
	const ctx = audio();
	if (!ctx) return;
	try {
		// A context created before the first gesture, or suspended when the app
		// was backgrounded mid-session, has to be resumed or every cue after it
		// is silently dropped.
		if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
		TONES[name].forEach((frequency, i) => {
			tone(ctx, frequency, ctx.currentTime + i * NOTE_GAP_SEC);
		});
	} catch {
		// Ignore: see `audio()`.
	}
}

function buzz(name: BuzzedCue): void {
	if (!('vibrate' in navigator)) return;
	try {
		navigator.vibrate(BUZZ[name]);
	} catch {
		// Denied, or an engagement-gated call. Same reasoning as above.
	}
}

/**
 * Deliver what `planCues` decided, in order. Never throws and never awaits — a
 * cue that cannot be delivered is not a reason to interrupt a set. Decides
 * nothing: which cue a transition gets, and whether it buzzes, is the planner's.
 */
export function deliver(deliveries: readonly Delivery[]): void {
	if (typeof window === 'undefined') return;
	for (const d of deliveries) {
		switch (d.kind) {
			case 'sound':
				sound(d.cue);
				break;
			case 'buzz':
				buzz(d.cue);
				break;
		}
	}
}

/**
 * Release the audio hardware. Call when the timer is dismissed — an open context
 * keeps the audio route alive, which on Android is enough to duck other audio
 * and to show a media indicator for a timer that is no longer running.
 */
export function releaseCues(): void {
	const ctx = context;
	context = null;
	if (ctx && ctx.state !== 'closed') void ctx.close().catch(() => {});
}
