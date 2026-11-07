// Whether the page on screen is the page a gate asked for.
//
// `goto` (`scripts/browser.ts`) used to wait only for the document to have lived
// `settleMs`. Any document old enough passed, wherever it was: one on a route
// other than the one asked for (the previous route, `about:blank`, a page that
// redirected) would be measured and reported as the route asked for (#113's
// review). So the document must also be at the URL asked for.
//
// Its own module because `browser.ts` cannot load under Vitest (see
// `scripts/routes.ts`), and the comparison is the part that needs a control.

/** The path with no trailing slash, except the root's: a router or a server
 *  that rewrites `/log` as `/log/` (or back) has not left the page. */
function pathOf(url: URL): string {
	return url.pathname.length > 1 ? url.pathname.replace(/\/+$/, '') : url.pathname;
}

/**
 * Whether `href` (the page's `location.href`) is the page `target` names: same
 * origin, same path up to a trailing slash, same query. The fragment is ignored;
 * it never changes the document.
 */
export function landedOn(target: string, href: string | undefined): boolean {
	if (!href) return false;
	let want: URL;
	let got: URL;
	try {
		want = new URL(target);
		got = new URL(href);
	} catch {
		return false;
	}
	return got.origin === want.origin && pathOf(got) === pathOf(want) && got.search === want.search;
}
