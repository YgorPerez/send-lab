// Which URLs the measuring gates visit.
//
// The routes to walk, derived from the route tree rather than listed anywhere — a
// page added without a line in a script would otherwise be a page nobody ever
// measures.
//
// WHY IT READS THE GENERATED FILE
// -------------------------------
// This used to map a filename to a URL by stripping `.tsx` and prefixing `/`,
// which is correct only for flat, single-segment route files (#86). TanStack
// treats a dot as a path separator, so `week.$id.tsx` is `/week/$id` and became
// `/week.$id`; and directories were skipped outright, so `week/$id.tsx` was
// invisible to every gate.
//
// The damage is that **nothing goes red**. The harness navigates to a URL that is
// not a route, the router serves the fallback, the fallback renders the chrome,
// and the page measures clean — so the check reports a pass and counts the route
// in its total. Observed on #60, where `prototype.week.tsx` became
// `/prototype.week` and `check:contrast` measured a non-route as one of seven.
// `check:overflow`'s `MIN_ELEMENTS` floor does not catch it either: that floor
// fails a page which renders nothing, and this page renders the shell.
//
// So the grammar is not re-implemented here. `src/routeTree.gen.ts` already holds
// the router's own resolved answer, and re-deriving it from filenames is how the
// two drift apart. It is *read*, never imported — it is a generated file rewritten
// by two tools that disagree, which is why `scripts/restore-route-registration.ts`
// exists.
//
// WHAT STOPS IT GOING STALE
// -------------------------
// Reading a generated file buys faithfulness and owes freshness: a route file
// added without `pnpm routes` would be missing from the tree and silently
// unmeasured, which is this same bug wearing a different hat. So the two sources
// check each other — the generated tree supplies the paths, the filesystem
// supplies the list of files that must appear in it, and a file the tree has never
// heard of is a failure rather than a skip.
//
// WHY IT IS ITS OWN MODULE
// ------------------------
// It was in `scripts/browser.ts`, which reaches a Chrome binary and a static
// server and cannot be imported under Vitest at all (`scripts/output-dir.ts`
// resolves `import.meta.url` at module load, and Vitest's transform does not give
// it a `file:` URL). None of that is needed to turn two lists of strings into a
// third. Splitting it is what lets `tests/routeDiscovery.test.ts` assert the
// failures below rather than describe them — and this is a silent bug class, so a
// fix nothing can prove is the same risk again.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Values for the dynamic segments of parameterised routes.
 *
 * Keyed by the route's resolved path, as the tree spells it, then by the param
 * name without its `$`. A `$id` cannot be visited literally and there is nothing
 * in the tree that says what a real one looks like, so it is declared here or the
 * route fails loudly — guessing is what produced #86, and a silent skip is the
 * same defect one layer down.
 *
 * Empty because every route the app has today is static. The first `$` route adds
 * its line, and finds out immediately if it does not.
 */
export const ROUTE_PARAMS: Record<string, Record<string, string>> = {};

/**
 * Every route source file under `src/routes`, relative and extensionless
 * (`week`, `week.$id`, `week/$id`) — the spelling the generated tree imports them
 * by.
 *
 * `api/` is server routes with nothing to render, `__root` is the shell, and
 * `-`-prefixed files are TanStack's convention for a file that is not a route.
 */
export function routeSourceFiles(dir: string, prefix = ''): string[] {
	if (!existsSync(dir)) return [];
	const out: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const name = entry.name;
		if (name.startsWith('__') || name.startsWith('-') || name === 'api') continue;
		if (entry.isDirectory()) {
			out.push(...routeSourceFiles(join(dir, name), `${prefix}${name}/`));
		} else if (name.endsWith('.tsx')) {
			out.push(`${prefix}${name.replace(/\.tsx$/, '')}`);
		}
	}
	return out;
}

/**
 * The measurable routes, given the generated tree's source and the files on disk.
 *
 * Pure, and throws rather than exiting, so every failure it can produce is
 * assertable. `discoverRoutes` is the half that touches the filesystem.
 */
export function resolveRoutes(generated: string, files: string[]): string[] {
	// The `fullPaths` union is the router's resolved answer, after dots, nesting
	// and layouts have all been applied.
	const block = /fullPaths:\s*((?:\s*\|\s*'[^']*')+)/.exec(generated);
	if (!block) throw new Error('src/routeTree.gen.ts has no `fullPaths` union — run `pnpm routes`');
	const paths = [...block[1].matchAll(/'([^']*)'/g)].map((m) => m[1]);

	// Every route file has to appear in the tree, or the tree is stale and the
	// gates would measure a subset of the app while reporting a pass.
	const imported = new Set([...generated.matchAll(/from '\.\/routes\/([^']+)'/g)].map((m) => m[1]));
	const missing = files.filter((f) => !imported.has(f));
	if (missing.length) {
		throw new Error(
			`src/routeTree.gen.ts does not know about ${missing
				.map((f) => `src/routes/${f}.tsx`)
				.join(', ')} — run \`pnpm routes\``,
		);
	}

	const out: string[] = [];
	for (const path of paths) {
		// Server routes: nothing renders, so there is nothing to measure. Checked
		// before the dynamic segments below, because `/api/auth/$` has one.
		if (path === '/api' || path.startsWith('/api/')) continue;

		const segments = path.split('/');
		if (!segments.some((seg) => seg.startsWith('$'))) {
			out.push(path);
			continue;
		}
		const params = ROUTE_PARAMS[path];
		const visited: string[] = [];
		for (const seg of segments) {
			// A bare `$` is the splat segment; anything after it is the param name.
			const value = seg.startsWith('$') ? params?.[seg.slice(1) || '$'] : seg;
			if (value === undefined) {
				throw new Error(
					`route '${path}' has a dynamic segment and no entry in ROUTE_PARAMS (scripts/routes.ts) — add one, or the gates measure a URL that is not this route`,
				);
			}
			visited.push(value);
		}
		out.push(visited.join('/'));
	}
	return out.sort();
}

/** The routes to visit, read out of the repo at `root`. Throws on a stale tree or
 *  an undeclared dynamic segment; `scripts/browser.ts` turns that into a `fail`. */
export function discoverRoutesIn(root: string): string[] {
	const generated = join(root, 'src', 'routeTree.gen.ts');
	if (!existsSync(generated)) return ['/'];
	const routes = resolveRoutes(
		readFileSync(generated, 'utf8'),
		routeSourceFiles(join(root, 'src', 'routes')),
	);
	return routes.length ? routes : ['/'];
}
