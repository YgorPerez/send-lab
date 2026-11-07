// The two things #52 decided that nothing else can catch.
//
// Both are invisible in a diff review, both look correct on the machine the
// author is on, and both are cheap to assert. Neither needs a browser — what
// needs a browser is `pnpm check:hydration --desktop`, `check:contrast --desktop`
// and `check:motion --desktop`, which measure the layout rather than its rules.
//
// 1. THE SHELL DOES NOT READ THE VIEWPORT
// ---------------------------------------
// ADR 0006 fixes one `ssr: false` seam at the root, and the build prerenders it
// into `/_shell.html` — a single artefact, user-independent by construction, that
// the service worker precaches and serves on a cold start. "User-independent" had
// only ever meant "does not know who is signed in". The desktop layout adds a
// second axis: it must also not know how wide the window is.
//
// A tab bar and a rail chosen in JS would be one of two failures, and both are
// quiet: the shell bakes whichever layout the *build machine* implied and every
// load at the other width hydrates against the wrong markup — #70's mismatch with
// a new cause, visible only as a console error while the page looks correct — or
// the build emits two shells and the precache has to pick one before a window
// exists. So: nothing in the shell chain reads the viewport, and there is one nav
// and one main. See ADR 0018.
//
// 2. A HOVER STATE NEVER LANDS ON AN ACCENT FILL
// ----------------------------------------------
// `pnpm check:contrast` drives a real browser over every text element in both
// locales — and it measures a page **nobody is hovering**. That makes hover the
// one place a contrast regression cannot be caught by the check that catches
// everything else, and the app has a live example of the trap: `--flag-deep`
// carries the ground at **3.91:1**, under the floor. It is already the primary
// button's `active:` fill, which is correct — a press lasts as long as the finger
// is down — and would be wrong as a `hover:`, which lasts as long as a pointer
// rests there.
import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative, sep } from 'node:path';
import { describe, expect, test } from 'vitest';

const root = process.cwd();

/** The files that decide what `/_shell.html` *looks like* — the tree the build
 *  bakes into it, minus the parts that render nothing until the client has
 *  hydrated. It was two files until #83 put the sync state in the strip: that one
 *  is empty in the baked artefact, but it is a real element in the strip a moment
 *  later, and a `lg:`-versus-JS decision inside it would bake the same wrong
 *  answer as one in `AppShell` itself. #115 added the navigation, which is baked
 *  into the shell as the bar and becomes the rail from `lg`, and `lib/chrome.ts`,
 *  which decides from the matched route what the chrome shows: that is where a
 *  viewport read would be most tempting. `UpdateAnnouncement.tsx` is scanned by
 *  the assertions further down instead, which are about where it sits rather
 *  than what it measures. */
const SHELL = [
	'src/routes/__root.tsx',
	'src/components/AppShell.tsx',
	'src/components/SyncStatus.tsx',
	'src/components/Navigation.tsx',
	'src/lib/chrome.ts',
];

/**
 * A source file with its prose taken out.
 *
 * Written after the first run failed on it: `AppShell.tsx` explains in a comment
 * why it must not read `matchMedia`, and says "exactly one `<nav>` and one
 * `<main>`" — so both scans below matched the *documentation* of the rule instead
 * of a breach of it. Same false positive `tests/ids.test.ts` hit with
 * `ReadonlySet<ExerciseId>`, and the same answer: narrow what is scanned rather
 * than loosen what is asserted, or the comment explaining a rule becomes a thing
 * nobody may write.
 */
function stripComments(text: string): string {
	return text
		.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
		.split('\n')
		.filter((line) => !line.trimStart().startsWith('//'))
		.join('\n');
}

const code = (file: string) => stripComments(readFileSync(join(root, file), 'utf8'));

