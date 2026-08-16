import { createFileRoute } from '@tanstack/react-router';
import { eq } from 'drizzle-orm';
import { db } from '../../lib/server/db';
import { appStateTable, user } from '../../lib/server/db/schema';
import { withAthlete } from '../../lib/server/withAthlete';

// The scaffold's proof of life (#21 step 8): an authenticated read that reaches
// the real database. It goes through `withAthlete` like every other server route.
export const Route = createFileRoute('/api/me')({
	server: {
		handlers: {
			GET: withAthlete(async ({ athlete }) => {
				// Two independent reads — issued together rather than in sequence, so
				// the round trip to Turso is paid once.
				const [[row], [state]] = await Promise.all([
					db
						.select({ name: user.name, email: user.email })
						.from(user)
						.where(eq(user.id, athlete.userId))
						.limit(1),
					db
						.select({ updatedAt: appStateTable.updatedAt })
						.from(appStateTable)
						.where(eq(appStateTable.userId, athlete.userId))
						.limit(1),
				]);
				return Response.json({
					name: row?.name ?? null,
					email: row?.email ?? null,
					stateUpdatedAt: state?.updatedAt ?? null,
				});
			}),
		},
	},
});
