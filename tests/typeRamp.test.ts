// Every font size in the tree is a step of DESIGN.md's ramp (#125).
//
// The screens drifted one literal at a time: 10.5, 12, 12.5 and 13.5px sat beside
// the ramp's 11 and 13 on Today, Train and the injury sheet, each one picked by
// eye on its own ticket, and `impeccable detect` kept flagging them on every
// ticket of #113 without any of them being anyone's to fix. The sweep moved them
// onto the ramp; this keeps them there. A size that is not a step fails here, and
// the fix is the nearest step or, if the screen really needs a new one, a line
// in DESIGN.md › Typography › Hierarchy and the step added below.
//
// Two lists, because the clock is read from across the room and has its own
// sizes (DESIGN.md: the segment name, PAUSED, Round · Set, the strip's counts),
// and those must not leak onto a screen read at arm's length.
//
// THE CONTROLS. A scanner that stops matching reports the same clean run as a
// tree that keeps the rule, so the scan has to find the sizes the app has, and
// a planted off-ramp literal has to be caught. Both are asserted.
import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative, sep } from 'node:path';
import { describe, expect, test } from 'vitest';

const root = process.cwd();

/** The ramp every screen sets type in (DESIGN.md › Typography › Hierarchy).
 *  9 microlabel · 10 label · 11 meta and data · 13 body · 14 section · 15 body
 *  large · 16 title (and `text-base`, the inputs' iOS floor) · 17 the editor's
 *  dialog title · 21 headline · 22 count · 30 Today's score and a typed clock
 *  number. */
const RAMP = new Set([9, 10, 11, 13, 14, 15, 16, 17, 21, 22, 30]);

/** The clock's own sizes, allowed only in the files that draw a clock. */
const CLOCK_RAMP = new Set([18, 19, 20, 24, 25, 28, 34, 36, 44, 56, 64]);
const CLOCK_FILES = new Set([
	'src/components/Timer.tsx',
	'src/components/Stopwatch.tsx',
	'src/components/FullScreenClock.tsx',
	'src/components/ProtocolEditor.tsx',
	'src/components/ProtocolRows.tsx',
]);

/** Every literal font size in a source text: a Tailwind `text-[Npx]` (with any
 *  variant prefix) or a CSS `font-size: Npx`. */
function fontSizesIn(text: string): number[] {
	const sizes: number[] = [];
	for (const [, px] of text.matchAll(/(?:^|[\s'"`:])text-\[(\d+(?:\.\d+)?)px\]/g))
		sizes.push(Number(px));
	for (const [, px] of text.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)) sizes.push(Number(px));
	return sizes;
}

function sourceFiles(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
		const path = join(dir, e.name);
		if (e.isDirectory()) return e.name === 'paraglide' ? [] : sourceFiles(path);
		return ['.ts', '.tsx', '.css'].includes(extname(e.name)) ? [path] : [];
	});
}

function allSizes(): { file: string; px: number }[] {
	return sourceFiles(join(root, 'src')).flatMap((path) => {
		const file = relative(root, path).split(sep).join('/');
		return fontSizesIn(readFileSync(path, 'utf8')).map((px) => ({ file, px }));
	});
}

function offRamp(sizes: { file: string; px: number }[]) {
	return sizes.filter(
		({ file, px }) => !RAMP.has(px) && !(CLOCK_FILES.has(file) && CLOCK_RAMP.has(px)),
	);
}

describe('the type ramp', () => {
	test('the scan finds the sizes the app sets, in components and in app.css', () => {
		const sizes = allSizes();
		// About 180 literals when this was written. A scanner that stopped
		// matching would find none and pass everything.
		expect(sizes.length).toBeGreaterThan(100);
		expect(sizes.some((s) => s.file === 'src/app.css')).toBe(true);
		expect(sizes.some((s) => CLOCK_FILES.has(s.file) && CLOCK_RAMP.has(s.px))).toBe(true);
	});

	test('the scan catches an off-ramp literal, with a prefix, in CSS, and a clock size off the clock', () => {
		expect(fontSizesIn(`className="mt-1 text-[12.5px] text-ink"`)).toEqual([12.5]);
		expect(fontSizesIn(`'lg:text-[13.5px] lg:px-3'`)).toEqual([13.5]);
		expect(fontSizesIn('.x { font-size: 11.5px; }')).toEqual([11.5]);
		expect(offRamp([{ file: 'src/routes/index.tsx', px: 12.5 }])).toHaveLength(1);
		expect(offRamp([{ file: 'src/routes/index.tsx', px: 64 }])).toHaveLength(1);
		expect(offRamp([{ file: 'src/components/Timer.tsx', px: 64 }])).toHaveLength(0);
	});

	test('every font size in src/ is a step of the ramp', () => {
		expect(
			offRamp(allSizes()).map(({ file, px }) => `${file}: ${px}px`),
			'A font size off DESIGN.md’s ramp. Use the nearest step (Typography › ' +
				'Hierarchy); a new step is a line there and an entry in this test.',
		).toEqual([]);
	});

	test('DESIGN.md names every step the test allows', () => {
		const design = readFileSync(join(root, 'DESIGN.md'), 'utf8');
		const hierarchy = design.slice(
			design.indexOf('### Hierarchy'),
			design.indexOf('### Named Rules', design.indexOf('### Hierarchy')),
		);
		const named = new Set(
			[...hierarchy.matchAll(/(\d+(?:\.\d+)?)px/g)].map(([, px]) => Number(px)),
		);
		const missing = [...RAMP, ...CLOCK_RAMP].filter((px) => !named.has(px));
		expect(missing, 'a step this test allows that DESIGN.md does not name').toEqual([]);
	});
});
