// Put back the Start type registration that `tsr generate` strips.
//
// THE TRAP
// --------
// `src/routeTree.gen.ts` ends with a `declare module '@tanstack/react-start'`
// block that registers the router's type and `ssr: true`. Two tools write that
// file and they disagree about it:
//
//   pnpm build   → the TanStack Start vite plugin regenerates it **with** the block
//   pnpm routes  → `tsr generate` regenerates it **without** the block
//
// `pnpm verify` runs `pnpm run check`, which runs `pnpm run routes`. So *verify
// strips it*, and a file committed after a green verify ships stripped. Nothing
// goes red on the way: the block is a type-level augmentation, so `tsgo` passes
// either way and the app builds and runs. What is lost is the router's type
// inside every `@tanstack/react-start` API — silently, and only until someone
// runs a build and sees the file come back dirty.
//
// It has cost two commits. `3a6f308` ("Restore the Start type registration the
// routes script strips") put it back by hand, and #63's first commit stripped it
// again the same way, by committing after a verify. Repairing it by hand a third
// time is the outcome this file exists to stop.
//
// WHY RESTORE RATHER THAN JUST CHECK
// ----------------------------------
// A check alone cannot work here: `verify` is the thing that strips the block, so
// a check running after it would fail every clean run. The generation step has to
// be idempotent instead — `tsr generate` then this — which makes the stripped
// state unreachable rather than merely detectable. `tests/routeRegistration.test.ts`
// is the belt to this file's braces: it asserts the committed file carries the
// registration, so a tree that got there another way still goes red.
//
// `pnpm build` remains the source of truth for what the block should say. If the
// Start plugin ever emits a different shape, the build wins and the literal below
// has to follow it — which is why the test asserts the *content* (a `Register`
// interface naming the router and `ssr`) rather than byte equality with this.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const FILE = fileURLToPath(new URL('../src/routeTree.gen.ts', import.meta.url));

/** What the Start plugin appends. `createStart` is imported and unused in the
 *  plugin's own output; kept identical so a build and this file agree byte for
 *  byte and the working tree does not flip between two spellings. */
const BLOCK = `
import type { getRouter } from './router.tsx'
import type { createStart } from '@tanstack/react-start'
declare module '@tanstack/react-start' {
  interface Register {
    ssr: true
    router: Awaited<ReturnType<typeof getRouter>>
  }
}
`;

/** The one line that has to be there. Matched on rather than the whole block, so
 *  a formatting difference is not mistaken for an absence. */
const MARKER = "declare module '@tanstack/react-start'";

const source = readFileSync(FILE, 'utf8');

if (source.includes(MARKER)) {
	console.log('routes:registration — ok (Start type registration present)');
	process.exit(0);
}

writeFileSync(FILE, `${source.trimEnd()}\n${BLOCK}`);
console.log('routes:registration — restored the Start type registration `tsr generate` stripped');
