// Timer cues: the sounds and the buzz that tell the athlete a phase changed
// while they are hanging off a board and not looking at the phone.
//
// Carried over from the SvelteKit app's `timerStore.svelte.ts`, at the athlete's
// request — *"beep/haptic same sound we have now"*. Same frequencies, same
// envelope, same vibration patterns, so a session sounds identical after the
// rebuild. What changed is where it lives and how the context is managed.
//
// WHY IT IS A MODULE AND NOT PART OF THE TIMER COMPONENT
// -----------------------------------------------------
// The interval protocol is a pure function (`step` in `components/Timer.tsx`);
// this is the imperative half, and mixing them is what made the Svelte version
// impossible to test. Naming the cues after *what happened* rather than after
// what they sound like also keeps the component out of the audio business: it
// says `cue('rest')`, not `beep(440)`.
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
// app that has it — a phase change nobody is looking at. Reversed here, for the
// timer only. Everywhere else the decision stands.

/** What happened, not what it sounds like. */
export type Cue =
	/** The athlete pressed Start. */
	| 'start'
	/** Prepare is over — begin the effort. Distinct on purpose. */
	| 'go'
	/** An effort ended; rest begins. */
	| 'rest'
	/** A rest ended; the next round begins. */
	| 'work'
	/** A set ended; the longer between-sets rest begins. */
	| 'setRest'
	/** Three, two, one — the last seconds of any phase. */
	| 'countdown'
	/** The protocol is finished. */
	| 'done';

interface CueSpec {
	/** One tone, or several played in sequence for a distinct cue. */
	tones: number[];
	/** `navigator.vibrate` argument. */
	buzz: number | number[];
}

const CUES: Record<Cue, CueSpec> = {
	start: { tones: [660], buzz: 80 },
	// A rising two-note chime, so "go" is the one cue that cannot be mistaken
	// for any of the single beeps around it.
	go: { tones: [784, 1175], buzz: 80 },
	rest: { tones: [440], buzz: 80 },
	work: { tones: [660], buzz: 80 },
	setRest: { tones: [330], buzz: 80 },
	// No buzz: it fires three times in three seconds, and a phone buzzing
	// continuously reads as a malfunction rather than as a countdown.
	countdown: { tones: [1000], buzz: 0 },
	done: { tones: [880], buzz: [140, 70, 140] },
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

/**
 * Play a cue and buzz for it. Never throws and never awaits — a cue that cannot
 * be delivered is not a reason to interrupt a set.
 */
export function cue(name: Cue): void {
	if (typeof window === 'undefined') return;
	const spec = CUES[name];
	const ctx = audio();
	if (ctx) {
		try {
			// A context created before the first gesture, or suspended when the app
			// was backgrounded mid-session, has to be resumed or every cue after it
			// is silently dropped.
			if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
			spec.tones.forEach((frequency, i) => {
				tone(ctx, frequency, ctx.currentTime + i * NOTE_GAP_SEC);
			});
		} catch {
			// Ignore: see `audio()`.
		}
	}
	if (spec.buzz && 'vibrate' in navigator) {
		try {
			navigator.vibrate(spec.buzz);
		} catch {
			// Denied, or an engagement-gated call. Same reasoning as above.
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
