// Gate step: nothing on any screen is wider than the screen.
//
// WHY THIS EXISTS NOW, AND NOT BEFORE
// -----------------------------------
// 360px is the floor these screens were designed against, and until this file
// there was no permanent gate for horizontal overflow at it — it was measured by
// hand, once, with a throwaway script, and the measurement went stale the moment
// the next page landed. Both [#60](https://github.com/YgorPerez/send-lab/issues/60)
// and [#63](https://github.com/YgorPerez/send-lab/issues/63) asked for it to
// become real, on the grounds that a dense grid is the first thing that breaks;
// `week` is that grid, and this is the check landing with it.
//
// WHY IT CANNOT BE A UNIT TEST
// ----------------------------
// jsdom has no layout engine, so `scrollWidth` is 0 there for everything. The
// only way to know a page fits is to lay it out in a real browser at a real
// width — which is why this joins the three browser checks rather than `pnpm
// verify`, and why `browser.ts` keeps `verify` browserless on purpose.
//
// WHY BOTH LOCALES, ALWAYS
// ------------------------
// pt-BR runs 1.4–2× longer than en-US and breaks a layout first. A gate that
// measured only the base locale would pass on every screen the app has ever had
// a problem with. This is also the locale the ADR-0003 bug class only reproduces
// in, so the two reasons to visit it are the same visit.
//
// THE CONTROL
// -----------
// A page that rendered nothing fits every viewport, so "fits" alone is not
// evidence. #52 closed on exactly this trap — 426 elements where #69 had
// recorded 1008, "partly green-because-empty" — so a route whose `main` holds
// fewer than `MIN_ELEMENTS` fails as unmeasured rather than passing as narrow.
import { discoverLocales, discoverRoutes, fail, open, parseArgs, viewport } from './browser.ts';

const args = parseArgs();
const { width, height, desktop } = viewport(args);

/** Below this, `main` did not render and the width reading means nothing. The
 *  emptiest real screen in the app is `/login`'s pending placeholder, which is
 *  why this is low: it is a smoke alarm, not a density assertion. */
const MIN_ELEMENTS = Number(args.get('min-elements') ?? 8);

/** Sub-pixel slack. A layout that lands on 360.4px because of a fractional
 *  border is not the bug this is looking for; one that lands on 372px is. */
const SLACK = 1;

const ROUTES = (args.get('routes') ?? discoverRoutes().join(',')).split(',').filter(Boolean);
const LOCALES = (args.get('locales') ?? discoverLocales().join(',')).split(',').filter(Boolean);

interface Reading {
	scrollWidth: number;
	elements: number;
	/** The element whose right edge sticks out furthest, so a failure names the
	 *  thing to fix rather than only the page it is on. */
	widest: { tag: string; text: string; right: number } | null;
}

const READ = `(() => {
  const main = document.querySelector('main');
  let widest = null;
  for (const el of document.querySelectorAll('main *')) {
    const r = el.getBoundingClientRect();
    if (r.right > ${width} + ${SLACK} && (!widest || r.right > widest.right)) {
      const cls = typeof el.className === 'string' && el.className
        ? '.' + el.className.trim().split(/\\s+/).slice(0, 3).join('.')
        : '';
      widest = {
        tag: el.tagName.toLowerCase() + cls,
        text: (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 48),
        right: Math.round(r.right),
      };
    }
  }
  return {
    scrollWidth: document.documentElement.scrollWidth,
    elements: main ? main.querySelectorAll('*').length : 0,
    widest,
  };
})()`;

interface Failure {
	route: string;
	locale: string;
	reading: Reading;
	why: 'overflow' | 'empty';
}

const session = await open({
	tool: 'check:overflow',
	width,
	height,
	desktop,
	...(args.has('url') ? { url: args.get('url') as string } : {}),
});

const failures: Failure[] = [];
let measured = 0;

try {
	for (const locale of LOCALES) {
		await session.setLocale(locale);
		for (const route of ROUTES) {
			await session.goto(`${session.origin}${route}`);
			const reading = await session.evaluate<Reading>(READ);
			measured++;
			if (reading.elements < MIN_ELEMENTS) {
				failures.push({ route, locale, reading, why: 'empty' });
			} else if (reading.scrollWidth > width + SLACK) {
				failures.push({ route, locale, reading, why: 'overflow' });
			}
		}
	}
} catch (e) {
	fail(String(e));
} finally {
	await session.close();
}

if (failures.length) {
	console.error(`\ncheck:overflow — ${failures.length} of ${measured} run(s) failed:\n`);
	for (const f of failures) {
		if (f.why === 'empty') {
			console.error(
				`  UNMEASURED  ${f.locale} ${f.route} — main holds ${f.reading.elements} element(s), ` +
					`under ${MIN_ELEMENTS}`,
			);
			console.error('      A page that rendered nothing fits every viewport.');
			continue;
		}
		console.error(`  ${f.reading.scrollWidth}px > ${width}px  ${f.locale} ${f.route}`);
		if (f.reading.widest) {
			console.error(`      widest: ${f.reading.widest.tag} to ${f.reading.widest.right}px`);
			console.error(`      "${f.reading.widest.text}"`);
		}
	}
	console.error(
		'\n  pt-BR runs 1.4–2× longer than en-US, so a failure there and not here is\n' +
			'  the copy, not the layout. Buttons take `min-h` and wrap rather than `h`\n' +
			'  with `nowrap`; a flex child that will not shrink needs `min-w-0`.',
	);
	process.exit(1);
}

console.log(
	`check:overflow — ok (nothing wider than ${width}px across ${ROUTES.length} route(s) ` +
		`[${ROUTES.join(' ')}] × ${LOCALES.length} locale(s) [${LOCALES.join(' ')}])`,
);