// The scanner gets its own test, for the reason both other source-scanning suites
// in this repo have one: a scanner that silently stopped matching would take
// every assertion built on it green. `ids.test.ts` learned this by shipping a
// false positive; this file learned it by hitting one on its first run.
describe('stripComments', () => {
	test('removes the prose and keeps the code', () => {
		const out = stripComments(
			[
				'// a line comment naming matchMedia',
				'/* a block comment naming <nav> */',
				'const keep = 1; // trailing prose is not stripped, and should not be',
				'{/* a JSX comment naming <main> */}',
				'const also = matchMedia;',
			].join('\n'),
		);
		expect(out).not.toContain('a line comment');
		expect(out).not.toContain('a block comment');
		expect(out).not.toContain('a JSX comment');
		expect(out).toContain('const keep = 1;');
		expect(out).toContain('const also = matchMedia;');
	});

	// The narrower half, stated so the limit is known rather than discovered: a
	// trailing comment on a line of code survives. That is deliberate — dropping
	// the whole line would hide the code — and it means a viewport read must never
	// be *documented* on the same line as code.
	test('does not strip a trailing comment', () => {
		expect(stripComments('const x = 1; // innerWidth')).toContain('innerWidth');
	});
});

describe('the shell does not read the viewport', () => {
	/**
	 * Every way a component can learn how wide the window is.
	 *
	 * `matchMedia` is the one anybody would reach for; the rest are the ways round
	 * it that a linter would not flag. `useMediaQuery` catches a hook imported from
	 * anywhere, including one written in this repo later.
	 */
	const VIEWPORT_READS = [
		/\bmatchMedia\b/,
		/\b(?:inner|outer)(?:Width|Height)\b/,
		/\bvisualViewport\b/,
		/\bscreen\.(?:width|height|availWidth|availHeight)\b/,
		/\bResizeObserver\b/,
		/\buseMediaQuery\b/,
		/\bclientWidth\b/,
		/\bgetBoundingClientRect\b/,
	];

	for (const file of SHELL) {
		test(`${file} decides nothing from the window's size`, () => {
			const text = code(file);
			const found = VIEWPORT_READS.filter((re) => re.test(text)).map((re) => re.source);
			expect(
				found,
				`${file} is prerendered into /_shell.html, which is one artefact for every ` +
					`viewport. A layout branched on a measurement here bakes one answer and ` +
					`hydrates against it everywhere else. Express the difference as a \`lg:\` ` +
					`utility on the element that already exists.`,
			).toEqual([]);
		});
	}

	// The control. Every assertion above is an *absence*, and an absence is also
	// what a scan of the wrong file reports.
	test('the files it scans are the ones that render the shell', () => {
		expect(code('src/routes/__root.tsx')).toContain('<AppShell');
		expect(code('src/components/AppShell.tsx')).toContain('export function AppShell');
		expect(code('src/components/AppShell.tsx')).toContain('<SyncStatus');
	});
});

