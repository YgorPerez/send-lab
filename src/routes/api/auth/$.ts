import { createFileRoute } from '@tanstack/react-router';
import { auth } from '../../../lib/server/auth';

// better-auth's own endpoints. Deliberately NOT wrapped in `withAthlete` — these
// are how an athlete signs in, so requiring a session here would be circular.
// `pnpm check:routes` knows about this exemption by path; every other server
// route must go through the wrapper.
export const Route = createFileRoute('/api/auth/$')({
	server: {
		handlers: {
			GET: ({ request }) => auth.handler(request),
			POST: ({ request }) => auth.handler(request),
		},
	},
});
