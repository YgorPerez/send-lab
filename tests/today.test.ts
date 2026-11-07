// Today as a summary (#117, spec #113 stories 33–43).
//
// What the athlete reads, top to bottom: the verdict and its score, today's plan
// with the held work marked on its tasks, the flags, the outcome ask when there is
// a session to rate, and then the secondary block (counters, trend, bodyweight,
// injury). One primary in every state: the readiness check's invitation while it
// is unanswered, the way into Train once it is.
//
// String renders of the route over the store, the harness `screens.test.ts` and
// `emptyStates.test.ts` use: seeded and empty, a training day and a rest day,
// both locales. Order is asserted as the order the text appears in `<main>`,
// which is the phone's reading order (`Panes` stacks its two halves with
// `display: contents`, so the desktop's columns are this same order cut once).
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { PINNED_NOW } from '../scripts/seeded-record.ts';
import { getContent } from '../src/lib/content/index.ts';
import { overwriteGetLocale } from '../src/lib/paraglide/runtime.js';
import { recordStore, resetRecordStore } from '../src/lib/store/record.ts';
import { seedRecordStore } from '../src/lib/store/seed.ts';
import { routeTree } from '../src/routeTree.gen.ts';

/** The seeded Thursday: week 5, a Pull day, opened mid-session. */
const THURSDAY = new Date(PINNED_NOW);
/** The Sunday after it: the built-in week's rest day. */
const SUNDAY = new Date(THURSDAY.getTime() + 3 * 24 * 60 * 60 * 1000);

beforeAll(() => {
	vi.useFakeTimers({ toFake: ['Date'] });
});

afterAll(() => {
	vi.useRealTimers();
	resetRecordStore();
});

type Locale = 'en-US' | 'pt-BR';

/** Today's `<main>`, rendered on `day` over an empty or a seeded store. React's
 *  `<!-- -->` between adjacent text nodes is dropped and its escaped apostrophe
 *  put back, so a sentence reads as the athlete reads it. */
async function today(day: Date, locale: Locale, seeded: boolean): Promise<string> {
	vi.setSystemTime(day);
	resetRecordStore();
	if (seeded) seedRecordStore(recordStore(), getContent('en-US'), 'en-US', day.getTime());
	overwriteGetLocale(() => locale);
	const router = createRouter({
		routeTree,
		history: createMemoryHistory({ initialEntries: ['/'] }),
	});
	await router.load();
	const html = renderToString(createElement(RouterProvider, { router } as never));
	return html
		.slice(html.indexOf('<main'), html.indexOf('</main>'))
		.replaceAll('<!-- -->', '')
		.replaceAll('&#x27;', "'");
}

const COPY = {
	'en-US': {
		invite: '>Answer the check<',
		summary: 'answered',
		plan: '>Pull<',
		trainingWeek: /Training week \d of 8/,
		bareWeek: /Week 5 \/ 8/,
		rest: 'Rest day',
		flags: '>Watch-outs<',
		outcome: "How did today's Pull session go?",
		anyOutcome: 'go?',
		streak: '>Day streak<',
		trend: '>Readiness trend<',
		bodyweight: '>Bodyweight<',
		injury: '>Injury / rehab<',
		baseline: 'built-in week',
		goTrain: '>Go to Train<',
	},
	'pt-BR': {
		invite: '>Responder o check<',
		summary: 'respondidas',
		plan: '>Puxada<',
		trainingWeek: /Semana de treino \d de 8/,
		bareWeek: /Semana 5 \/ 8/,
		rest: 'Dia de descanso',
		flags: '>Pontos de atenção<',
		outcome: 'Como foi a sessão de Puxada hoje?',
		anyOutcome: 'Como foi a sessão',
		streak: '>Sequência<',
		trend: '>Tendência de prontidão<',
		bodyweight: '>Peso corporal<',
		injury: '>Lesão / reabilitação<',
		baseline: 'semana embutida',
		goTrain: '>Ir para o treino<',
	},
} as const;

/** Where each marker first appears; fails on any that is missing, so an order
 *  assertion cannot pass by comparing two `-1`s. */
function positions(screen: string, markers: readonly string[]): number[] {
	return markers.map((marker) => {
		const at = screen.indexOf(marker);
		expect(at, marker).toBeGreaterThan(-1);
		return at;
	});
}

function expectInOrder(screen: string, markers: readonly string[]) {
	const at = positions(screen, markers);
	expect(at, markers.join(' < ')).toEqual([...at].sort((a, b) => a - b));
}

/** The filled vermilion: the `primary` recipe, rationed to one per screen. */
const primaries = (screen: string) => screen.match(/bg-flag text-bg/g) ?? [];

