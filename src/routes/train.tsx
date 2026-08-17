// Train — Direction C.
//
// The screen the athlete uses one-handed, mid-set, with chalky hands, and the one
// where "one thing at a time" is least contentious: you are doing one exercise.
// So the sequence is literal — the timer, then one chapter per exercise in the
// order the day prescribes them, then the wrap-up. The rail is the session.
//
// The display heading carries `c-vt-lede`, the same view-transition name the
// "Train" call to action on `/` carries. Tapping through morphs one into the
// other instead of cross-fading the page — the one transition worth spending a
// name on, because it is the navigation the athlete makes every session.
import { createFileRoute } from '@tanstack/react-router';
import { useMemo } from 'react';
import * as m from '$lib/paraglide/messages';
import { type ChapterDef, Screen } from '../components/Editorial';
import { Exercise } from '../components/train/Exercise';
import { Timer } from '../components/train/Timer';
import { WrapUp } from '../components/train/WrapUp';
import { getPrototypeFixtures } from '../prototype-fixtures';

export const Route = createFileRoute('/train')({
	component: Train,
});

function Train() {
	const { train } = useMemo(() => getPrototypeFixtures(), []);

	const chapters: ChapterDef[] = [
		...(train.timer ? [{ id: 'timer', label: m.timer_title() }] : []),
		...train.items.map((it) => ({ id: `ex-${it.exId}`, label: it.exName })),
		{ id: 'wrap', label: m.c_ch_wrap() },
	];

	const offset = train.timer ? 1 : 0;

	return (
		<Screen title={m.nav_train()} chapters={chapters}>
			{train.timer ? <Timer timer={train.timer} index={0} /> : null}
			{train.items.map((it, i) => (
				<Exercise key={it.exId} item={it} index={offset + i} />
			))}
			<WrapUp train={train} index={offset + train.items.length} />
		</Screen>
	);
}
