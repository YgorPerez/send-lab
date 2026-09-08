// The gates visit the routes the app actually has.
//
// `discoverRoutes` is the route list all four browser checks walk, and #86 was
// the discovery that it could hand them a URL that is not a route at all — and
// that nothing would say so. The harness navigates, the router serves the
// fallback, the fallback renders the shell, and the page measures clean: a pass,
// counted in the total, for a page never visited.
//
// That is why this file exists at all. A gate that can be green for the wrong
// reason needs its own gate, and `resolveRoutes` is pure over
// `(generated tree, files on disk)` precisely so the four failures below can be
// *asserted* rather than described in a comment.
//
// It runs in `pnpm verify` despite testing a browser script, because nothing here
// needs a browser: it is string handling over two lists.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveRoutes, routeSourceFiles } from '../scripts/routes.ts';

/** The shape of `src/routeTree.gen.ts` that matters here: the `fullPaths` union
 *  the router resolved, and the imports naming the files it resolved them from. */
function tree(entries: { file: string; path: string }[]): string {
	const imports = entries.map((e) => `import { Route as X } from './routes/${e.file}'`).join('\n');
	const union = entries.map((e) => `    | '${e.path}'`).join('\n');
	return `${imports}\n\nexport interface FileRouteTypes {\n  fullPaths:\n${union}\n  fileRoutesByTo: FileRoutesByTo\n}\n`;
}

describe('resolveRoutes', () => {
	// The bug, in one line. TanStack reads a dot as a path separator; the old
	// implementation stripped `.tsx` and prefixed `/`, so this route was measured
	// at `/week.$id` — which is not a route, and which rendered the fallback.
	it('reads a dotted route file as the nested path it is', () => {
		const generated = tree([{ file: 'week.detail', path: '/week/detail' }]);
		expect(resolveRoutes(generated, ['week.detail'])).toEqual(['/week/detail']);
	});

	// The other half of #86: the old implementation had `if (isDirectory()) continue`
	// and no recursion, so a route in a folder was not merely mis-addressed, it was
	// never in the list.
	it('finds a route nested in a directory', () => {
		const generated = tree([
			{ file: 'index', path: '/' },
			{ file: 'week/detail', path: '/week/detail' },
		]);
		expect(resolveRoutes(generated, ['index', 'week/detail'])).toEqual(['/', '/week/detail']);
	});

	// Reading a generated file buys faithfulness and owes freshness. Without this,
	// a route added without `pnpm routes` is simply absent from the tree — and an
	// absent route measures nothing while the gate reports a pass, which is #86
	// again in a different disguise.
	it('refuses a tree that has not seen a route file', () => {
		const generated = tree([{ file: 'index', path: '/' }]);
		expect(() => resolveRoutes(generated, ['index', 'week'])).toThrow(/src\/routes\/week\.tsx/);
		expect(() => resolveRoutes(generated, ['index', 'week'])).toThrow(/pnpm routes/);
	});

	// A `$id` cannot be visited literally and the tree does not say what a real one
	// looks like. The choice is between a declared value and a loud failure; a
	// silent skip would leave the route unmeasured, which is the defect this whole
	// file is about.
	it('refuses a dynamic route it has no value for', () => {
		const generated = tree([{ file: 'week.$id', path: '/week/$id' }]);
		expect(() => resolveRoutes(generated, ['week.$id'])).toThrow(/ROUTE_PARAMS/);
	});

	// Server routes render nothing, so there is nothing for a measuring gate to
	// look at. `/api/auth/$` also means the dynamic check must not fire on them.
	it('leaves the server routes alone', () => {
		const generated = tree([
			{ file: 'index', path: '/' },
			{ file: 'api/state', path: '/api/state' },
			{ file: 'api/auth/$', path: '/api/auth/$' },
		]);
		expect(resolveRoutes(generated, ['index'])).toEqual(['/']);
	});

	// Written expecting `[]` and corrected by the run: a tree with no `fullPaths`
	// union is not an app with no routes, it is a tree the generator never wrote.
	// Returning an empty list there would hand every gate nothing to visit and let
	// all four pass in silence, which is the failure mode this file is named after.
	it('refuses a tree with no fullPaths union at all', () => {
		expect(() => resolveRoutes(tree([]), [])).toThrow(/pnpm routes/);
	});
});

describe('the routes this app actually has', () => {
	// The integration end, and the reason the unit tests above are not enough: they
	// prove the resolver handles a tree, not that it is pointed at the real one.
	it('resolves every route file in the repo', () => {
		const generated = readFileSync(join(process.cwd(), 'src', 'routeTree.gen.ts'), 'utf8');
		const files = routeSourceFiles(join(process.cwd(), 'src', 'routes'));

		expect(files, 'no route files found — the walk is looking in the wrong place').not.toHaveLength(
			0,
		);
		const routes = resolveRoutes(generated, files);

		// Every screen the athlete can reach. If a page is added and this list is
		// not, the gates were never measuring it.
		expect(routes).toEqual(['/', '/log', '/login', '/settings', '/train', '/week', '/welcome']);
		// One route per non-server file, which is what makes the count above a real
		// assertion rather than a snapshot that drifts.
		expect(routes).toHaveLength(files.length);
	});

	it('skips the shell and the server routes when walking the tree', () => {
		const files = routeSourceFiles(join(process.cwd(), 'src', 'routes'));
		expect(files).not.toContain('__root');
		expect(files.some((f) => f.startsWith('api/'))).toBe(false);
	});
});
