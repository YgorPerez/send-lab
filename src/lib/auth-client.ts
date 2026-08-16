import { createAuthClient } from 'better-auth/react';

/** The browser-side auth client. Same-origin, so no `baseURL` is needed — the
 *  app is client-only (ADR 0006) and talks to its own `/api/auth/*` routes. */
export const authClient = createAuthClient();

export const { signIn, signUp, signOut, useSession } = authClient;
