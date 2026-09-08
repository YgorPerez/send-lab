// Gate step: with `prefers-reduced-motion: reduce`, nothing in this app outlives
// a frame — including across a real navigation.
//
// WHY THIS EXISTS
// ---------------
// Three mechanisms animate the app and only one of them is reached by the rule
// everybody writes (see the MOTION block in `src/app.css`). The dangerous one is
// the view-transition pseudo-elements: they are generated on the root, `*` never
// matches them, the spec does not apply `prefers-reduced-motion` to them at all
// (csswg #10267, open), and this app animates *every* navigation. A stylesheet
// that looks compliant and is not is exactly what the animation research (#45)
// found already shipped here once. `tests/motion.test.ts` guards that the rules
// exist; only a browser can say whether they bite.
//
// THE CONTROL RUN IS THE POINT
// ----------------------------
// A check that asserts "nothing animates" passes trivially on an app where
// nothing animates, on a browser that does not support view transitions, or on a
// harness that failed to emulate the media feature. So it runs twice: once with
// motion allowed, asserting the navigation *does* animate and naming what it
// saw, and once reduced, asserting none of it survives. The first run is what
// makes the second one mean something — the contrast checker's first version
// reported "ok" over a screen that had crashed, and this is the same class of
// mistake caught in advance.
//
// WHAT "REDUCED" MEANS HERE: every animation and transition finishes inside one
// frame. Not "movement removed, cross-fades kept" — see `src/app.css` for why
// that tempting version was rejected.
//
// USAGE
//   pnpm build && pnpm check:motion
//   pnpm check:motion --url=https://send-lab-git-<branch>-….vercel.app
//   pnpm check:motion --routes=/,/train --verbose
//   pnpm check:motion --desktop           # the wide layout, 1280px
//
// Not in `pnpm verify`, for the same reason `check:contrast` is not: it needs
// Chrome and a completed build.
import { discoverRoutes, fail, open, parseArgs, type Session, viewport } from './browser.ts';

const args = parseArgs();
/** `--desktop` measures the wide layout (#52): a 1280px viewport *and* emulated
 *  `hover`/`pointer`, without which every `hover:` rule is inert. `--width` and
 *  `--height` still override. */
const { width: WIDTH, height: HEIGHT, desktop: DESKTOP } = viewport(args);
const VERBOSE = args.has('verbose');

/** One frame at 60Hz, rounded up. Anything at or under this is a hard cut. */
const FRAME_MS = Number(args.get('frame-ms') ?? 20);

const ROUTES = (args.get('routes') ?? discoverRoutes().join(',')).split(',').filter(Boolean);

interface Timed {
	/** `animation`, `transition`, or the view-transition pseudo-element. */
	kind: string;
	what: string;
	where: string;
	ms: number;
}

/**
 * Every non-instant transition and animation currently declared on the page.
 *
 * Computed styles rather than the class list: this is what the cascade actually
 * resolved to, which is the only thing that answers "did the reduced-motion rule
 * win". A `!important` in a media query that never matched looks identical in a
 * diff and different here.
 */
const DECLARED = String.raw`(() => {
  const ms = (v) => v.split(',').map((s) => {
    const t = s.trim();
    if (t.endsWith('ms')) return parseFloat(t);
    if (t.endsWith('s')) return parseFloat(t) * 1000;
    return 0;
  });
  const where = (el) => {
    const cls = (el.className?.baseVal ?? el.className ?? '').toString().trim().split(/\s+/).slice(0, 4).join(' ');
    return el.tagName.toLowerCase() + (cls ? '.' + cls.replace(/\s+/g, '.') : '');
  };
  const out = [];
  for (const el of document.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    const td = ms(cs.transitionDuration);
    const tdel = ms(cs.transitionDelay);
    cs.transitionProperty.split(',').forEach((prop, i) => {
      const total = (td[i] ?? td[0] ?? 0) + Math.max(0, tdel[i] ?? tdel[0] ?? 0);
      if (total > 0 && prop.trim() !== 'none') {
        out.push({ kind: 'transition', what: prop.trim(), where: where(el), ms: total });
      }
    });
    const ad = ms(cs.animationDuration);
    const adel = ms(cs.animationDelay);
    cs.animationName.split(',').forEach((name, i) => {
      const total = (ad[i] ?? ad[0] ?? 0) + Math.max(0, adel[i] ?? adel[0] ?? 0);
      if (total > 0 && name.trim() !== 'none') {
        out.push({ kind: 'animation', what: name.trim(), where: where(el), ms: total });
      }
    });
  }
  return out;
})()`;

