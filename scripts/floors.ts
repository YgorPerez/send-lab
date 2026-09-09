// How much each route has to render before a measurement of it means anything.
//
// WHY ONE NUMBER FOR THE WHOLE APP WAS NOT ENOUGH
// -----------------------------------------------
// `check:contrast` and `check:hydration` each carried a single global minimum —
// three text elements and eight — and both comments were honest about what that
// was for: a backstop that rejects the router's error boundary, not a density
// assertion. One number for every route has to be low enough for the sparsest
// screen in the app, which makes it far too low for the densest: signed out,
// `/log` renders **13** text elements where the seeded record renders 170, and
// it cleared a floor of three without complaint. #52 hit exactly that and could
// not measure `/log`'s desktop height at all.
//
// So a route declares roughly what it renders **with a training record behind
// it**, and a route that comes in far under fails as unmeasured rather than
// passing as well-contrasted. The global minimum stays as the backstop for the
// empty pass, where a low number is the correct answer.
//
// WHERE THESE NUMBERS COME FROM
// -----------------------------
// Measured, not chosen — the repo's rule for any number it acts on. Each is the
// smallest count `check:contrast` reported for that route across both locales on
// the seeded record, taken down by about a quarter to a round number. That
// headroom is the point: these are not assertions about how many elements a
// screen has, which would go red on every copy edit. They are the line under
// which the screen is not that screen any more.
//
// Re-derive them the way they were derived, whenever a page changes shape — the
// summary line prints the per-route minimum for every pass it ran:
//
//   pnpm build && pnpm check:contrast
//
// The measurement does not move with the viewport, which is worth knowing before
// anyone runs it twice: the desktop layout (#52, ADR 0018) is expressed entirely
// as `lg:` utilities on the elements that already exist, so `--desktop` reports
// the same counts as the phone. If that ever stops being true, a second pane
// rendering *fewer* elements is the interesting direction and these floors are
// where it shows.
//
// WHY THE SAME TABLE SERVES BOTH CHECKS
// -------------------------------------
// The two probes count almost the same thing, and they are not equally strict:
// `check:contrast` keeps only elements that own a non-empty text node, are
// visible, have a non-zero box and sit outside `aria-hidden`, while
// `check:hydration` keeps any element with a non-empty text child. So
// hydration's count is always at or above contrast's. Calibrating on the stricter
// of the two makes one table safe for both, and a second table would be a second
// thing to keep in step for no gain.
//
// A ROUTE WITH NO ENTRY IS A FAILURE, NOT A SKIP
// ----------------------------------------------
// The rule `ROUTE_PARAMS` follows in `scripts/routes.ts`, for the same reason: a
// new page that quietly inherits "no floor" is a page whose emptiness nothing
// would report, and that is the defect this file exists to close. So an unfloored
// route throws, and the message carries the number the gate just measured, which
// is the number to write down.

/** What one route is held to, and whether the training record is visible on it. */
export interface RouteFloor {
	/** Least text elements it renders with a training record behind it. */
	floor: number;
	/**
	 * Whether seeding the record makes this screen render *more*.
	 *
	 * The cross-pass control: on a route that reads the record, measuring the same
	 * count with and without one means the rows were installed where the app never
	 * looked, which passes every other check a gate makes. It is declared per
	 * route rather than inferred from the floor, because three of the seven
	 * screens legitimately do not move:
	 *
	 *   `/login`     gates its body on a session that cannot resolve in a gate, so
	 *                what renders is the chrome and a placeholder either way — and
	 *                it is the one screen whose interesting state is signed *out*.
	 *   `/settings`  the preferences half reads defaults that exist with no record;
	 *                the account panels gate on a session, as on `/login`.
	 *   `/week`      the seven slots resolve from the program, and the built-in
	 *                program is there before any history is.
	 *   `/welcome`   renders one element *fewer* seeded, not more: the baseline is
	 *                already answered. That difference is real, and nothing reads
	 *                it — a "renders more" control cannot, and a one-element floor
	 *                either side of 22 would be an assertion about a copy edit. So
	 *                the record arriving is unchecked on this route, not floored
	 *                in the other direction.
	 */
	readsRecord: boolean;
}

/**
 * The floor per route, with the seeded record behind it.
 *
 * Every route the app has, deliberately — including the ones that are sparse by
 * design, because "sparse" is a claim worth writing down rather than a gap.
 *
 *   `/`          Today: the verdict, the plan, the held work, the watch-outs, the
 *                open readiness check, the counters, the trend and the
 *                carry-forward. 154 seeded, 99 empty.
 *   `/log`       five weeks of sessions and fourteen readiness checks. 170
 *                seeded, 13 empty — the screen #73 was written about.
 *   `/login`     the sign-in form. 10 either way.
 *   `/settings`  the preferences that work offline. 19 either way.
 *   `/train`     the slot: the set grid, the prescriptions and the timer. 201
 *                seeded, 176 empty — the grid is prescribed from the program
 *                before any of it has been trained.
 *   `/week`      seven slots and the microcycle's own reading. 30 either way.
 *   `/welcome`   the baseline questionnaire, one question at a time. 22 seeded,
 *                23 empty.
 */
export const SEEDED_FLOORS: Record<string, RouteFloor> = {
	'/': { floor: 110, readsRecord: true },
	'/log': { floor: 125, readsRecord: true },
	'/login': { floor: 6, readsRecord: false },
	'/settings': { floor: 12, readsRecord: false },
	'/train': { floor: 140, readsRecord: true },
	'/week': { floor: 20, readsRecord: false },
	'/welcome': { floor: 15, readsRecord: false },
};

/**
 * The floor for one route on one pass.
 *
 * `backstop` is the check's own global minimum, which is what the empty pass is
 * held to: with no training record a low count is correct, and #73 explicitly did
 * not decide what an empty screen should show (that is #61's).
 *
 * `measured` is only for the error message — it is what the caller just read, so
 * an unfloored route reports the number to write into the table rather than
 * asking whoever hit it to go and measure it again.
 */
export function floorFor(
	route: string,
	pass: 'seeded' | 'empty',
	backstop: number,
	measured?: number,
): number {
	if (pass === 'empty') return backstop;
	return Math.max(declaredFloor(route, measured).floor, backstop);
}

/** Whether seeding should make this route render more. See `readsRecord`. */
export function readsRecord(route: string): boolean {
	return declaredFloor(route).readsRecord;
}

function declaredFloor(route: string, measured?: number): RouteFloor {
	const declared = SEEDED_FLOORS[route];
	if (declared === undefined) {
		throw new Error(
			`route '${route}' has no floor in scripts/floors.ts — it measured ${measured ?? 'nothing'} ` +
				'text element(s) with the seeded record behind it. Add an entry with room under that number, ' +
				'or a page that renders nothing is a page this gate reports as fine.',
		);
	}
	return declared;
}
