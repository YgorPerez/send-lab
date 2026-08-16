import { createFileRoute } from '@tanstack/react-router';
import { getAuth } from '../../../lib/server/auth';
import { assertRuntimeEnv } from '../../../lib/server/env';

// better-auth's own endpoints. Deliberately NOT wrapped in `withAthlete` — these
// are how an athlete signs in, so requiring a session here would be circular.
// `pnpm check:routes` knows about this exemption by path; every other server
// route must go through the wrapper.
//
// It still asserts the runtime env, because signing a session token with a
// generated secret is exactly the failure that assertion exists to prevent.
function handle(request: Request): Promise<Response> {
	assertRuntimeEnv();
	return getAuth().handler(request);
}

export const Route = createFileRoute('/api/auth/$')({
	server: {
		handlers: {
			GET: ({ request }) => handle(request),
			POST: ({ request }) => handle(request),
		},
	},
});