/**
 * Watch what actually runs across the next navigation, view-transition
 * pseudo-elements included.
 *
 * `document.getAnimations()` is sampled on a short interval rather than read
 * once: a view transition exists for about 200ms and is gone by the time a
 * single post-navigation read happens. The pseudo-elements never appear in
 * `querySelectorAll`, so this is the only way to see them at all.
 */
const WATCH = `(() => {
  window.__motion = [];
  const seen = new Set();
  const sample = () => {
    for (const a of document.getAnimations()) {
      const timing = a.effect && a.effect.getComputedTiming ? a.effect.getComputedTiming() : {};
      const total = (Number(timing.duration) || 0) + Math.max(0, Number(timing.delay) || 0);
      const target = a.effect && a.effect.target;
      const pseudo = (a.effect && a.effect.pseudoElement) || '';
      const what = a.animationName || a.transitionProperty || 'animation';
      const where = pseudo || (target ? target.tagName.toLowerCase() : 'document');
      const key = what + '|' + where + '|' + total;
      if (seen.has(key)) continue;
      seen.add(key);
      window.__motion.push({
        kind: pseudo ? 'view-transition' : a.transitionProperty ? 'transition' : 'animation',
        what, where, ms: total,
      });
    }
  };
  sample();
  window.__motionTimer = setInterval(sample, 16);
  return true;
})()`;

const STOP_WATCHING = `(() => {
  clearInterval(window.__motionTimer);
  return window.__motion ?? [];
})()`;

/**
 * Open the menu, which is where the navigation lives.
 *
 * It used to be a tab bar rendered on every page, so a link was in the DOM to
 * click. The menu's rows are inside a closed popover and do not exist until the
 * trigger is pressed, so reaching a destination is now two steps rather than one.
 */
const OPEN_MENU = `(() => {
  const trigger = [...document.querySelectorAll('header button')]
    .find((b) => /menu/i.test(b.getAttribute('aria-label') ?? ''));
  if (!trigger) return false;
  trigger.click();
  return true;
})()`;

/** Follow the menu's link to `href`, which is what triggers a view transition. */
const navigateTo = (href: string) =>
	`(() => {
    const link = document.querySelector('nav a[href=${JSON.stringify(href)}]');
    if (!link) return false;
    link.click();
    return true;
  })()`;

/** One pass over the app, reporting everything that was allowed to move. */
async function observe(session: Session): Promise<{ declared: Timed[]; ran: Timed[] }> {
	const declared: Timed[] = [];
	for (const route of ROUTES) {
		await session.goto(`${session.origin}${route}`);
		const rows = await session.evaluate<Timed[]>(DECLARED);
		if (!rows) fail(`${route}: the declared-motion probe returned nothing`);
		for (const row of rows) declared.push({ ...row, where: `${route} ${row.where}` });
	}

	// The navigation that produces a view transition. `/` → `/train` is the one
	// the athlete makes most and the one the `screen` crossfade is written for.
	await session.goto(`${session.origin}/`);

	// Two steps, because the navigation is behind a menu now. Opening it is not
	// watched: the popover's own open animation is not the transition this is
	// measuring, and starting the watch before it would time the wrong thing.
	const opened = await session.evaluate<boolean>(OPEN_MENU);
	if (!opened) {
		fail(
			'could not find the menu trigger in the top strip.\n' +
				'  The navigation lives in the menu since the tab bar was removed, so this\n' +
				'  check has to open it before it can follow a link. If the trigger moved or\n' +
				'  lost its `aria-label`, update the selector here.',
		);
	}
	await new Promise((r) => setTimeout(r, 300));

	await session.evaluate(WATCH);
	const navigated = await session.evaluate<boolean>(navigateTo('/train'));
	if (!navigated) {
		fail(
			'could not find the /train link to navigate with.\n' +
				'  This check needs a real client-side navigation — that is the only way a\n' +
				'  view transition happens, and view transitions are the mechanism it exists\n' +
				'  to measure. The menu opened but did not contain the link.',
		);
	}
	await new Promise((r) => setTimeout(r, 900));
	const ran = (await session.evaluate<Timed[]>(STOP_WATCHING)) ?? [];
	return { declared, ran };
}

