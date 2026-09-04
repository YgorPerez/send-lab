// Onboarding: the answers on their way to a program, and the screen that asks
// for them.
//
// The claim this suite exists to hold is the one the whole page is built around:
// **onboarding fabricates no answers.** It is easy to state, invisible in a diff,
// and one `useState('boulder')` away from being false again — the SvelteKit form
// it replaces had exactly that, plus `niggle: false`, which is not "no niggle".
// So it is asserted twice: on the pure conversion, where an unanswered finger
// question must not become a stored `false`, and on the rendered page, where no
// option may come up already pressed.
//
// The other half is the chain the ticket cares about. A `Baseline` is not a
// profile: `niggle` reaches `programGen` as a cap on finger effort, `equipment`
// filters what can be prescribed at all, and the proposal has to show the week
// that will actually run rather than the one that was asked for. Each of those is
// one assertion here.
//
// Rendering is `renderToString` over the real route tree, as in
// `tests/screens.test.ts` and `tests/emptyStates.test.ts`, and the store is reset
// and **not** seeded: an account with no baseline is what onboarding is for.
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { getContent } from '../src/lib/content/index.ts';
import { overwriteGetLocale } from '../src/lib/paraglide/runtime.js';
import {
	type BaselineDraft,
	clampStep,
	draftComplete,
	draftFrom,
	firstIncompleteStep,
	parseDraft,
	resolveProposal,
	STEP_ANSWERS,
	stepComplete,
	stepsAnswered,
	toBaseline,
} from '../src/lib/screens/welcome.ts';
import { programFor } from '../src/lib/store/baseline.ts';
import { resetRecordStore } from '../src/lib/store/record.ts';
import type { Baseline } from '../src/lib/types.ts';
import { routeTree } from '../src/routeTree.gen.ts';

/** A Thursday, so `/` resolves a training day when this suite renders it. The
 *  clock matters to Today and not to anything pure below. */
const THURSDAY = new Date('2026-08-13T09:30:00');

/** Every answer given. The one baseline the pure tests below start from, so a
 *  test that cares about one field changes that field and nothing else. */
const ANSWERED: Baseline = {
	goal: 'all',
	focus: 'fingers',
	level: 'advanced',
	daysPerWeek: 5,
	bodyweight: 71.5,
	equipment: ['hangboard', 'board', 'rings', 'weights'],
	boulderGrade: 'V8',
	routeGrade: '7c',
	niggle: false,
	synovitis: false,
	birthDate: '1994-04-02',
	sessionMinutes: 90,
	completedAt: '2026-08-13',
};

/** A complete draft, as the form would hold it once every step is answered. */
function complete(): BaselineDraft {
	return draftFrom(ANSWERED);
}

beforeAll(() => {
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(THURSDAY);
	// `generateProgram` names its phases from `m.prog_phase_*()`, which resolves
	// the *ambient* locale — and Paraglide's resolution reaches for
	// `localStorage`, which jsdom provides as an object whose `getItem` is not a
	// function (`store/collections.ts` documents the same trap). So the locale is
	// pinned here rather than left to the environment, the way every other suite
	// that renders or generates does it.
	overwriteGetLocale(() => 'en-US');
});

afterAll(() => {
	vi.useRealTimers();
	resetRecordStore();
});

async function render(path: string, locale: 'en-US' | 'pt-BR'): Promise<string> {
	resetRecordStore();
	overwriteGetLocale(() => locale);
	const router = createRouter({
		routeTree,
		history: createMemoryHistory({ initialEntries: [path] }),
	});
	await router.load();
	return renderToString(createElement(RouterProvider, { router } as never));
}

/** The page, without the chrome around it.
 *
 *  The strip's own locale switch is a pair of `aria-pressed` toggles and it is
 *  always half pressed, so "nothing on this screen is preselected" has to be
 *  asked of the screen rather than of the document. `AppShell` puts the page in
 *  the one `<main>`. */
function mainOf(html: string): string {
	const from = html.indexOf('<main');
	const to = html.indexOf('</main>');
	expect(from, 'the shell rendered no <main>').toBeGreaterThan(-1);
	expect(to).toBeGreaterThan(from);
	return html.slice(from, to);
}

