// The `$lib` alias, declared once.
//
// Vite does not read tsconfig `paths`, so the alias every domain module is
// written against has to be handed to each tool that resolves modules — and
// there are three of those now: the app build (`vite.config.ts`), the unit suite
// (`vitest.config.ts`, which cannot load the app config because the TanStack
// Start plugin has no place in a jsdom run), and the measuring gates' own module
// loader (`scripts/seeded-record.ts`, which builds a training record in Node).
//
// The first two carried a copy each, and a comment on both saying "keep them in
// step". A third copy is where that stops being a convention: two of the three
// would keep working after `src/lib` moved, and the one that broke would break
// as a module-not-found inside a gate rather than as anything legible.
//
// WHY IT IS A FUNCTION
// --------------------
// It resolves `import.meta.url`, and Vitest's transform does not hand that over
// as a `file:` URL — so at module scope this would throw on import from any
// test, including the tests of the gate modules that import it. A function is
// only unusable where it is actually called, which is the Vite server in
// `seeded-record.ts` and the two configs.
import { fileURLToPath } from 'node:url';

/** Where `$lib/*` resolves to. Absolute, because a Vite server started from a
 *  script does not share the app config's root. */
export function libAlias(): { $lib: string } {
	return { $lib: fileURLToPath(new URL('../src/lib', import.meta.url)) };
}
