// Today — Direction C.
//
// The ticket's hard question: `/` carries five things at once — the readiness
// check, the plan, the stat cards, the bodyweight nudge and the rehab section —
// and a one-thing-at-a-time direction has to say what happens to the other four.
//
// The answer here is **a sequence, not a cut**. All five are still on `/`, in the
// same order of importance the athlete described, and every one of them is one
// tap away in the rail. What changed is that only one occupies the screen at a
// time. The information architecture is untouched: nothing moved to another
// route, nothing was merged, nothing was dropped.
//
// The bodyweight nudge did move *within* the page — it used to sit above the plan
// and ask for a number before the athlete had been told what to do. It is now the
// tail of chapter IV, next to the series it writes to.
import { createFileRoute } from '@tanstack/react-router';
import { useMemo } from 'react';
import * as m from '$lib/paraglide/messages';
import { type ChapterDef, Screen } from '../components/Editorial';
import { Body } from '../components/today/Body';
import { Check } from '../components/today/Check';
import { Plan } from '../components/today/Plan';
import { Record } from '../components/today/Record';
import { Verdict } from '../components/today/Verdict';
import { getPrototypeFixtures } from '../prototype-fixtures';

export const Route = createFileRoute('/')({
	component: Today,
});

function Today() {
	// One call per render, per the fixture module's contract. The tree remounts on
	// a locale switch (see `__root.tsx`), so an empty dependency list is correct:
	// the memo cannot outlive the locale it was resolved against.
	const { today } = useMemo(() => getPrototypeFixtures(), []);

	const chapters: ChapterDef[] = [
		{ id: 'verdict', label: m.c_ch_verdict() },
		{ id: 'plan', label: m.c_ch_plan() },
		{ id: 'check', label: m.c_ch_check() },
		{ id: 'record', label: m.c_ch_record() },
		{ id: 'body', label: m.c_ch_body() },
	];

	return (
		<Screen title={m.nav_today()} chapters={chapters}>
			<Verdict today={today} index={0} />
			<Plan today={today} index={1} />
			<Check today={today} index={2} />
			<Record today={today} index={3} />
			<Body today={today} index={4} />
		</Screen>
	);
}
