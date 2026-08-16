// Typed, validated server environment.
//
// SvelteKit gave us `$env/static/private`, which failed the build on a missing
// variable. TanStack Start has no equivalent, and a dynamic `import.meta.env`
// lookup silently escapes inlining rather than failing — so nothing catches a
// misconfiguration for us any more. This module is that check, and
// `pnpm check:env` runs `.env.example` through it so a renamed or dropped
// variable fails the gate rather than production.
import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const env = createEnv({
	server: {
		// Without a stable secret, better-auth signs session tokens with a generated
		// one that differs per serverless instance / cold start — so every return
		// visit fails validation and bounces to /login. Required to serve requests
		// in production; optional in dev, where a generated secret is harmless.
		BETTER_AUTH_SECRET: z.string().min(1).optional(),
		// The trusted origin for auth cookies. Must match the real origin.
		BETTER_AUTH_URL: z.url().optional(),
		// Turso (libSQL). Both unset locally → `file:local.db`.
		TURSO_DATABASE_URL: z.string().optional(),
		TURSO_AUTH_TOKEN: z.string().optional(),
	},
	runtimeEnv: process.env,
	emptyStringAsUndefined: true,
});

/** True in `vite dev` / `vitest`, false in a production build. */
export const dev = process.env.NODE_ENV !== 'production';

let asserted = false;

/**
 * Fail loudly if production is missing a secret it cannot work without.
 *
 * Called when a request is *served*, never at module load. The distinction is
 * load-bearing: `vite build` prerenders `/_shell.html` by fetching `/` from the
 * built server bundle, which imports the whole route tree — so a module-level
 * throw here makes the shell unbuildable on any machine without production
 * secrets, including CI and a Vercel preview. The shell is user-independent by
 * construction (ADR 0006) and must never need a credential to render.
 *
 * Memoised, since every authenticated request passes through it.
 */
export function assertRuntimeEnv(): void {
	if (asserted || dev) return;
	if (!env.BETTER_AUTH_SECRET) {
		throw new Error('BETTER_AUTH_SECRET must be set in production');
	}
	asserted = true;
}
