// Gate step: no route hydrates with a mismatch, in either locale.
//
// WHY THIS EXISTS
// ---------------
// React recovers from a hydration mismatch by throwing the client render away
// and rebuilding the tree from scratch. The page then looks *correct*, which is
// the whole problem: the only evidence is a console error, and every screenshot,
// every DOM probe and every assertion about rendered output agrees with a
// healthy run. #70 sat open on `/` and on all four pt-BR routes precisely
// because the one gate that loads real pages in a real browser — `check:contrast`
// — prints these and passes anyway, deliberately (a recoverable mismatch is not
// an unrendered screen, and failing contrast on it would make contrast
// unrunnable). So the observation existed and nothing acted on it.
//
// What it costs when it goes unnoticed: the whole tree re-rendered on every
// load, on a phone, in the locale the athlete actually uses — and a mismatch is
// only *recoverable* by React's judgement, not by ours. #423/#425 are the same
// family and are treated the same here.
//
// THE CONTROL RUNS ARE THE POINT
// ------------------------------
// "No hydration error was logged" is true of a page that never loaded, a page
// that never hydrated, and a harness whose console channel is not wired up. Each
// of those would ship this check green and useless — the same mistake
// `check:motion` guards against with its own control pass. So before believing a
// clean run, this asserts three things positively:
//
//   1. the console-error channel works, by emitting one and requiring it back;
//   2. the served HTML has real prerendered markup to hydrate *against*;
//   3. each route rendered a floor of elements, so a blank screen cannot pass.
//
// WHAT IT CANNOT PROMISE
// ----------------------
// One of #70's five mismatches is a race and this check catches it
// probabilistically. On `/` the shell bakes an empty Outlet, so whether the
// first client render disagrees with it depends on the route module resolving
// before React compares — measured against the #70 build, `en-US /` reported on
// roughly one run in three while the four pt-BR mismatches reported on every
// single one. Sampling twice per screen was tried and moved nothing: the
// variance is React's scheduling, not cache warmth.
//
// So read a green run as "the deterministic class is absent", not as proof that
// no mismatch can occur. That is still the useful guarantee, because the whole
// locale class — every pt-BR route, which is the locale the athlete uses — fails
// this check on every run the moment it comes back.
//
// USAGE
//   pnpm build && pnpm check:hydration
//   pnpm check:hydration --url=https://send-lab-git-<branch>-….vercel.app
//   pnpm check:hydration --routes=/,/train --locales=pt-BR --verbose
//   pnpm check:hydration --desktop        # the wide layout, 1280px
//   pnpm check:hydration --passes=seeded  # skip the recordless pass
//
// Not in `pnpm verify`, for the same reason `check:contrast` and `check:motion`
// are not: it needs Chrome and a completed build.
//
// WHAT IT MEASURES IT ON
// ----------------------
// Two states, on one pinned instant (#73): the seeded training record, and none
// at all, which is what a new athlete sees. A mismatch is the first client render
// disagreeing with the prerendered shell, so *what there is to render* is
// exactly the variable — a screen holding five weeks of sessions has more ways
// to disagree than the two headings the empty one draws. Before #73 the second
// of those was the only one measured.
import {
	discoverLocales,
	discoverRoutes,
	fail,
	open,
	parseArgs,
	type Session,
	viewport,
} from './browser.ts';
import { floorFor } from './floors.ts';
import {
	type BootState,
	EMPTY_BOOT,
	PINNED_NOW,
	PINNED_NOW_LOCAL,
	seededRecord,
} from './seeded-record.ts';

const args = parseArgs();
/** `--desktop` measures the wide layout (#52): a 1280px viewport *and* emulated
 *  `hover`/`pointer`, without which every `hover:` rule is inert. `--width` and
 *  `--height` still override. */
const { width: WIDTH, height: HEIGHT, desktop: DESKTOP } = viewport(args);
const VERBOSE = args.has('verbose');

/** Below this, the route did not render and a quiet console proves nothing.
 *
 *  The backstop the **empty** pass is held to. On the seeded pass each route
 *  carries its own floor (`scripts/floors.ts`), because one number for the whole
 *  app has to clear `/login` and therefore cleared a `/log` rendering thirteen
 *  elements where it should render a hundred and seventy. */
const MIN_ELEMENTS = Number(args.get('min-elements') ?? 8);

const ROUTES = (args.get('routes') ?? discoverRoutes().join(',')).split(',').filter(Boolean);
const LOCALES = (args.get('locales') ?? discoverLocales().join(',')).split(',').filter(Boolean);
/** Which of the two to measure. Both, unless asked otherwise. */
const PASSES = (args.get('passes') ?? 'seeded,empty').split(',').filter(Boolean);

