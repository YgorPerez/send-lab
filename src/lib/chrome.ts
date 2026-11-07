// What the shell takes from the matched route (#115).
//
// Two things about the chrome belong to a screen rather than to the app: whether
// the navigation is there at all (the intake has the screen to itself, spec
// story 72), and the one action the top strip may carry for the screen (story
// 11). A route says both in its `staticData`, and the shell reads them here.
//
// From the matched route and never from the viewport: the shell is baked into
// `/_shell.html` before any window exists (ADR 0006, ADR 0018). And only once the
// app has hydrated, which `__root.tsx` decides: the baked shell is the ordinary
// one, navigation and no action, whatever URL it is later served for.
import type { ComponentType } from 'react';
import type { AppLocale } from './store/locale';

/** A screen's one action in the top strip: an icon control, 44px, in the
 *  locale the strip renders in. */
export type ScreenAction = ComponentType<{ locale: AppLocale }>;

/** What a route may say about the chrome around it. */
export interface ChromeRouteData {
	/** `false` to render no navigation: the intake, a stepper that needs the
	 *  whole screen. */
	navigation?: false;
	/** The screen's one action, shown at the right of the top strip. */
	screenAction?: ScreenAction;
}

declare module '@tanstack/react-router' {
	interface StaticDataRouteOption extends ChromeRouteData {}
}

export interface Chrome {
	navigation: boolean;
	ScreenAction: ScreenAction | null;
}

/** The chrome the baked shell carries, before any route is known. */
export const BAKED_CHROME: Chrome = { navigation: true, ScreenAction: null };

/**
 * The chrome for a matched route, from the root down.
 *
 * Any match that opts out of the navigation hides it, so a layout route could
 * hide it for everything under it. The action is the deepest one named: the
 * screen the athlete is looking at outranks anything above it.
 */
export function chromeFor(matches: readonly { staticData?: ChromeRouteData }[]): Chrome {
	let ScreenAction: ScreenAction | null = null;
	let navigation = true;
	for (const { staticData } of matches) {
		if (staticData?.navigation === false) navigation = false;
		if (staticData?.screenAction) ScreenAction = staticData.screenAction;
	}
	return { navigation, ScreenAction };
}
