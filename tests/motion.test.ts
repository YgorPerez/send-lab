// Reduced motion, asserted where it can be asserted without a browser.
//
// Three mechanisms animate this app (#53, obligation 8; see the MOTION block in
// `src/app.css`), and each fails differently:
//
//   1. CSS transitions and keyframes, `tw-animate-css` included.
//   2. The view-transition pseudo-elements, which live on the root, outside the
//      `*` selector's reach, and which the spec does not apply
//      `prefers-reduced-motion` to at all (csswg #10267, open).
//   3. WAAPI — what Motion drives. Motion defaults to `reducedMotion: "never"`,
//      so it opts *out* unless told otherwise, and no stylesheet can reach it.
//
// This file guards 1 and 2 by reading the stylesheet, and 3 by reading the import
// graph. It cannot prove any of them *work* — that needs a browser with the media
// feature emulated, which is `pnpm check:motion`. What it can do is fail the
// moment a rule is deleted or Motion is entered through the wrong door, neither
// of which is visible in a diff review and both of which look fine on a machine
// that has reduced motion switched off.
import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative, sep } from 'node:path';
import { describe, expect, test } from 'vitest';

const root = process.cwd();
const css = readFileSync(join(root, 'src', 'app.css'), 'utf8');

/** The body of the one `prefers-reduced-motion: reduce` block, braces matched. */
function reducedBlock(source: string): string {
	const at = source.indexOf('@media (prefers-reduced-motion: reduce)');
	expect(at, 'src/app.css has no prefers-reduced-motion block at all').toBeGreaterThan(-1);
	let depth = 0;
	let start = -1;
	for (let i = at; i < source.length; i++) {
		if (source[i] === '{') {
			if (depth === 0) start = i + 1;
			depth += 1;
		} else if (source[i] === '}') {
			depth -= 1;
			if (depth === 0) return source.slice(start, i);
		}
	}
	throw new Error('src/app.css: unbalanced braces in the reduced-motion block');
}

describe('mechanism 1 — CSS transitions and keyframes', () => {
	const block = reducedBlock(css);

	test('neutralises animation and transition on every element', () => {
		expect(block).toMatch(/\*\s*,\s*::before\s*,\s*::after/);
		for (const property of ['animation-duration', 'transition-duration']) {
			expect(block, `${property} is not overridden under reduced motion`).toContain(
				`${property}: 0.01ms !important`,
			);
		}
	});

	// A short duration does not shorten an infinite animation, it speeds it up.
	// Anything that loops has to be stopped after one pass, and `tw-animate-css`
	// ships looping utilities (`animate-pulse`, `animate-spin`) that are one class
	// away from being used.
	test('stops anything that loops', () => {
		expect(block).toContain('animation-iteration-count: 1 !important');
	});
});

describe('mechanism 2 — the view-transition pseudo-elements', () => {
	const block = reducedBlock(css);

	// These are the reason a `*` rule is not enough. They are generated on the
	// root, `*` never matches them, and the app animates every navigation.
	test('are neutralised by name, since the wildcard cannot reach them', () => {
		for (const pseudo of [
			'::view-transition-group(*)',
			'::view-transition-old(*)',
			'::view-transition-new(*)',
		]) {
			expect(block, `${pseudo} is not covered under reduced motion`).toContain(pseudo);
		}
		expect(block).toContain('animation-delay: 0s !important');
	});

	// Every named view-transition animation the app declares has to be one the
	// block above actually covers — a rule scoped to a *named* pseudo-element
	// (`::view-transition-new(screen)`) is more specific than the wildcard, so a
	// future rule with its own `!important` would silently outrank it.
	test('no named view-transition rule outranks the reduced-motion override', () => {
		// Everything except the reduced-motion block itself, whose own rules are
		// `!important` on purpose.
		const rest = css.replace(block, '');
		const named = [...rest.matchAll(/::view-transition-(?:group|old|new)\(([^)]+)\)/g)].map(
			(mt) => mt[1],
		);
		// `topbar` and `tabbar` are `animation: none`, `screen` is the crossfade.
		// A fourth name appearing here means a new animation nobody has decided a
		// reduced-motion answer for.
		expect(new Set(named)).toEqual(new Set(['topbar', 'tabbar', 'screen']));
		for (const [, body] of rest.matchAll(
			/::view-transition-(?:group|old|new)\([^)]+\)[^{]*\{([^}]*)\}/g,
		)) {
			expect(body, 'a named view-transition rule uses !important').not.toContain('!important');
		}
	});
});

describe('mechanism 3 — Motion and WAAPI', () => {
	/** Every hand-written source file under `src/`, generated output excluded. */
	function sourceFiles(dir: string, out: string[] = []): string[] {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const full = join(dir, entry.name);
			if (entry.isDirectory()) {
				if (entry.name === 'paraglide') continue;
				sourceFiles(full, out);
			} else if (['.ts', '.tsx'].includes(extname(entry.name)) && !entry.name.endsWith('.gen.ts')) {
				out.push(full);
			}
		}
		return out;
	}

	// The one module allowed to import Motion, once one exists. Same shape as
	// #20's `createAuthedRoute` rule: one project-local entry point, and a test
	// asserting nobody goes around it.
	const SANCTIONED = 'components/ui/motion.tsx';
	const IMPORT = /from\s+['"]motion(?:\/[^'"]*)?['"]/;

	test('is entered only through a provider that sets reducedMotion="user"', () => {
		const importers = sourceFiles(join(root, 'src'))
			.filter((file) => IMPORT.test(readFileSync(file, 'utf8')))
			.map((file) => relative(join(root, 'src'), file).split(sep).join('/'));

		expect(
			importers.filter((file) => file !== SANCTIONED),
			`Motion defaults to reducedMotion: "never" — it opts *out* of the athlete's ` +
				`setting unless told otherwise, and no CSS can reach a WAAPI animation. ` +
				`Import it only from src/${SANCTIONED}, which must wrap its children in ` +
				`<MotionConfig reducedMotion="user">. Create that module if it does not exist yet.`,
		).toEqual([]);
	});

	// Motion is installed and pinned (#46) but deliberately unentered: the app's
	// animation is CSS and view transitions, and full `motion/react` is 42.3 kB
	// against `animateView`'s 6.5. If this starts failing, the bundle grew — check
	// that whatever entered Motion needed to.
	test('is not entered today', () => {
		const importers = sourceFiles(join(root, 'src')).filter((file) =>
			IMPORT.test(readFileSync(file, 'utf8')),
		);
		expect(importers).toEqual([]);
	});
});