/**
 * React's hydration family, matched on the error *number* rather than on prose.
 *
 * The production build emits `Minified React error #418; visit
 * https://react.dev/errors/418?args[]=…`, with no sentence in it — matching on
 * "hydration" alone would see none of them. The dev build spells it out instead,
 * so both shapes are matched and either one fails.
 *
 * 418 text/HTML content mismatch · 421 suspended while hydrating ·
 * 422/423 recovered by client render · 425 text content does not match.
 */
const HYDRATION = /react\.dev\/errors\/(418|421|422|423|425)\b|hydrat/i;

/** What the mismatch was, when React says: `?args[]=text&args[]=` → `text`. */
function argsOf(message: string): string {
	const seen = [...message.matchAll(/args\[\]=([^&\s]*)/g)]
		.map((m) => decodeURIComponent(m[1]))
		.filter(Boolean);
	return seen.length ? ` (${seen.join(', ')})` : '';
}

/** How many text-bearing elements actually rendered. The blank-screen floor. */
const RENDERED = String.raw`(() => {
  let n = 0;
  for (const el of document.querySelectorAll('body *')) {
    for (const node of el.childNodes) {
      if (node.nodeType === 3 && node.nodeValue.trim()) { n++; break; }
    }
  }
  return n;
})()`;

/** Wait out anything still animating, so a mismatch thrown during the first
 *  paint's transition is inside the window rather than after it. */
const SETTLE = `(async () => {
  await Promise.allSettled(document.getAnimations().map((a) => a.finished));
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  return true;
})()`;

interface Bad {
	screen: string;
	message: string;
}

// -------------------------------------------------------------------- run it

/** Everything one pass over the app reports back. */
interface Pass {
	bad: Bad[];
	other: Bad[];
	checked: number;
	/** Text elements per route, so the summary can show what each pass saw. */
	rendered: Map<string, number>;
}

/** One pass over every route in every locale, on one boot state. */
async function measure(session: Session, boot: BootState): Promise<Pass> {
	const { cdp, origin, evaluate, goto } = session;
	const out: Pass = { bad: [], other: [], checked: 0, rendered: new Map() };
	const seeded = boot.pass === 'seeded';

	// ---- control 1: the console channel reaches us at all.
	//
	// Per pass, not per run: each pass is its own Chrome, and a channel that
	// worked for the first one says nothing about the second.

	await goto(`${origin}/`);
	cdp.drain();
	await evaluate(`console.error('check:hydration probe')`);
	await new Promise((r) => setTimeout(r, 150));
	if (!cdp.drain().some((m) => m.includes('check:hydration probe'))) {
		fail(
			`${boot.pass}: the console-error probe did not come back.\n` +
				'  Nothing this check reports can be trusted: a page that logged a hydration\n' +
				'  error would look identical to a clean one. Check `Runtime.enable` and the\n' +
				'  `consoleAPICalled` handler in scripts/browser.ts.',
		);
	}

	// ---- the measurement.

	for (const locale of LOCALES) {
		await session.setLocale(locale);
		for (const route of ROUTES) {
			const screen = `${boot.pass} ${locale} ${route}`;

			cdp.drain();
			await goto(`${origin}${route}`);

			// The arrival control (#73). The empty app reports no mismatch on the rows
			// it never drew, so a page that booted without the record is a clean run.
			await session.assertBooted(screen);

			await evaluate(SETTLE);
			const logged = cdp.drain();
			const rendered = (await evaluate<number>(RENDERED)) ?? 0;

			// The route's own floor on the seeded pass, the global backstop on the
			// empty one — where a low count is the correct answer, and #61 owns what
			// it should look like.
			// Thrown rather than caught here: `fail` exits the process and skips the
			// `finally` that closes Chrome, and unwinding reaches the same message
			// through the one `fail` at the bottom of the file with the session shut
			// down on the way past.
			const floor = floorFor(route, seeded ? 'seeded' : 'empty', MIN_ELEMENTS, rendered);
			if (rendered < floor) {
				fail(
					`${screen}: only ${rendered} text element(s) rendered, expected at least ${floor}.\n` +
						'  A screen that never rendered cannot report a hydration mismatch, so a\n' +
						'  quiet console here means nothing.' +
						(logged.length ? `\n  The page also reported: ${logged[0].split('\n')[0]}` : '') +
						(seeded ? "\n  This route's floor is in scripts/floors.ts." : ''),
				);
			}

			out.checked++;
			out.rendered.set(
				route,
				Math.min(out.rendered.get(route) ?? Number.POSITIVE_INFINITY, rendered),
			);
			const seen = new Set<string>();
			for (const message of logged) {
				const key = message.split('\n')[0];
				if (seen.has(key)) continue;
				seen.add(key);
				(HYDRATION.test(message) ? out.bad : out.other).push({ screen, message });
			}
			if (VERBOSE) {
				console.log(
					`  ${screen} — ${rendered} text element(s), ` +
						`${logged.length} console error(s), ${out.bad.filter((b) => b.screen === screen).length} hydration`,
				);
			}
		}
	}
	return out;
}