describe('nothing is preselected', () => {
	test('a fresh draft has answered nothing, and no step is complete', () => {
		const draft = draftFrom(null);
		expect(draft).toMatchObject({
			goal: null,
			focus: null,
			level: null,
			daysPerWeek: null,
			equipment: [],
			niggle: null,
			synovitis: null,
			step: 0,
		});
		for (let index = 0; index < STEP_ANSWERS.length; index++) {
			expect(stepComplete(draft, index), `step ${index}`).toBe(false);
		}
		expect(draftComplete(draft)).toBe(false);
		expect(stepsAnswered(draft)).toBe(0);
		expect(toBaseline(draft, '2026-08-13')).toBeNull();
	});

	// The one that matters most, and the one the SvelteKit form got wrong. Every
	// other answer is given; only the finger question is not. A `Baseline` types
	// `niggle` as a boolean, so the only way this can be wrong is by writing
	// `false` — which would tell `programGen` the athlete said no.
	test('an unanswered finger question cannot become a stored `false`', () => {
		for (const field of ['niggle', 'synovitis'] as const) {
			const draft = { ...complete(), [field]: null };
			expect(stepComplete(draft, 3), field).toBe(false);
			expect(toBaseline(draft, '2026-08-13'), field).toBeNull();
		}
	});

	// The last step's primary converts the draft, so gating it on its own step
	// alone lets it come up enabled over a draft `toBaseline` will refuse — and the
	// tap then does nothing at all. Reachable, not theoretical: `parseDraft` drops
	// an answer this build cannot recognise while `clampStep` keeps the stored
	// step, so a draft legitimately reopens at the last step with the first blank.
	test('the last step is gated on the whole draft, and names the missing step', () => {
		// Exactly what `parseDraft` produces from a draft written by a build whose
		// `GOALS` had a member this one does not.
		const stale = parseDraft({ ...complete(), goal: 'freeclimbing', step: 3 });
		expect(stale.step).toBe(3);
		// Its own step is answered, which is what made the button lie.
		expect(stepComplete(stale, 3)).toBe(true);
		// The draft as a whole is not, and the gap is step 0 — not step 3.
		expect(firstIncompleteStep(stale)).toBe(0);
		expect(draftComplete(stale)).toBe(false);
		expect(toBaseline(stale, '2026-08-13')).toBeNull();
		// And a complete draft reports no gap, so the primary is live.
		expect(firstIncompleteStep(complete())).toBe(-1);
	});

	test('gear is required, because a program is built from what is on hand', () => {
		const draft = { ...complete(), equipment: [] };
		expect(stepComplete(draft, 2)).toBe(false);
		expect(toBaseline(draft, '2026-08-13')).toBeNull();
	});
});

describe('a draft becomes a baseline', () => {
	test('a completed draft round-trips through the entity', () => {
		expect(toBaseline(complete(), ANSWERED.completedAt)).toEqual(ANSWERED);
	});

	test('a redo starts from the athlete-s own previous answers', () => {
		const draft = draftFrom(ANSWERED);
		expect(draftComplete(draft)).toBe(true);
		// Every question again, in order — a redo is not a resume.
		expect(draft.step).toBe(0);
	});

	test('the typed numbers are read, and a non-answer is not a measurement', () => {
		const of = (fields: Partial<BaselineDraft>) =>
			toBaseline({ ...complete(), ...fields }, '2026-08-13');
		expect(of({ bodyweight: '' })?.bodyweight).toBeNull();
		expect(of({ bodyweight: '0' })?.bodyweight).toBeNull();
		expect(of({ bodyweight: 'heavy' })?.bodyweight).toBeNull();
		// A pt-BR keyboard offers a comma as the decimal separator, and
		// `Number('71,5')` is `NaN`.
		expect(of({ bodyweight: '71,5' })?.bodyweight).toBe(71.5);
		// Zero minutes would read as a two-exercise session cap rather than as no
		// answer, which is `sessionCap`'s tightest bucket.
		expect(of({ sessionMinutes: '0' })?.sessionMinutes).toBeNull();
		expect(of({ sessionMinutes: '45' })?.sessionMinutes).toBe(45);
		// Optional free text: blank is absent, not an empty string.
		expect(of({ boulderGrade: '   ' })?.boulderGrade).toBeNull();
		expect(of({ birthDate: '' })?.birthDate).toBeNull();
	});
});

