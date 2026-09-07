// THROWAWAY — the by-hand 360px overflow measurement #60 asks for.
//
// "There is no permanent overflow gate — measure `scrollWidth === 360` by hand on
// `scripts/browser.ts`, and consider making it a real check." This is the by-hand
// half. It lives on the prototype's branch and is not wired into `pnpm verify`,
// for the reason `browser.ts` gives: a gate that needs Chrome and a completed
// build is a gate that gets skipped on the machine that most needs it.
//
// What it reports, per variant per locale: the document's `scrollWidth` against
// the 360px viewport, and the widest element that exceeds it — because
// `scrollWidth: 412` on its own tells you the page overflows and not what did it.
import { fail, open, parseArgs } from './browser.ts';

const VARIANTS = ['D', 'A', 'B', 'C'];
const LOCALES = ['en-US', 'pt-BR'];
const WIDTH = 360;

interface Reading {
	scrollWidth: number;
	/** Elements inside `main`. Carried because #52 closed on the opposite lesson:
	 *  426 elements where #69 measured 1008, and that green was "partly
	 *  green-because-empty". A 360px run over an unrendered page also passes. */
	elements: number;
	scrollHeight: number;
	/** First words of the page. Evidence the locale actually took: identical
	 *  element counts across locales prove nothing on their own, and a run that
	 *  silently stayed in en-US would measure the shorter copy twice. */
	sample: string;
	widest: { tag: string; text: string; width: number } | null;
}

const READ = `(() => {
  const doc = document.documentElement;
  let widest = null;
  for (const el of document.querySelectorAll('main *')) {
    const r = el.getBoundingClientRect();
    if (r.right > ${WIDTH} + 0.5 && (!widest || r.right > widest.width)) {
      widest = {
        tag: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(/\\s+/).slice(0, 2).join('.') : ''),
        text: (el.textContent || '').trim().slice(0, 40),
        width: Math.round(r.right),
      };
    }
  }
  const main = document.querySelector('main');
  return {
    scrollWidth: doc.scrollWidth,
    elements: main ? main.querySelectorAll('*').length : 0,
    scrollHeight: doc.scrollHeight,
    sample: (main ? main.textContent || '' : '').replace(/s+/g, ' ').trim().slice(0, 64),
    widest,
  };
})()`;

const args = parseArgs();
const session = await open({ tool: 'measure-week-prototype', width: WIDTH, url: args.get('url') });

try {
	let failures = 0;
	for (const locale of LOCALES) {
		await session.setLocale(locale);
		for (const variant of VARIANTS) {
			await session.goto(`${session.origin}/prototype/week?variant=${variant}`);
			const r = await session.evaluate<Reading>(READ);
			const over = r.scrollWidth > WIDTH;
			if (over) failures++;
			const mark = over ? '✗' : 'ok';
			const detail = r.widest
				? ` — widest ${r.widest.tag} at ${r.widest.width}px: "${r.widest.text}"`
				: '';
			// An element count under this floor means the fixture did not render and
			// the 360px pass is meaningless — the run fails rather than reporting ok.
			const empty = r.elements < 20;
			if (empty) failures++;
			console.log(
				`${empty ? '✗' : mark}  ${locale}  variant ${variant}  ` +
					`scrollWidth=${r.scrollWidth}  height=${r.scrollHeight}  elements=${r.elements}` +
					`${empty ? '  — EMPTY, nothing measured' : ''}${detail}\n      ${r.sample}`,
			);
		}
	}
	console.log(
		failures === 0
			? `\nall ${VARIANTS.length * LOCALES.length} runs at scrollWidth === ${WIDTH}`
			: `\n${failures} of ${VARIANTS.length * LOCALES.length} runs overflow ${WIDTH}px`,
	);
} catch (e) {
	fail(String(e));
} finally {
	await session.close();
}