console.log(
	`check:hydration — clock pinned to ${PINNED_NOW_LOCAL} local (${PINNED_NOW}), ` +
		`measuring [${PASSES.join(' ')}]`,
);

let exitCode = 0;
try {
	/** The boot states to measure, in order. Built inside the handler, so a throw
	 *  from the Vite load reports as this check's own failure line. */
	const boots: BootState[] = [];
	for (const pass of PASSES) {
		if (pass === 'seeded') {
			boots.push({ pass, now: PINNED_NOW, cells: await seededRecord(LOCALES) });
		} else if (pass === 'empty') boots.push(EMPTY_BOOT);
		else fail(`unknown pass '${pass}' — expected 'seeded' or 'empty'`);
	}

	const passes = new Map<string, Pass>();
	for (const boot of boots) {
		const session = await open({
			tool: 'check:hydration',
			width: WIDTH,
			height: HEIGHT,
			desktop: DESKTOP,
			// Explicit, and full motion on purpose: the reduced-motion build takes
			// different code paths through the shell, and this check is about the
			// default one the athlete gets.
			reducedMotion: false,
			boot,
			...(args.has('url') ? { url: args.get('url') as string } : {}),
		});
		try {
			// ---- control 2: there is prerendered markup to hydrate against.
			//
			// ADR 0006 makes the shell deliberately content-free below the app frame,
			// so this floor is about the *document*, not the app: if the server
			// started serving an empty `<div id="root">`, React would client-render
			// with nothing to compare and no mismatch is possible — green, and
			// meaningless. Asked of the origin rather than of the page, so it is
			// checked once per pass and never mistakes an installed record for markup.

			const html = await fetch(`${session.origin}/`).then((r) => r.text());
			const body = html.slice(html.indexOf('<body'));
			if (!/<[a-z]/i.test(body.replace(/<\/?(body|script|link|style)[^>]*>/gi, ''))) {
				fail(
					'the served HTML carries no prerendered markup below <body>.\n' +
						'  With nothing to hydrate against, a mismatch cannot happen and this check\n' +
						'  cannot fail. Either the build stopped prerendering `/_shell.html`, or\n' +
						`  ${session.origin} is not serving it.`,
				);
			}
			passes.set(boot.pass, await measure(session, boot));
		} finally {
			await session.close();
		}
	}

	const bad = [...passes.values()].flatMap((p) => p.bad);
	const other = [...passes.values()].flatMap((p) => p.other);
	const checked = [...passes.values()].reduce((n, p) => n + p.checked, 0);

	const scope =
		`${checked} pass/route/locale triple(s) [${PASSES.join(' ')}] × ` +
		`[${ROUTES.join(' ')}] × [${LOCALES.join(' ')}]`;

	if (other.length) {
		console.log('check:hydration — other page errors seen (not fatal here):');
		for (const o of other) console.log(`  ${o.screen}: ${o.message.split('\n')[0]}`);
		console.log('');
	}

	if (bad.length) {
		console.error(`\ncheck:hydration — ${bad.length} hydration mismatch(es) over ${scope}:\n`);
		for (const b of bad) {
			const code = /errors\/(\d+)/.exec(b.message)?.[1] ?? '?';
			console.error(`  ${b.screen} — React #${code}${argsOf(b.message)}`);
		}
		console.error(
			'\n  React recovers by discarding the client tree and re-rendering, so the page\n' +
				'  still looks right — this is the only place it shows. The cause is always\n' +
				'  the same shape: the first client render disagreed with the prerendered\n' +
				'  shell. Anything resolved from `localStorage` (the locale) or from a\n' +
				'  client-only route module must not reach that first render — defer it past\n' +
				'  hydration. See the comment in src/routes/__root.tsx.',
		);
		exitCode = 1;
	} else {
		console.log(`check:hydration — ok (no hydration mismatch over ${scope})`);
		for (const [pass, p] of passes) {
			console.log(`  ${pass}: ${[...p.rendered].map(([route, n]) => `${route} ${n}`).join(', ')}`);
		}
	}
} catch (e) {
	fail(e instanceof Error ? e.message : String(e));
}

process.exit(exitCode);
