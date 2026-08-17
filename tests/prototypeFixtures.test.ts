// The contract the four direction prototypes (#47–#50) share.
//
// These are not tests of the fixtures' taste — they are the guarantees that make
// the four branches *comparable*. Each direction renders this dataset and only
// this dataset; if it drifts, or if it renders differently under pt-BR, the
// prototypes stop being a design comparison and #51 has nothing to judge.
import { afterEach, describe, expect, it } from 'vitest';
import { overwriteGetLocale } from '../src/lib/paraglide/runtime.js';
import { getPrototypeFixtures } from '../src/prototype-fixtures.ts';
import { FIXTURE_PROSE } from '../src/prototype-prose.ts';

// Pin the locale before anything reads content. Paraglide's real strategy is
// `localStorage` first (ADR 0006), and jsdom under Vitest has no usable
// `localStorage`, so an un-overridden `getLocale()` throws at *collection* time —
// these suites resolve fixtures in their describe bodies. Overriding here rather
// than in a hook is what makes that safe.
overwriteGetLocale(() => 'en-US');

/** A fixed Thursday, so the assertions do not move with the wall clock. */
const NOW = new Date('2026-08-13T09:30:00').getTime();

function withLocale<T>(locale: 'en-US' | 'pt-BR', fn: () => T): T {
	overwriteGetLocale(() => locale);
	try {
		return fn();
	} finally {
		overwriteGetLocale(() => 'en-US');
	}
}

afterEach(() => overwriteGetLocale(() => 'en-US'));

describe('the shared prototype dataset', () => {
	it('is the same content in both locales, and translated in neither direction only', () => {
		const en = withLocale('en-US', () => getPrototypeFixtures(NOW));
		const pt = withLocale('pt-BR', () => getPrototypeFixtures(NOW));

		// Same app, same data: identities, counts and numbers match exactly.
		expect(pt.today.tasks.map((t) => t.key)).toEqual(en.today.tasks.map((t) => t.key));
		expect(pt.today.tasks.map((t) => t.exerciseId)).toEqual(
			en.today.tasks.map((t) => t.exerciseId),
		);
		expect(pt.today.score).toBe(en.today.score);
		expect(pt.today.verdictId).toBe(en.today.verdictId);
		expect(pt.log.sessions.length).toBe(en.log.sessions.length);
		expect(pt.train.items.map((i) => i.exerciseId)).toEqual(
			en.train.items.map((i) => i.exerciseId),
		);

		// …and every visible string actually differs, which is the half that
		// silently regresses: a missing pt-BR key falls back to English and
		// nothing goes red.
		expect(pt.today.verdict.title).not.toBe(en.today.verdict.title);
		expect(pt.today.day.type).not.toBe(en.today.day.type);
		expect(pt.today.questions[0].question).not.toBe(en.today.questions[0].question);
		expect(pt.train.items[0].exName).not.toBe(en.train.items[0].exName);
	});

	it('holds the athlete-typed notes in parity', () => {
		expect(Object.keys(FIXTURE_PROSE['pt-BR']).sort()).toEqual(
			Object.keys(FIXTURE_PROSE['en-US']).sort(),
		);
	});
});

describe('Today', () => {
	const f = getPrototypeFixtures(NOW);

	it('lands on a verdict that actually caps the session, so held work is on screen', () => {
		expect(f.today.verdictId).toBe('moderate');
		expect(f.today.held.length).toBeGreaterThan(0);
		expect(f.today.held.length).toBeLessThan(f.today.tasks.length);
		expect(f.today.tasks.every((t) => t.label.length > 0)).toBe(true);
	});

	it('renders every piece the prototype brief names', () => {
		expect(f.today.questions.length).toBeGreaterThanOrEqual(6);
		// The adaptive half: at least one follow-up is revealed, not just the core.
		expect(f.today.questions.some((q) => q.sub)).toBe(true);
		// All five wellness dimensions behind the score.
		expect(f.today.breakdown).toHaveLength(5);
		expect(f.today.flags.length).toBeGreaterThan(0);
		expect(f.today.trendPoints).toHaveLength(14);
		expect(f.today.bodyweight.promptToday).toBe(true);
		expect(f.today.missed).not.toBeNull();
		expect(f.today.deep.assessment.questions.length).toBeGreaterThan(0);
		expect(f.today.stats.total).toBeGreaterThan(0);
	});

	it('carries no max-pull probe — it left the rebuild with the Probe', () => {
		const asJson = JSON.stringify(f);
		expect(asJson).not.toContain('probe');
		expect(f.today.questions.map((q) => q.id)).not.toContain('probe');
	});

	it("scores against the athlete's own history rather than a hardcoded number", () => {
		expect(f.today.baseline).not.toBeNull();
		expect(f.today.vsBaseline).toBe('usual');
		// Four post-session outcomes are logged, so the note reads as personalized.
		expect(f.today.scoreNote).toBe('tuned');
	});
});

describe('Train', () => {
	const f = getPrototypeFixtures(NOW);

	it('opens mid-session, with a timer and typeable set rows', () => {
		expect(f.train.items.length).toBeGreaterThanOrEqual(4);
		expect(f.train.timer).not.toBeNull();
		expect(f.train.items.every((i) => i.sets.length > 0)).toBe(true);
		expect(f.train.items.some((i) => i.sets.some((s) => s.done))).toBe(true);
		// Every item offers a variant to swap to, and the add-exercise picker has
		// the rest of the library behind it.
		expect(f.train.items.every((i) => i.variants.length > 1)).toBe(true);
		expect(f.train.available.length).toBeGreaterThan(0);
	});

	it('shows only the per-set fields an exercise actually logs', () => {
		for (const item of f.train.items) {
			expect(item.fields).toContain('weight');
			expect(item.fields).toContain('rpe');
			expect(item.fields.includes('grip')).toBe(item.spec.grip != null);
		}
	});
});

describe('Log', () => {
	const f = getPrototypeFixtures(NOW);

	it('is the densest screen — many sessions, many rows inside each', () => {
		expect(f.log.sessions.length).toBeGreaterThanOrEqual(20);
		expect(f.log.sessions.reduce((n, s) => n + s.setCount, 0)).toBeGreaterThan(100);
		expect(f.log.readiness).toHaveLength(14);
		expect(f.log.activity.length).toBeGreaterThan(0);
	});

	it('shows a past readiness check as it was answered, not as a bare score', () => {
		const withResponses = f.log.readiness.find((r) => r.responses.length > 0);
		expect(withResponses).toBeDefined();
		expect(withResponses?.verdict.title.length).toBeGreaterThan(0);
		expect(f.log.readiness.some((r) => r.outcome != null)).toBe(true);
	});

	it('is newest first', () => {
		const isos = f.log.sessions.map((s) => s.iso);
		expect([...isos].sort().reverse()).toEqual(isos);
	});
});

describe('determinism', () => {
	it('renders identically on two calls, so four branches show the same numbers', () => {
		expect(JSON.stringify(getPrototypeFixtures(NOW))).toBe(
			JSON.stringify(getPrototypeFixtures(NOW)),
		);
	});
});