describe('a stored draft is narrowed, not trusted', () => {
	test('a value the form could not have produced reads as unanswered', () => {
		const draft = parseDraft({
			goal: 'freeclimbing',
			focus: 'fingers',
			level: 7,
			daysPerWeek: 9,
			equipment: ['hangboard', 'trampoline'],
			niggle: 'yes',
			synovitis: false,
			bodyweight: 71.5,
			step: 99,
		});
		expect(draft.goal).toBeNull();
		expect(draft.focus).toBe('fingers');
		expect(draft.level).toBeNull();
		expect(draft.daysPerWeek).toBeNull();
		expect(draft.equipment).toEqual(['hangboard']);
		// A string is not an answer to a yes/no, and `'yes'` is truthy — which is
		// exactly how it would have become a `true` without the check.
		expect(draft.niggle).toBeNull();
		expect(draft.synovitis).toBe(false);
		// A number is not the text the field holds.
		expect(draft.bodyweight).toBe('');
		expect(draft.step).toBe(STEP_ANSWERS.length - 1);
	});

	test('nothing at all is a blank draft rather than a crash', () => {
		for (const value of [null, undefined, 'draft', 7]) {
			expect(parseDraft(value).goal, String(value)).toBeNull();
		}
	});

	test('the step stays inside the flow', () => {
		expect(clampStep(-3)).toBe(0);
		expect(clampStep(1)).toBe(1);
		expect(clampStep(400)).toBe(STEP_ANSWERS.length - 1);
		expect(clampStep('two')).toBe(0);
	});
});

describe('the baseline reaches the program', () => {
	const content = getContent('en-US');

	// The ticket's first claim about `niggle`: it is not a form field, it caps
	// finger intensity in the generated program. `NIGGLE_RPE_CAP` is 8.
	test('a reported niggle caps finger effort', () => {
		const without = programFor(content, ANSWERED);
		const withNiggle = programFor(content, { ...ANSWERED, niggle: true });
		expect(Object.values(without.overrides).some((o) => o?.rpe === 8)).toBe(false);
		expect(Object.values(withNiggle.overrides).some((o) => o?.rpe === 8)).toBe(true);
		// And it softens the block as a whole rather than only one exercise.
		expect(withNiggle.phases[0].intensity).toBeLessThan(without.phases[0].intensity);
	});

	// The ticket's claim about `equipment`: it filters which exercises the
	// generated program can use. Counting template entries would not show it — the
	// generator only writes an entry where it *deviates* — so the week is read the
	// way the proposal reads it, through the same fallback chain.
	test('gear filters what can be prescribed', () => {
		const week = (equipment: Baseline['equipment']) => {
			const baseline: Baseline = { ...ANSWERED, equipment };
			return resolveProposal(content, programFor(content, baseline), baseline);
		};
		expect(week(['hangboard', 'board', 'rings', 'weights']).trainingDays).toBe(5);
		// Rings alone support one day of the five, and the other four are rested out
		// rather than prescribing work the athlete cannot do.
		expect(week(['rings']).trainingDays).toBeLessThan(5);
		expect(week(['rings']).trainingDays).toBeGreaterThan(0);
	});

	// And `sessionMinutes`, which caps exercises per day rather than filtering
	// them: 45 minutes is `sessionCap`'s two-exercise bucket.
	test('the session length caps exercises per day', () => {
		const short = programFor(content, { ...ANSWERED, sessionMinutes: 45 });
		const trimmed = Object.values(short.template).filter((t) => t?.exercises);
		expect(trimmed.length).toBeGreaterThan(0);
		for (const day of trimmed) expect(day?.exercises?.length).toBeLessThanOrEqual(2);
	});
});

