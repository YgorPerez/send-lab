// THROWAWAY — screenshots of the week prototype, so the variants can be judged
// without running anything.
//
// Six phone frames (3 variants × 2 locales) plus three at `lg`, written to
// `.prototype-shots/`. The athlete's real judgement happens in a browser on the
// deployed preview — #52 was explicit that a local build is not the thing to
// judge — but a contact sheet is what makes "I want A's rows with C's strip"
// possible before anyone opens a laptop.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fail, open, parseArgs, root } from './browser.ts';

const VARIANTS = ['D', 'A', 'B', 'C'];
const LOCALES = ['en-US', 'pt-BR'];
const OUT = join(root, '.prototype-shots');

const args = parseArgs();
const desktop = args.has('desktop');
mkdirSync(OUT, { recursive: true });

const session = await open({
	tool: 'shoot-week-prototype',
	desktop,
	url: args.get('url'),
});

try {
	for (const locale of LOCALES) {
		await session.setLocale(locale);
		for (const variant of VARIANTS) {
			// Desktop only needs one locale pass for layout; the pt-BR length question
			// is a phone question, and doubling the wide shots just doubles the reading.
			if (desktop && locale !== 'en-US') continue;
			await session.goto(`${session.origin}/prototype/week?variant=${variant}`);
			const shot = (await session.cdp.send('Page.captureScreenshot', {
				format: 'png',
				captureBeyondViewport: true,
			})) as { data: string };
			const name = `week-${variant}-${locale}${desktop ? '-lg' : ''}.png`;
			writeFileSync(join(OUT, name), Buffer.from(shot.data, 'base64'));
			console.log(`wrote ${name}`);
		}
	}
} catch (e) {
	fail(String(e));
} finally {
	await session.close();
}
