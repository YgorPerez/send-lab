// The voice (#106), at the one seam it has: `deliver`, handed what the planner
// decided, speaking it through the browser's speech synthesis.
//
// The browser is the boundary, so it is the only thing faked: a speech engine
// that records what it was asked to say, in which language and with which voice.
// jsdom has none of its own, which is also the "missing support" case.
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { canSpeak, deliver, releaseCues } from '../src/lib/cues.ts';
import { overwriteGetLocale } from '../src/lib/paraglide/runtime.js';

type Voice = { lang: string; name: string };

class FakeUtterance {
	lang = '';
	voice: Voice | null = null;
	constructor(public text: string) {}
}

function fakeEngine(voices: Voice[] = []) {
	const said: { text: string; lang: string; voice: string | null }[] = [];
	const engine = {
		cancelled: 0,
		speak: vi.fn((u: FakeUtterance) => {
			said.push({ text: u.text, lang: u.lang, voice: u.voice?.name ?? null });
		}),
		cancel: vi.fn(() => {
			engine.cancelled += 1;
		}),
		getVoices: () => voices,
		addEventListener: () => {},
		removeEventListener: () => {},
	};
	vi.stubGlobal('speechSynthesis', engine);
	vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
	return { engine, said };
}

beforeEach(() => overwriteGetLocale(() => 'en-US'));
afterEach(() => vi.unstubAllGlobals());

describe('the voice', () => {
	test.each([
		['en-US', 'cues_say_work', 'Work'],
		['en-US', 'cues_say_rest', 'Rest'],
		['en-US', 'cues_say_setrest', 'Set rest'],
		['en-US', 'cues_say_done', 'Done'],
		['en-US', 'cues_say_prepare', 'Get ready'],
		['pt-BR', 'cues_say_work', 'Esforço'],
		['pt-BR', 'cues_say_rest', 'Descanso'],
		['pt-BR', 'cues_say_setrest', 'Descanso entre séries'],
		['pt-BR', 'cues_say_done', 'Concluído'],
		['pt-BR', 'cues_say_prepare', 'Prepare-se'],
	] as const)('in %s, says %s as "%s", in that language', (locale, key, text) => {
		overwriteGetLocale(() => locale);
		const { said } = fakeEngine();
		deliver([{ kind: 'speech', key }]);
		expect(said).toEqual([{ text, lang: locale, voice: null }]);
	});

	test('says a countdown beat as its number, in the active language', () => {
		overwriteGetLocale(() => 'pt-BR');
		const { said } = fakeEngine();
		deliver([{ kind: 'speech', key: 'cues_say_count', n: 3 }]);
		expect(said).toEqual([{ text: '3', lang: 'pt-BR', voice: null }]);
	});

	test('speaks with a voice for the locale when the device lists one', () => {
		overwriteGetLocale(() => 'pt-BR');
		const { said } = fakeEngine([
			{ lang: 'en-US', name: 'Samantha' },
			{ lang: 'pt-PT', name: 'Joana' },
			{ lang: 'pt-BR', name: 'Luciana' },
		]);
		deliver([{ kind: 'speech', key: 'cues_say_rest' }]);
		expect(said).toEqual([{ text: 'Descanso', lang: 'pt-BR', voice: 'Luciana' }]);
	});

	test('falls back to another voice of the same language', () => {
		overwriteGetLocale(() => 'pt-BR');
		const { said } = fakeEngine([
			{ lang: 'en-US', name: 'Samantha' },
			{ lang: 'pt_PT', name: 'Joana' },
		]);
		deliver([{ kind: 'speech', key: 'cues_say_rest' }]);
		expect(said).toEqual([{ text: 'Descanso', lang: 'pt-BR', voice: 'Joana' }]);
	});

	// An English voice reading Portuguese is worse than silence; the beeps
	// still carry the timing.
	test('says nothing when the device lists voices and none speaks the language', () => {
		overwriteGetLocale(() => 'pt-BR');
		const { said } = fakeEngine([{ lang: 'en-US', name: 'Samantha' }]);
		deliver([{ kind: 'speech', key: 'cues_say_rest' }]);
		expect(said).toEqual([]);
		expect(canSpeak()).toBe(false);
	});

	test('with no speech synthesis at all, says nothing and does not throw', () => {
		expect(() => deliver([{ kind: 'speech', key: 'cues_say_work' }])).not.toThrow();
		expect(canSpeak()).toBe(false);
	});

	test('a speech engine that throws is silent, and the deliveries after it still happen', () => {
		const { engine, said } = fakeEngine();
		engine.speak.mockImplementationOnce(() => {
			throw new Error('not allowed');
		});
		expect(() =>
			deliver([
				{ kind: 'speech', key: 'cues_say_work' },
				{ kind: 'speech', key: 'cues_say_count', n: 2 },
			]),
		).not.toThrow();
		expect(said.map((s) => s.text)).toEqual(['2']);
	});

	// A phrase said late is worse than one not said: the clock has moved on.
	// Each one cuts off whatever is still being said rather than queueing.
	test('cuts off the phrase before rather than queueing behind it', () => {
		const { engine } = fakeEngine();
		deliver([{ kind: 'speech', key: 'cues_say_count', n: 1 }]);
		deliver([{ kind: 'speech', key: 'cues_say_rest' }]);
		expect(engine.cancel).toHaveBeenCalledTimes(2);
		expect(engine.cancel.mock.invocationCallOrder[1]).toBeLessThan(
			engine.speak.mock.invocationCallOrder[1],
		);
	});

	test('a device with speech and voices still loading can speak', () => {
		fakeEngine();
		expect(canSpeak()).toBe(true);
	});

	test('releasing the cues stops anything still being said', () => {
		const { engine } = fakeEngine();
		releaseCues();
		expect(engine.cancel).toHaveBeenCalled();
	});
});
