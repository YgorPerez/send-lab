// View Transition guards.
//
// `defaultViewTransition: true` is on for every navigation (issue #46). The
// router cannot animate Back per-link — `popstate` never reaches
// `commitLocation`, TanStack Router PR #7697 — and on a phone Back *is* a system
// gesture, so the choice was animate-everything or a hard cut. Animating
// everything brings three obligations with it; this module is where they live.
//
// Measured on the athlete's Android device (issue #54): view transitions leave a
// fixed bar alone, but flicker at the transitioning panel's corners. That is a
// known artefact, not something to design around.

/**
 * Whether the user agent has already run its own visual transition for this
 * navigation — Chrome on Android does this for the system back gesture. Running
 * ours on top double-animates and looks broken, so callers skip theirs.
 *
 * Read from the Navigation API's `NavigateEvent.hasUAVisualTransition`, which is
 * the only place the browser reports it. Absent on browsers without the
 * Navigation API, where the answer is trivially "no".
 */
let uaHandledCurrentNavigation = false;

export function hasUAVisualTransition(): boolean {
	return uaHandledCurrentNavigation;
}

interface NavigateEventLike extends Event {
	hasUAVisualTransition?: boolean;
}

interface NavigationLike extends EventTarget {
	addEventListener(type: 'navigate', listener: (e: NavigateEventLike) => void): void;
}

/**
 * Install the three runtime guards that `defaultViewTransition: true` requires.
 * Call once, from the root route, in the browser only.
 */
export function installViewTransitionGuards(): () => void {
	if (typeof window === 'undefined') return () => {};

	// 1. Track the UA's own transition, so a navigation it already animated does
	//    not get a second one on top.
	const navigation = (window as unknown as { navigation?: NavigationLike }).navigation;
	const onNavigate = (e: NavigateEventLike) => {
		uaHandledCurrentNavigation = e.hasUAVisualTransition === true;
	};
	navigation?.addEventListener('navigate', onNavigate);

	// 2. A skipped transition rejects, and an unhandled rejection is a real error
	//    in the console (and in any error reporter). Transitions skip *silently
	//    and legitimately* on app-switch, on the keyboard opening, and on a
	//    duplicate `view-transition-name` — see TanStack Router #7906. Swallow
	//    exactly those, and let every other rejection through untouched.
	const onRejection = (e: PromiseRejectionEvent) => {
		const reason = e.reason;
		const name = typeof reason === 'object' && reason !== null ? (reason as Error).name : '';
		if (name === 'AbortError' || name === 'InvalidStateError') e.preventDefault();
	};
	window.addEventListener('unhandledrejection', onRejection);

	// 3. `history.scrollRestoration = 'manual'` is never set — it regresses the
	//    edge swipe-back gesture (TanStack Router #7956). This asserts nothing
	//    else set it; the router's own scroll restoration does not need it.
	if (history.scrollRestoration === 'manual') {
		history.scrollRestoration = 'auto';
	}

	return () => {
		window.removeEventListener('unhandledrejection', onRejection);
	};
}

/**
 * A stable `view-transition-name` for one item in a list.
 *
 * The fourth obligation: lists must pair by element rather than by name, or a
 * reordered list morphs the wrong rows into each other. Pair with the
 * `view-transition-class` / `match-element` CSS in `app.css`, and key on a
 * stable id — never a display label, which changes with the locale (ADR 0003).
 */
export function listItemTransitionName(prefix: string, stableId: string): string {
	return `${prefix}-${stableId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}