describe('the proposal shows the week that will run', () => {
	test('it reads the program, not the answers', () => {
		const content = getContent('en-US');
		// Six days asked for, one piece of gear on hand: the generator rests out
		// every weekday whose exercises it cannot support, so the week it produces
		// is smaller than the answer. Deriving the display from the baseline — which
		// the SvelteKit proposal did — would show six.
		const baseline: Baseline = { ...ANSWERED, daysPerWeek: 6, equipment: ['rings'] };
		const program = programFor(content, baseline);
		const proposal = resolveProposal(content, program, baseline);

		expect(proposal.week).toHaveLength(7);
		expect(proposal.trainingDays).toBe(proposal.week.filter((d) => d.trains).length);
		expect(proposal.trainingDays).toBeLessThanOrEqual(6);
		// Sunday is always the rest day.
		expect(proposal.week.find((d) => d.key === 'Sun')?.trains).toBe(false);
		expect(proposal.firstPhase).not.toBe('');
		expect(proposal.niggle).toBe(false);
	});

	// ADR 0003, in the locale it is the only one visible in: the weekday keys are
	// byte-identical to their English labels, so a key read off a label passes in
	// en-US and fails here.
	test('the weekday keys stay keys in pt-BR while the labels are translated', () => {
		const content = getContent('pt-BR');
		const program = programFor(content, ANSWERED);
		const proposal = resolveProposal(content, program, ANSWERED);
		expect(proposal.week.map((d) => d.key)).toEqual([
			'Mon',
			'Tue',
			'Wed',
			'Thu',
			'Fri',
			'Sat',
			'Sun',
		]);
		expect(proposal.week.map((d) => d.label)).not.toEqual(proposal.week.map((d) => d.key));
	});
});

const COPY = {
	'en-US': {
		title: 'Your baseline',
		steps: ['Goals', 'Level', 'Week', 'Body'],
		goal: 'Primary goal',
		bouldering: 'Bouldering',
		next: 'Next',
		waiting: 'Pick a goal and a limiter',
		skip: 'Not now',
		todayInvite: 'built-in week',
		todayAction: 'Set your baseline',
	},
	'pt-BR': {
		title: 'Sua base',
		steps: ['Objetivos', 'Nível', 'Semana', 'Corpo'],
		goal: 'Objetivo principal',
		bouldering: 'Boulder',
		next: 'Próximo',
		waiting: 'Escolha um objetivo e um limitante',
		skip: 'Agora não',
		todayInvite: 'semana embutida',
		todayAction: 'Definir sua base',
	},
} as const;

/** The `<button …>` tag enclosing a label, for asserting on its attributes.
 *  Same helper as `tests/emptyStates.test.ts`. */
function openingTagOf(html: string, label: string): string {
	const at = html.indexOf(label);
	expect(at, label).toBeGreaterThan(-1);
	return html.slice(html.lastIndexOf('<button', at), at);
}

for (const locale of ['en-US', 'pt-BR'] as const) {
	describe(`the screen, in ${locale}`, () => {
		const copy = COPY[locale];

		test('it opens on the first step, with the whole rail named', async () => {
			const html = await render('/welcome', locale);
			expect(html).toContain(copy.title);
			for (const step of copy.steps) expect(html, step).toContain(step);
			expect(html).toContain(copy.goal);
			expect(html).toContain(copy.bouldering);
			// The rail carries one segment per declared step. A step added to the
			// route without an entry in `STEP_ANSWERS` would have no gate.
			expect(copy.steps).toHaveLength(STEP_ANSWERS.length);
		});

		test('no choice is pressed, and the advance is held with its reason', async () => {
			const html = await render('/welcome', locale);
			const page = mainOf(html);
			expect(page).toContain('aria-pressed="false"');
			expect(page).not.toContain('aria-pressed="true"');
			expect(openingTagOf(page, copy.next)).toContain('disabled');
			expect(page).toContain(copy.waiting);
		});

		// The ration, asserted on the markup rather than by counting buttons in
		// review: `active:bg-flag-deep` belongs to the `primary` variant alone.
		test('exactly one primary is on the screen', async () => {
			const page = mainOf(await render('/welcome', locale));
			expect(page.match(/active:bg-flag-deep/g) ?? []).toHaveLength(1);
		});

		test('it can be left, and it says so', async () => {
			const html = await render('/welcome', locale);
			expect(html).toContain(copy.skip);
			expect(html).toContain('href="/"');
		});

		// The whole entry path: no gate, no redirect, one line on Today.
		test('Today offers the way in while the account has no baseline', async () => {
			const html = await render('/', locale);
			expect(html).toContain(copy.todayInvite);
			expect(html).toContain(copy.todayAction);
			expect(html).toContain('href="/welcome"');
		});
	});
}