/** The opening tag of the element whose text is `label`. */
function tagOf(screen: string, label: string): string {
	const at = screen.indexOf(label);
	expect(at, label).toBeGreaterThan(-1);
	return screen.slice(screen.lastIndexOf('<', at - 1), at);
}

for (const locale of ['en-US', 'pt-BR'] as const) {
	const copy = COPY[locale];

	describe(`${locale}, Today`, () => {
		// The way into Train comes after the flags, so a problem is read before
		// the athlete starts (story 36).
		test('seeded: the verdict, the plan, the flags, the way in, the outcome ask, then the rest', async () => {
			const screen = await today(THURSDAY, locale, true);
			expectInOrder(screen, [
				copy.summary,
				copy.plan,
				copy.flags,
				copy.goTrain,
				copy.outcome,
				copy.streak,
				copy.trend,
				copy.bodyweight,
				copy.injury,
			]);
		});

		test('empty: the invitation, the plan and the baseline line under it, then the rest', async () => {
			const screen = await today(THURSDAY, locale, false);
			expectInOrder(screen, [copy.invite, copy.plan, copy.baseline, copy.streak, copy.trend]);
		});

		test('a rest day says so inside the plan, under the read', async () => {
			for (const seeded of [true, false]) {
				const screen = await today(SUNDAY, locale, seeded);
				const [read] = positions(screen, [seeded ? copy.summary : copy.invite]);
				const [rest] = positions(screen, [copy.rest]);
				expect(rest, `seeded: ${seeded}`).toBeGreaterThan(read);
			}
		});

		test('asks how the session went only when there is one to rate, and names it', async () => {
			// Seeded: today's Pull session has a set ticked off, so it is trained.
			expect(await today(THURSDAY, locale, true)).toContain(copy.outcome);
			// Empty: nothing trained today, nothing to rate.
			expect(await today(THURSDAY, locale, false)).not.toContain(copy.anyOutcome);
			expect(await today(SUNDAY, locale, false)).not.toContain(copy.anyOutcome);
		});

		test('has exactly one primary in each state: the check while unanswered, Train after', async () => {
			for (const day of [THURSDAY, SUNDAY]) {
				const empty = await today(day, locale, false);
				expect(primaries(empty)).toHaveLength(1);
				expect(tagOf(empty, copy.invite)).toContain('bg-flag');
				expect(empty).not.toContain(copy.goTrain);

				const seeded = await today(day, locale, true);
				expect(primaries(seeded)).toHaveLength(1);
				const go = tagOf(seeded, copy.goTrain);
				expect(go).toContain('bg-flag');
				expect(go).toContain('href="/train"');
			}
		});

		// The glossary's words for the training week, as Week heads its grid
		// (#121), and nowhere a bare "Week 5 / 8" (#125). Seeded is in week 5,
		// a new account in week 1.
		test('names the training week under the title, in the glossary’s words', async () => {
			for (const seeded of [true, false]) {
				const screen = await today(THURSDAY, locale, seeded);
				const header = screen.slice(0, screen.indexOf('</header>'));
				expect(header, `seeded: ${seeded}`).toMatch(copy.trainingWeek);
				expect(screen, `seeded: ${seeded}`).not.toMatch(copy.bareWeek);
			}
		});

		// The plan heads its day as Week heads the same day: the day type, the
		// load as a chip beside it, and on a rest day no load at all, because the
		// library's rest load is "OFF", the glossary's avoided *off day* (#125).
		test('heads the plan with the day type, and a rest day with no "off"', async () => {
			for (const seeded of [true, false]) {
				const rest = await today(SUNDAY, locale, seeded);
				expect(rest, `seeded: ${seeded}`).not.toMatch(/>(OFF|FOLGA)</);
				expect(rest, `seeded: ${seeded}`).not.toMatch(/ · (OFF|FOLGA)/);
			}
		});

		// The verdict's mark is its state, as Log's score dot is (#120): the
		// library paints a green day vermilion, the stop colour (spec story 61).
		test('marks the verdict with its state, never the library’s colour', async () => {
			const screen = await today(THURSDAY, locale, true);
			const read = screen.slice(0, screen.indexOf(copy.summary));
			expect(read).toMatch(/data-verdict-tone="(ok|warn|stop)"/);
			expect(read).not.toMatch(/style="background:var\(--flag\)"/);
		});

		test('marks each flag’s severity in the locale, never the raw id', async () => {
			const screen = await today(THURSDAY, locale, true);
			const flags = screen.slice(screen.indexOf(copy.flags));
			expect(flags).not.toMatch(/>(stop|warn|info)</);
		});
	});
}