const report = (rows: Timed[]) => {
	const byKey = new Map<string, Timed & { count: number }>();
	for (const row of rows) {
		const key = `${row.kind}|${row.what}|${row.ms}`;
		const e = byKey.get(key) ?? { ...row, count: 0 };
		e.count++;
		byKey.set(key, e);
	}
	return [...byKey.values()].sort((a, b) => b.ms - a.ms);
};

let exitCode = 0;

// ---- pass 1: motion allowed. Proves the harness can see motion at all.

const allowed = await open({
	tool: 'check:motion',
	width: WIDTH,
	height: HEIGHT,
	desktop: DESKTOP,
	...(args.has('url') ? { url: args.get('url') as string } : {}),
});
let control: { declared: Timed[]; ran: Timed[] };
try {
	const reduced = await allowed.evaluate<boolean>(
		`matchMedia('(prefers-reduced-motion: reduce)').matches`,
	);
	if (reduced) {
		fail(
			'the control run already reports reduced motion.\n' +
				'  Chrome is honouring a system setting, so the two passes cannot be told\n' +
				'  apart and a green result would mean nothing.',
		);
	}
	control = await observe(allowed);
} finally {
	await allowed.close();
}

const transitions = control.ran.filter((r) => r.kind === 'view-transition' && r.ms > FRAME_MS);
if (!transitions.length) {
	fail(
		'the control run saw no view transition over a real navigation.\n' +
			`  Observed with motion allowed: ${control.ran.length} animation(s), ` +
			`${control.declared.filter((d) => d.ms > FRAME_MS).length} declared transition(s).\n` +
			'  Either this Chrome does not run view transitions, or the router stopped\n' +
			'  producing them. Until this passes, the reduced-motion result below proves\n' +
			'  nothing — which is exactly how a motion check ships green and useless.',
	);
}

// ---- pass 2: reduced. Nothing may outlive a frame.

const quiet = await open({
	tool: 'check:motion',
	width: WIDTH,
	height: HEIGHT,
	desktop: DESKTOP,
	reducedMotion: true,
	...(args.has('url') ? { url: args.get('url') as string } : {}),
});
let observed: { declared: Timed[]; ran: Timed[] };
try {
	const reduced = await quiet.evaluate<boolean>(
		`matchMedia('(prefers-reduced-motion: reduce)').matches`,
	);
	if (!reduced) {
		fail(
			'the reduced-motion pass is not actually reduced — the page reports\n' +
				'  `prefers-reduced-motion: reduce` does not match. The emulation did not\n' +
				'  take, and everything below would pass for the wrong reason.',
		);
	}
	observed = await observe(quiet);
} finally {
	await quiet.close();
}

const survivors = [...observed.declared, ...observed.ran].filter((r) => r.ms > FRAME_MS);

console.log(
	`check:motion — control: ${transitions.length} view-transition animation(s) over a real ` +
		`navigation, longest ${Math.max(...transitions.map((t) => t.ms))}ms`,
);
if (VERBOSE) {
	for (const row of report(control.ran)) {
		console.log(`    ${row.ms.toFixed(0)}ms  ${row.kind}  ${row.what}  ${row.where} ×${row.count}`);
	}
}

if (survivors.length) {
	console.error(
		`\ncheck:motion — ${survivors.length} thing(s) still move under ` +
			`prefers-reduced-motion, over ${FRAME_MS}ms:\n`,
	);
	for (const row of report(survivors)) {
		console.error(`  ${row.ms.toFixed(0)}ms  ${row.kind}  ${row.what}`);
		console.error(`      ${row.where} ×${row.count}`);
	}
	console.error(
		'\n  A `*` rule does not reach the view-transition pseudo-elements — they are\n' +
			'  generated on the root. A CSS rule does not reach a WAAPI animation at all;\n' +
			'  if the survivor is Motion, it needs `<MotionConfig reducedMotion="user">`.\n' +
			'  See the MOTION block in src/app.css.',
	);
	exitCode = 1;
} else {
	console.log(
		`check:motion — ok (nothing over ${FRAME_MS}ms under prefers-reduced-motion, across ` +
			`${ROUTES.length} route(s) [${ROUTES.join(' ')}] and one real navigation)`,
	);
}

process.exit(exitCode);
