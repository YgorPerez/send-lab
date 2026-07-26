import { type Handle, json, text } from '@sveltejs/kit';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { building, dev } from '$app/environment';
import { auth } from '$lib/server/auth';
import { isForbiddenCrossSiteForm } from '$lib/server/csrf';

export const handle: Handle = async ({ event, resolve }) => {
	// Stands in for SvelteKit's csrf.checkOrigin, which svelte.config.js disables so
	// that /oauth/token can accept form-encoded posts from non-browser clients. Runs
	// before anything else, and is production-only, both matching the built-in it
	// replaces — including its response shape, so nothing downstream sees a change.
	if (!dev && isForbiddenCrossSiteForm(event.request, event.url.origin, event.url.pathname)) {
		const message = `Cross-site ${event.request.method} form submissions are forbidden`;
		const init = { status: 403 };
		return event.request.headers.get('accept') === 'application/json'
			? json({ message }, init)
			: text(message, init);
	}

	// Resolve the session once so server endpoints can read event.locals.
	const session = await auth.api.getSession({ headers: event.request.headers });
	event.locals.session = session?.session ?? null;
	event.locals.user = session?.user ?? null;

	// Routes /api/auth/* to the better-auth handler; everything else falls through.
	return svelteKitHandler({ event, resolve, auth, building });
};
