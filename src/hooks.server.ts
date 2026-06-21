import type { Handle } from '@sveltejs/kit';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { building } from '$app/environment';
import { auth } from '$lib/server/auth';

export const handle: Handle = async ({ event, resolve }) => {
	// Resolve the session once so server endpoints can read event.locals.
	const session = await auth.api.getSession({ headers: event.request.headers });
	event.locals.session = session?.session ?? null;
	event.locals.user = session?.user ?? null;

	// Routes /api/auth/* to the better-auth handler; everything else falls through.
	return svelteKitHandler({ event, resolve, auth, building });
};
