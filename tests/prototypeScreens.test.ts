// Direction A's own delivery criterion, as a test: all three screens render the
// whole fixture, in both locales.
//
// It exists because the alternative was screenshots, and a screenshot proves the
// screen rendered *once*, in the language the machine happened to be in. The
// assertions below are deliberately content assertions rather than snapshots —
// they name the things the prototype brief says must be on each screen (the
// verdict, the held work, the flags, the check, the bodyweight series, the
// timer, the past sessions), so a refactor that quietly drops one of them fails
// here rather than in review.
//
// It does not, and cannot, prove layout: jsdom has no layout engine, so
// horizontal overflow at 360px was checked separately, in a real browser.
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { expect, test } from 'vitest';
import { overwriteGetLocale } from '../src/lib/paraglide/runtime';
import { routeTree } from '../src/routeTree.gen';

async function render(path: string): Promise<string> {
	const router = createRouter({
		routeTree,
		history: createMemoryHistory({ initialEntries: [path] }),
	});
	await router.load();
	return renderToString(createElement(RouterProvider, { router } as never));
}

for (const locale of ['en-US', 'pt-BR'] as const) {
	test(`renders all three screens in ${locale}`, async () => {
		overwriteGetLocale(() => locale);

		const today = await render('/');
		const train = await render('/train');
		const log = await render('/log');

		for (const html of [today, train, log]) {
			expect(html.length).toBeGreaterThan(2000);
		}

		// Today: verdict, plan, held work, stats, trend, flags, quiz, bw, injury.
		expect(today).toContain(locale === 'en-US' ? 'Moderate' : 'Moderado');
		expect(today).toContain(locale === 'en-US' ? 'Pull Strength' : 'Puxada');
		expect(today).toContain(locale === 'en-US' ? 'Antagonists' : 'Antagonistas');
		expect(today).toContain(locale === 'en-US' ? 'Tender finger' : 'Dedo sensível');
		expect(today).toContain('65');
		expect(today).toContain('71.9');
		expect(today).toContain(locale === 'en-US' ? 'How did you sleep?' : 'Como foi seu sono?');

		// Train: timer, four exercises, prescriptions, set fields.
		expect(train).toContain(locale === 'en-US' ? 'Sloper Density' : 'Density em Sloper');
		expect(train).toContain('Abrahangs');
		expect(train).toContain(locale === 'en-US' ? 'Interval timer' : 'Timer de intervalos');

		// Log: 14 checks + 28 sessions + 8 activity rows.
		expect(log).toContain(locale === 'en-US' ? 'Green light' : 'Sinal verde');
		expect(log).toContain(locale === 'en-US' ? 'Max / Tissue' : 'Máx / Tecido');

		// The training library writes emphasis as inline `<b>` — 37 occurrences,
		// across verdict text, flag advice, prescription cues and the exercise
		// rationale. The rebuild has nothing that renders them, so a screen that
		// interpolates one of those strings directly shows the athlete a literal
		// `<b>` and looks broken for a reason that has nothing to do with design.
		//
		// `Prose` tokenises instead of injecting (never `dangerouslySetInnerHTML`
		// on localized strings). These two assertions are the ones that matter:
		// nowhere escapes a tag, and somewhere produces a real <b> element.
		for (const html of [today, train, log]) {
			expect(html).not.toContain('&lt;b&gt;');
			expect(html).not.toContain('&lt;/b&gt;');
		}
		expect(today).toContain(locale === 'en-US' ? '>7/3 repeaters</b>' : '>repeaters 7/3</b>');
	});
}
