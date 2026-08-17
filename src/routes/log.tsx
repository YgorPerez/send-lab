// Log — Direction C.
//
// Three chapters, in the order the athlete asks about them: what the checks said,
// what was actually trained, and the plain activity list. Nothing is paginated
// and nothing is truncated — the whole fixture is here, which on this screen means
// fourteen checks, twenty-six sessions and eight activity rows.
import { createFileRoute } from '@tanstack/react-router';
import { useMemo } from 'react';
import * as m from '$lib/paraglide/messages';
import { type ChapterDef, Screen } from '../components/Editorial';
import { LogActivity, LogReadiness, LogSessions } from '../components/Log';
import { getPrototypeFixtures } from '../prototype-fixtures';

export const Route = createFileRoute('/log')({
	component: LogScreen,
});

function LogScreen() {
	const { log } = useMemo(() => getPrototypeFixtures(), []);

	const chapters: ChapterDef[] = [
		{ id: 'log-readiness', label: m.log_readiness() },
		{ id: 'log-sessions', label: m.log_workouts() },
		{ id: 'log-activity', label: m.log_activity() },
	];

	return (
		<Screen title={m.nav_log()} chapters={chapters}>
			<LogReadiness log={log} index={0} />
			<LogSessions log={log} index={1} />
			<LogActivity log={log} index={2} />
		</Screen>
	);
}
