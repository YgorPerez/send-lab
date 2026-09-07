// The Start type registration survives, in the file that actually ships.
//
// `src/routeTree.gen.ts` is generated, so it is the kind of file a reviewer skips
// and a test suite ignores — and that is exactly why the block at the bottom of
// it has now been lost twice. `tsr generate` strips it, `pnpm build` puts it back,
// and `pnpm verify` runs the stripping one. Nothing goes red: the block is a type
// augmentation, so `tsgo` is happy without it and the app builds and runs. The
// only symptom is that the router's type quietly stops reaching every
// `@tanstack/react-start` API.
//
// `scripts/restore-route-registration.ts` is the prevention — it runs as the
// second half of `pnpm routes`, which makes the stripped state unreachable. This
// is the enforcement: it asserts the committed file carries the registration, so
// a tree that lost it another way (a hand edit, a merge resolution that took the
// wrong side, a future tool) still fails.
//
// It asserts the *content* rather than byte equality with the restore script's
// literal. `pnpm build` is the source of truth for the block's exact shape, and a
// plugin that emitted a differently formatted but equivalent registration should
// pass here rather than fail on whitespace.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// `process.cwd()`, like `tests/desktop.test.ts`: under Vitest's transform
// `import.meta.url` is not a `file:` URL, so `fileURLToPath` throws on it.
const source = readFileSync(join(process.cwd(), 'src', 'routeTree.gen.ts'), 'utf8');

describe('the generated route tree', () => {
	it('registers the router with @tanstack/react-start', () => {
		expect(source).toContain("declare module '@tanstack/react-start'");
		// The two things the registration is for. Matched loosely on whitespace,
		// because the formatting is the generator's and not ours to pin.
		expect(source).toMatch(/interface\s+Register\s*\{/);
		expect(source).toMatch(/router:\s*Awaited<ReturnType<typeof getRouter>>/);
		expect(source).toMatch(/ssr:\s*true/);
	});

	it('imports the router type the registration refers to', () => {
		// Without this the augmentation names a type that is not in scope, which is
		// the one way it could be present and still do nothing.
		expect(source).toMatch(/import type \{ getRouter \} from '\.\/router\.tsx'/);
	});

	// The control. A test that only ever asserts presence would keep passing if it
	// stopped reading the right file — so prove the file it read is the route tree.
	it('read the real route tree', () => {
		expect(source).toContain('export const routeTree');
		expect(source).toContain('_addFileChildren(rootRouteChildren)');
	});
});
