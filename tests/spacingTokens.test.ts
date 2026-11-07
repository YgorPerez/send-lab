// The spacing tokens (#114) are new names on Tailwind's spacing scale, and two
// things go wrong with a new name there, both found by screenshotting every
// route against the base build.
//
// 1. tailwind-merge drops a class only when it knows a later one conflicts.
//    Unconfigured it kept `gap-sections` beside a caller's `gap-6`, the
//    stylesheet's order picked the winner, and Train and the Timer each grew 28px.
// 2. Every spacing name becomes a utility under every spacing prefix. The first
//    name for the section gap was `section`, which made `h-section` a 28px
//    height and gave every section heading on five screens a box twice its size,
//    because `.h-section` is already the type rank's class in `app.css`.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { card } from '../src/components/ui/variants.ts';
import { cn, twMergeConfig } from '../src/lib/utils.ts';

const css = readFileSync(join(process.cwd(), 'src/app.css'), 'utf8');
const tokens = [...css.matchAll(/--spacing-([a-z]+):/g)].map((m) => m[1]);
const ownClasses = new Set([...css.matchAll(/^\s*\.([a-z][\w-]*)\s*[{,]/gm)].map((m) => m[1]));
// Tailwind's prefixes that take a spacing value.
const PREFIXES = [
	'p',
	'px',
	'py',
	'pt',
	'pb',
	'm',
	'mx',
	'my',
	'mt',
	'mb',
	'gap',
	'gap-x',
	'gap-y',
	'h',
	'w',
	'size',
	'min-h',
	'min-w',
	'max-h',
	'max-w',
	'inset',
	'top',
	'bottom',
	'left',
	'right',
	'space-x',
	'space-y',
	'translate-x',
	'translate-y',
	'scroll-m',
	'scroll-p',
	'indent',
	'basis',
];

describe('the spacing tokens', () => {
	test('are the five DESIGN.md names, and tailwind-merge knows each', () => {
		expect(tokens).toEqual(['sections', 'group', 'row', 'inset', 'gutter']);
		expect(twMergeConfig.extend.theme.spacing).toEqual(tokens);
	});

	test('turn none of the classes app.css defines into a spacing utility', () => {
		// The control: the scan has to be finding the rank classes at all, or an
		// empty set would pass whatever the tokens were called.
		expect(ownClasses).toContain('h-section');
		expect(ownClasses).toContain('h-screen-title');
		const clashes = tokens.flatMap((t) =>
			PREFIXES.map((p) => `${p}-${t}`).filter((c) => ownClasses.has(c)),
		);
		expect(clashes).toEqual([]);
	});
});

describe('a caller overrides a spacing token', () => {
	test.each([
		['flex flex-col gap-sections', 'gap-6', 'flex flex-col gap-6'],
		['flex flex-col gap-group', 'gap-3', 'flex flex-col gap-3'],
		['border-t pt-inset', 'pt-0', 'border-t pt-0'],
		['px-gutter', 'px-0', 'px-0'],
		['gap-1.5', 'gap-row', 'gap-row'],
	])('cn(%s, %s)', (base, override, merged) => {
		expect(cn(base, override)).toBe(merged);
	});

	test('in a recipe too', () => {
		expect(card({ pad: 'sm', class: 'p-0' })).not.toContain('p-inset');
	});

	test('and the type ranks are left alone', () => {
		expect(cn('h-section min-w-0', 'h-11')).toContain('h-section');
	});
});