describe('the chrome is one nav and one main, below the shell', () => {
	const shell = code('src/components/AppShell.tsx');

	const nav = code('src/components/Navigation.tsx');
	const css = readFileSync(join(root, 'src', 'app.css'), 'utf8');

	// One of each. Two navs behind a media query (a bar for the phone, a rail for
	// the desk) would also work as CSS and is still wrong, for reasons that
	// outlive any layout: assistive technology sees both, the second one's links
	// are duplicate landmarks, and a duplicated `view-transition-name` is one of
	// the three ways a transition silently skips (#43). The bar and the rail are
	// one element under two stylesheets (ADR 0018), and More's sheet is a dialog,
	// not a second navigation.
	test('there is exactly one <nav> and one <main> across the chrome', () => {
		expect(shell.match(/<main[\s>]/g) ?? [], 'the shell should own the one <main>').toHaveLength(1);
		expect(
			shell.match(/<nav[\s>]/g) ?? [],
			'the shell should own no <nav>: the navigation is its own component',
		).toHaveLength(0);
		expect(nav.match(/<nav[\s>]/g) ?? [], 'Navigation should own the one <nav>').toHaveLength(1);
		expect(shell, 'the shell no longer renders the navigation').toContain('<Navigation');
	});

	// The positive half. Without it, a shell that had quietly lost its desktop
	// layout altogether would pass every assertion above. They are asserted as
	// *plausible* numbers rather than exact ones — the point is that a phone
	// measure and a widened one both exist, not that they are 520 and 1000
	// forever.
	test('main still carries both measures, at usable sizes', () => {
		const main = /<main[\s>][\s\S]*?>/.exec(shell)?.[0] ?? '';
		expect(main, 'main has lost the phone measure').toContain('max-w-[520px]');
		const wide = Number(/lg:max-w-\[(\d+)px\]/.exec(main)?.[1] ?? 0);
		expect(wide, 'main does not widen enough at lg for two phone-width columns').toBeGreaterThan(
			760,
		);
	});

	// The bar on a phone and the rail from `lg`, as one element. What a string
	// render cannot see is which classes apply at which width, so the deciding
	// utilities are asserted where they are written; the four browser gates
	// measure the result with and without `--desktop`.
	test('the bar is the bottom edge on a phone and the rail from lg', () => {
		const element = /<nav[\s\S]*?>\s*\{DESTINATIONS/.exec(nav)?.[0] ?? '';
		expect(element, 'the <nav> element was not found').not.toBe('');
		expect(element, 'the bar is not fixed to the bottom edge').toMatch(/fixed inset-x-0 bottom-0/);
		expect(element, 'the bar does not clear the home indicator').toContain(
			'pb-[env(safe-area-inset-bottom)]',
		);
		expect(element, 'the bar does not become a rail at lg').toMatch(/lg:top-11/);
		expect(element, 'the rail is not 200px').toContain('lg:w-50');
		expect(nav, 'More is not hidden at lg, where the rail lists everything').toMatch(
			/className=\{cn\(ITEM, 'lg:hidden'\)\}/,
		);
		// The box is what the page reserves, border and padding included: 56px plus
		// the home indicator is `--nav-clear`, and the rail is the 200px of
		// `--nav-rail`. With `box-content` the rail measured 217px and sat its
		// border 3px from every title between 1024px and ~1215px (#115's critique).
		expect(element, 'the bar adds padding or a border outside what it reserves').not.toContain(
			'box-content',
		);
		expect(element, 'the bar is not as tall as what the page reserves').toContain(
			'h-[var(--nav-clear)]',
		);
	});

	// More's sheet stays visible at every width. Hidden from `lg` while still
	// open (a phone rotated past 1024px, a window widened), it was a modal nobody
	// could see, holding focus and the page's scroll.
	test('More hides its trigger at lg, never its open sheet', () => {
		const sheet = /<Dialog\.Portal>[\s\S]*?<\/Dialog\.Portal>/.exec(nav)?.[0] ?? '';
		expect(sheet, 'the sheet was not found').not.toBe('');
		expect(sheet).not.toContain('lg:hidden');
	});

	// The navigation is read before the page: a keyboard reaches the rail (drawn
	// first at lg) without tabbing through the whole screen, and a screen reader
	// meets the landmark first. Both are fixed, so nothing moves on screen.
	test('the navigation comes before main in the document', () => {
		expect(shell.indexOf('<Navigation')).toBeGreaterThan(-1);
		expect(shell.indexOf('<Navigation')).toBeLessThan(shell.indexOf('<main'));
	});

	// What the rest of the page clears is one variable that changes at `lg` and
	// on the intake, never a height read in the shell. `main` reserves it, and the
	// update notice sits on it rather than under the bar (story 14).
	test('main reserves the bar, and the update notice sits above it', () => {
		expect(css, '--nav-clear does not include the home indicator').toMatch(
			/--nav-clear:\s*calc\(3\.5rem \+ env\(safe-area-inset-bottom\)\)/,
		);
		const main = /<main[\s>][\s\S]*?>/.exec(shell)?.[0] ?? '';
		expect(main, 'main does not reserve the bar').toContain('var(--nav-clear)');
		const notice = code('src/components/UpdateAnnouncement.tsx');
		expect(notice, 'the update notice is not placed on the bar').toContain(
			'bottom-[var(--nav-clear)]',
		);
	});

	// Story 9: the bar never covers the field being typed in. Where a browser
	// resizes the page for the keyboard, a bar fixed to its bottom rides up over
	// the field, so below `lg` the bar stands down while a field that opens the
	// keyboard has focus. CSS, so the shell reads nothing. Measured on the built
	// app with focus on Train's RPE input: `display: none` at 360px, the rail
	// unchanged at 1280px (#115).
	test('the bar stands down while a typed field has focus, below lg only', () => {
		const rule =
			/@media \(width < 64rem\)\s*\{\s*html:has\([\s\S]*?input:not\([\s\S]*?textarea[\s\S]*?\):focus\s*\)\s*\[data-navigation-bar\]\s*\{\s*display: none;/;
		expect(css, 'app.css lost the rule that keeps the bar off a focused field').toMatch(rule);
		expect(nav, 'the bar lost the attribute the rule selects').toContain('data-navigation-bar');
		expect(
			code('src/routes/__root.tsx'),
			'the viewport meta no longer keeps the bar under the keyboard',
		).toContain('interactive-widget=resizes-visual');
	});

	// Story 12: a control touched once does not take the strip on every screen.
	// Settings carries the switch, through the same `chooseLocale`.
	test('the strip carries no locale switch', () => {
		expect(shell).not.toContain('LocaleSwitch');
		expect(shell).not.toContain('chooseLocale');
		// Through a handler since #125, which notes the press so focus can come
		// back to the language after the tree re-keys.
		expect(code('src/routes/settings.tsx'), 'Settings lost the language choice').toMatch(
			/onChange=\{\(next\) => \{[^}]*chooseLocale\(next\);/,
		);
	});

	// ADR 0008's states have to be readable from every screen, and the strip is
	// the only surface every screen has — so this is where they go, and a page
	// that says "Offline" for itself is the shape #83 replaced rather than a
	// second opinion. The chip is beside the wordmark on purpose: the strip is
	// `justify-between`, so a token that appears and disappears in the left group
	// moves nothing, while the same token in the right group would slide the
	// locale switch and the menu sideways on every tick.
	test('the strip carries the sync state, on the anchored side', () => {
		// With the boot locale, like everything else in the strip: `m.*()` reads
		// the locale at call time and the strip renders in `en-US` until the app
		// has hydrated, so a component reading the ambient one would be the single
		// element in the strip in the other language.
		expect(shell, 'the sync state is not given the strip’s locale').toContain(
			'<SyncStatus state={sync} locale={locale} />',
		);
		const header = /<header[\s\S]*?<\/header>/.exec(shell)?.[0] ?? '';
		expect(header, 'the sync state left the strip').toContain('<SyncStatus');
		expect(
			header.indexOf('<SyncStatus'),
			'the sync state is on the right, where its appearing moves the screen action',
		).toBeLessThan(header.indexOf('<ScreenAction'));

		for (const page of ['src/routes/settings.tsx', 'src/routes/login.tsx']) {
			expect(code(page), `${page} says the sync state a second time`).not.toContain(
				'm.sync_offline()',
			);
		}
	});

	// ADR 0008's third state — #84 — is the one that is *not* a token, and the two
	// halves of it are decided in two files. It would be easy for the strip to end
	// up carrying both voices at once: an unmissable announcement with the
	// wordmark still introducing the app beside it, which is a 360px strip trying
	// to hold a sentence and a wordmark. So the yield is asserted where it is
	// written, and asserted to be the *only* thing the wordmark yields to.
	test('the wordmark stands down for a refusal, and for nothing else', () => {
		const header = /<header[\s\S]*?<\/header>/.exec(shell)?.[0] ?? '';
		expect(header, 'the wordmark left the strip').toContain('Send Lab');
		// Whitespace-tolerant: this asserts the ternary, not the formatter's line
		// breaks, which is a distinction the first version of it got wrong.
		expect(header, 'the wordmark no longer yields to the refused-work announcement (#84)').toMatch(
			/sync === 'refused-work'\s*\?\s*null\s*:\s*<span className="eyebrow">\s*Send Lab/,
		);
		// One reading for both halves. Two calls to `useSyncState` would be two
		// subscriptions to the same store deciding one strip, which is how the
		// wordmark and the announcement come to disagree.
		expect(
			shell.match(/useSyncState\(\)/g)?.length,
			'the shell reads the sync state more than once',
		).toBe(1);
		// And the announcement never renders beside a chip. The precedence is
		// `resolveSyncState`'s and `tests/syncState.test.ts` holds it; what this
		// holds is that the component does not reintroduce a second answer.
		expect(
			code('src/components/SyncStatus.tsx'),
			'the refused-work announcement is rendered from something other than the resolved state',
		).toContain("state === 'refused-work'");
	});

	// `topbar` and `navigation` are lifted out of the root snapshot by name so the
	// strip and the bar hold still while the screen between them is replaced
	// (#54). `tests/motion.test.ts` asserts the other side of this pairing: that
	// `app.css` declares exactly these names and no other.
	test('the chrome still carries its view-transition names', () => {
		for (const name of ['topbar', 'screen']) {
			expect(shell, `viewTransitionName: '${name}' is gone from the shell`).toContain(
				`viewTransitionName: '${name}'`,
			);
		}
		expect(nav, "viewTransitionName: 'navigation' is gone from the bar").toContain(
			"viewTransitionName: 'navigation'",
		);
		expect(shell + nav, "'tabbar' is the old bar's name").not.toContain(
			"viewTransitionName: 'tabbar'",
		);
	});
});

describe('a hover state never lands on an accent fill', () => {
	/** Every hand-written source file under `src/`, generated output excluded.
	 *  Same walk as `tests/motion.test.ts`. */
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

	/**
	 * What a hover utility is allowed to change.
	 *
	 * The rule, stated as an allow-list rather than a ban-list, because the ways to
	 * get this wrong outnumber the ways to get it right:
	 *
	 *   * a **background**, only within the neutral panel ramp. Every text colour
	 *     the app uses clears 4.5:1 on all three panel steps, so moving between
	 *     them cannot break a pair.
	 *   * **text**, only *lighter* — `ink` and `chalk` are the two lightest inks,
	 *     so a hover that reaches for one can only improve a ratio.
	 *   * a **border**, any colour. A border carries no text.
	 *
	 * Anything else — a hover onto `flag`, `flag-deep`, `teal`, `gold`, `violet`,
	 * or down to `ink-faint` — has to be measured before it is allowed, and the
	 * measurement is a browser hovering the element, which nothing in this repo
	 * does. So it is refused here instead.
	 */
	const ALLOWED = /^hover:(?:bg-(?:panel|panel-2|panel-3)|text-(?:ink|chalk)|border-.+)$/;

	/** Every `hover:` utility in the tree, `lg:`-prefixed ones included. */
	function hoverUtilities(): { file: string; utility: string }[] {
		const found: { file: string; utility: string }[] = [];
		for (const file of [...sourceFiles(join(root, 'src')), join(root, 'src', 'app.css')]) {
			const text = readFileSync(file, 'utf8');
			for (const [, utility] of text.matchAll(/(?:^|[\s'"`])((?:lg:)?hover:[\w[\]/.-]+)/g)) {
				found.push({
					file: relative(root, file).split(sep).join('/'),
					utility: utility.replace(/^lg:/, ''),
				});
			}
		}
		return found;
	}

	// The control, and it is the point. Every assertion below is an *absence*, and
	// an absence is exactly what a scanner that stopped matching also reports — the
	// mistake `check:motion` guards against with its own control pass. If the app
	// genuinely loses all hover states this fails and should: it means the desktop
	// input layer #52 added is gone, and this rule with it.
	test('the scan actually finds the hover states the app has', () => {
		const found = hoverUtilities();
		expect(
			found.length,
			'no hover utility matched anywhere in src/ — the scanner below is asserting ' +
				'nothing. Either the desktop input layer (#52) was removed, or the match ' +
				'pattern stopped matching Tailwind syntax.',
		).toBeGreaterThan(5);
		expect(found.map((f) => f.file)).toContain('src/components/ui/variants.ts');
	});

	test('every hover utility moves a surface, a border, or text upward', () => {
		const offenders = hoverUtilities()
			.filter(({ utility }) => !ALLOWED.test(utility))
			.map(({ file, utility }) => `${file}: ${utility}`);
		expect(
			offenders,
			'`pnpm check:contrast` measures a page nobody is hovering, so a hover state ' +
				'is the one place it cannot catch a contrast regression. White on `--flag` ' +
				'is 3.11:1 and the ground on `--flag-deep` is 3.91:1 — both fine as an ' +
				'`active:` press, neither fine as a hover a pointer can rest on. Move a ' +
				'surface within the panel ramp, take text *lighter*, or change a border. ' +
				'If a new hover genuinely needs something else, measure it hovering first ' +
				'and then widen ALLOWED with the number in the comment.',
		).toEqual([]);
	});
});
