// Nothing a keyboard can reach takes its focus ring away (#125).
//
// `app.css` draws the ring on `:focus-visible` in the base layer, and a Tailwind
// `outline-none` is a utility, so the utility wins: #124 found that every text
// input in the app showed no ring to a keyboard, because the `input` recipe
// carried `outline-none`. It put the ring back in the recipe, and the Timer
// editor's typed numbers (`ProtocolRows.tsx`), which carry their own
// `outline-none` outside the recipe, stayed ringless. This is the rule both
// would have kept: `outline-none` is allowed only beside the ring that replaces
// it (`focus-visible:outline-*`), on an element focused from script and never by
// Tab (`tabIndex={-1}`: a question or a title the page moves focus to), or on a
// menu item, whose focus is Base UI's `data-[highlighted]` surface.
//
// THE CONTROLS: the scan has to find the `outline-none`s the app has, and a
// planted bare one has to be caught.
import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative, sep } from 'node:path';
import { describe, expect, test } from 'vitest';

const root = process.cwd();

/** Where an `outline-none` sits: its line, and the element around it. */
interface Hit {
	file: string;
	line: number;
	/** The class string's line and the one after it (a `cn()` may wrap). */
	classes: string;
	/** The opening tag around it, roughly: eight lines up, three down. */
	element: string;
}

function hitsIn(file: string, text: string): Hit[] {
	const lines = text.split('\n');
	return lines.flatMap((line, i) =>
		/(?:^|[\s'"`])outline-none(?:$|[\s'"`])/.test(line) && !/^\s*(\/\/|\*|\/\*)/.test(line)
			? [
					{
						file,
						line: i + 1,
						classes: lines.slice(i, i + 2).join('\n'),
						element: lines.slice(Math.max(0, i - 8), i + 4).join('\n'),
					},
				]
			: [],
	);
}

/** Whether a hit keeps the keyboard's ring, or never needs one. */
function keepsRing(hit: Hit): boolean {
	return (
		/focus-visible:outline-(?:solid|2)/.test(hit.classes) ||
		/data-\[highlighted\]:/.test(hit.classes) ||
		/tabIndex=\{-1\}/.test(hit.element)
	);
}

function sourceFiles(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
		const path = join(dir, e.name);
		if (e.isDirectory()) return e.name === 'paraglide' ? [] : sourceFiles(path);
		return ['.ts', '.tsx'].includes(extname(e.name)) ? [path] : [];
	});
}

function allHits(): Hit[] {
	return sourceFiles(join(root, 'src')).flatMap((path) =>
		hitsIn(relative(root, path).split(sep).join('/'), readFileSync(path, 'utf8')),
	);
}

describe('the focus ring', () => {
	test('the scan finds the outline-none the app has: the input recipe, the menu, the focused titles', () => {
		const files = new Set(allHits().map((h) => h.file));
		expect(files).toContain('src/components/ui/variants.ts');
		expect(files).toContain('src/components/ui/Menu.tsx');
		expect(files).toContain('src/components/ui/primitives.tsx');
	});

	test('the scan catches a bare outline-none and lets the three exceptions through', () => {
		const bare = hitsIn(
			'x.tsx',
			'<input\n\tclassName="h-12 border-b-2 outline-none focus:border-ink"\n/>',
		);
		expect(bare).toHaveLength(1);
		expect(keepsRing(bare[0])).toBe(false);
		const ringed = hitsIn(
			'x.tsx',
			"'outline-none lg:focus-visible:outline-2 lg:focus-visible:outline-solid'",
		);
		expect(keepsRing(ringed[0])).toBe(true);
		const scripted = hitsIn(
			'x.tsx',
			'<h2\n\ttabIndex={-1}\n\tclassName="text-ink outline-none"\n>',
		);
		expect(keepsRing(scripted[0])).toBe(true);
		// Prose about the rule is not a use of it.
		expect(hitsIn('x.tsx', '\t// every input carries `outline-none` to replace')).toHaveLength(0);
	});

	test('every outline-none in src/ gives the ring back, or is never reached by Tab', () => {
		expect(
			allHits()
				.filter((h) => !keepsRing(h))
				.map((h) => `${h.file}:${h.line}`),
			'`outline-none` beats app.css’s :focus-visible ring. Put the ring back beside ' +
				'it (the `input` recipe’s lg:focus-visible:outline-*), or say why Tab never lands here.',
		).toEqual([]);
	});
});
