// What the three built screens say when the account has nothing (#61).
//
// `tests/screens.test.ts` seeds the five-week scenario and asserts the screens
// render the whole of it. This suite is its complement: the store is reset and
// **not** seeded, which is what a fresh account reads, and what is asserted is
// that each screen answers the empty case honestly rather than drawing furniture
// around nothing.
//
// The one real trap this guards is on Today. `computeReadiness` scores the
// wellness questions' *fallback* values when none is answered, so an unanswered
// check still produces a score and a verdict — and a verdict from no evidence
// looked exactly like one from a full check, holding work off the plan on the
// strength of nothing. The empty read says there is no check yet; it does not
// invent one.
//
// Two weekdays are pinned, because Train has two empty states and they fall on
// different days: a training weekday with no set ticked off, and a rest weekday
// with no scheduled work at all. The store is discarded *after* the clock moves,
// for the reason `screens.test.ts` gives.
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { getContent } from '../src/lib/content/index.ts';
import { overwriteGetLocale } from '../src/lib/paraglide/runtime.js';
import { resetRecordStore } from '../src/lib/store/record.ts';
import { routeTree } from '../src/routeTree.gen.ts';

/** A Thursday: a training day in the built-in week, so the plan has tasks. */
const THURSDAY = new Date('2026-08-13T09:30:00');
/** The Sunday after it: the built-in week's rest day, so nothing is scheduled. */
const SUNDAY = new Date('2026-08-16T09:30:00');

beforeAll(() => {
	vi.useFakeTimers({ toFake: ['Date'] });
});

afterAll(() => {
	vi.useRealTimers();
	resetRecordStore();
});

/** Render one path against an empty store, on the given day, in the given locale. */
async function render(path: string, day: Date, locale: 'en-US' | 'pt-BR'): Promise<string> {
	vi.setSystemTime(day);
	resetRecordStore();
	overwriteGetLocale(() => locale);
	const router = createRouter({
		routeTree,
		history: createMemoryHistory({ initialEntries: [path] }),
	});
	await router.load();
	return renderToString(createElement(RouterProvider, { router } as never));
}

/** The `<button …>` tag enclosing a label, for asserting on its attributes. */
function openingTagOf(html: string, label: string): string {
	const at = html.indexOf(label);
	expect(at, label).toBeGreaterThan(-1);
	return html.slice(html.lastIndexOf('<button', at), at);
}

const COPY = {
	'en-US': {
		noCheck: 'No readiness check yet today',
		noTrend: 'The trend draws itself',
		noWork: 'No scheduled work today',
		noSetDone: 'Tick off at least one set',
		noChecks: 'No readiness check recorded yet',
		noSessions: 'No session recorded yet',
		usual: 'about your usual',
		held: 'held · readiness',
		question: 'How did you sleep?',
		finish: 'Finish &amp; log session',
		microcycle: 'Microcycle',
		thursday: 'Thu',
	},
	'pt-BR': {
		noCheck: 'Nenhum check de prontidão hoje ainda',
		noTrend: 'A tendência se desenha',
		noWork: 'Nenhum trabalho programado hoje',
		noSetDone: 'Marque ao menos uma série',
		noChecks: 'Nenhum check de prontidão registrado ainda',
		noSessions: 'Nenhuma sessão registrada ainda',
		usual: 'perto do seu normal',
		held: 'segurado · prontidão',
		question: 'Como foi seu sono?',
		finish: 'Concluir e registrar treino',
		microcycle: 'Microciclo',
		thursday: 'Qui',
	},
} as const;

for (const locale of ['en-US', 'pt-BR'] as const) {
	const copy = COPY[locale];

	describe(`${locale}, empty account`, () => {
		// Week (#63) has no empty state on a fresh account, and that is the point.
		// A week always has seven slots, and an account with no program of its own
		// falls back to the built-in week — so the honest read is a full schedule
		// with nothing ticked, not a box drawn round nothing. The copy that *would*
		// fire (`wk_nothing_scheduled`) needs an athlete who rests every day.
		test('Week shows the built-in week rather than an empty box', async () => {
			const week = await render('/week', THURSDAY, locale);
			expect(week).toContain(copy.microcycle);
			expect(week).toContain(copy.thursday);
			// Scheduled, and none of it trained: six of seven days carry work in the
			// built-in week, and a fresh account has ticked nothing.
			//
			// Comments stripped first: React puts `<!-- -->` between adjacent text
			// nodes in a string render, so the reading is `0<!-- -->/<!-- -->6` in the
			// markup and `0/6` on the screen.
			expect(week.replaceAll('<!-- -->', '')).toContain('0/6');
			// Every slot names its state, so the dot's colour is not the only thing
			// carrying it.
			expect(week).toContain(locale === 'en-US' ? '· Today"' : '· Hoje"');
			expect(week).toContain(locale === 'en-US' ? '· Rest"' : '· Descanso"');
			// The empty copy stays off the screen while the week has work in it.
			expect(week).not.toContain(
				locale === 'en-US' ? 'No day in this week' : 'Nenhum dia desta semana',
			);
		});

		test('Today says there is no check yet, rather than scoring the fallbacks', async () => {
			const today = await render('/', THURSDAY, locale);
			expect(today).toContain(copy.noCheck);
			// No verdict of any kind: the read is the one thing on the screen that
			// must not be fabricated.
			for (const verdict of Object.values(getContent(locale).verdicts)) {
				expect(today).not.toContain(verdict.title);
			}
			// No baseline, so nothing is "about your usual".
			expect(today).not.toContain(copy.usual);
			// No verdict, so no work is held from it.
			expect(today).not.toContain(copy.held);
			// The check itself is still there to be answered — it is the way out.
			expect(today).toContain(copy.question);
			// The trend has nothing to draw.
			expect(today).toContain(copy.noTrend);
		});

		test('Train with a slot but no set ticked off holds the finish button', async () => {
			const train = await render('/train', THURSDAY, locale);
			expect(train).not.toContain(copy.noWork);
			expect(train).toContain(copy.noSetDone);
			// The primary is disabled, not hidden: it says what finishing needs.
			expect(openingTagOf(train, copy.finish)).toContain('disabled=""');
		});

		test('Train on a day with nothing scheduled says so', async () => {
			const train = await render('/train', SUNDAY, locale);
			expect(train).toContain(copy.noWork);
		});

		test('Log names what each list is waiting for', async () => {
			const log = await render('/log', SUNDAY, locale);
			expect(log).toContain(copy.noChecks);
			expect(log).toContain(copy.noSessions);
			// No rows, so no accordion: the empty list is copy, not an empty box.
			expect(log).not.toContain('aria-expanded');
		});
	});
}
