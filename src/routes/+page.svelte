<script lang="ts">
import CheckIcon from '@lucide/svelte/icons/check';
import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
import { toast } from 'svelte-sonner';
import { Badge } from '$lib/components/ui/badge';
import { Button } from '$lib/components/ui/button';
import { Card, CardContent } from '$lib/components/ui/card';
import { type Answers, computeVerdictId, getContent } from '$lib/content';
import Prose from '$lib/Prose.svelte';
import * as m from '$lib/paraglide/messages';
import { resolveDay, resolveExerciseIds, resolveSwapIndex, taskKey } from '$lib/plan';
import SectionHeading from '$lib/SectionHeading.svelte';
import { appState, today } from '$lib/state.svelte';
import { cn } from '$lib/utils';

const content = getContent();

// Today's planned protocol = the microcycle slot for the real weekday.
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const weekday = WEEKDAYS[new Date().getDay()];
const week = $derived(appState.currentWeek);
const day = $derived(resolveDay(content, week, weekday));
const dayLabel = $derived(content.days.find((d) => d.k === weekday)?.label ?? weekday);

interface Task {
	id: string;
	label: string;
	done: boolean;
}

const tasks = $derived<Task[]>(
	resolveExerciseIds(content, week, weekday).flatMap((exId) => {
		const ex = content.exercises[exId];
		// `rest` is not a task — a day with no tasks is a rest day.
		if (!ex) return [];
		const idx = resolveSwapIndex(week, weekday, exId);
		if (exId === 'rest' && idx === 0) return [];
		return [{ id: exId, label: ex.name, done: !!appState.taskDone[taskKey(week, weekday, exId)] }];
	}),
);
const isRestDay = $derived(tasks.length === 0);

let answers = $state<Answers>({});
const complete = $derived(Object.keys(answers).length === content.quiz.length);
const verdict = $derived(complete ? content.verdicts[computeVerdictId(answers)] : null);

function pick(qid: string, value: number) {
	answers = { ...answers, [qid]: value };
}

function recheck() {
	answers = {};
}

function logVerdict() {
	if (!verdict) return;
	appState.log.unshift({
		date: today(),
		type: 'rec',
		label: verdict.title,
		color: verdict.color,
		note: tasks[0] ? `${dayLabel} · ${tasks[0].label}` : verdict.tag,
	});
	toast.success(m.toast_session_logged());
}
</script>

<section class="animate-in fade-in duration-300">
	<SectionHeading title={m.sec_today()} />
	<p class="mb-[26px] max-w-[62ch] text-[15px] text-ink-dim">
		<Prose value={m.lede_today()} />
	</p>

	<!-- Today's plan + per-task checklist -->
	<Card class="mb-[22px] gap-3 border-l-[3px] p-5" style="border-left-color: {day.color}">
		<div class="flex items-baseline justify-between gap-2">
			<span class="font-bold">{m.td_today_label()} · {dayLabel}</span>
			<div class="flex items-baseline gap-2.5">
				<a href="/week" class="font-mono text-[11px] text-ink-faint hover:text-ink">
					{m.week_label({ n: week })}
				</a>
				<span class="font-mono text-[11px] tracking-wider uppercase" style:color={day.color}>
					{day.load}
				</span>
			</div>
		</div>
		{#if isRestDay}
			<p class="text-sm text-teal">{m.td_rest_day()}</p>
			<p class="text-xs text-ink-dim"><Prose value={day.sec} /></p>
		{:else}
			<div class="flex flex-col gap-2">
				{#each tasks as task (task.id)}
					<a
						href="/train?ex={task.id}"
						class={cn(
							'flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition',
							task.done
								? 'border-teal/40 bg-teal/5 text-ink-faint'
								: 'border-line bg-panel-2 text-ink-dim hover:border-flag hover:text-chalk'
						)}
					>
						{#if task.done}
							<CheckIcon class="size-4 flex-none text-teal" />
						{/if}
						<span class={cn('flex-1', task.done && 'line-through')}>{task.label}</span>
						<span class="font-mono text-[10px] tracking-wider text-ink-faint uppercase">
							{task.done ? m.lbl_done() : m.td_open_train()}
						</span>
						<ChevronRightIcon class="size-4" />
					</a>
				{/each}
			</div>
		{/if}
	</Card>

	<Card class="mb-[22px] gap-0 p-6">
		<CardContent class="space-y-[22px] p-0">
			{#each content.quiz as q, qi (q.id)}
				<div>
					<div class="mb-2.5 text-[15px] font-semibold">
						<span class="mr-2 font-mono text-xs text-flag">0{qi + 1}</span>{q.q}
					</div>
					<div class="flex flex-wrap gap-2">
						{#each q.a as a (a.t)}
							<button
								type="button"
								onclick={() => pick(q.id, a.v)}
								class={cn(
									'min-w-[120px] flex-1 rounded-[9px] border px-3 py-[11px] text-left text-[13.5px] transition',
									answers[q.id] === a.v
										? 'border-flag bg-flag/10 font-semibold text-chalk'
										: 'border-line bg-panel-2 text-ink-dim hover:border-ink-faint hover:text-ink'
								)}
							>
								{a.t}
							</button>
						{/each}
					</div>
				</div>
			{/each}
		</CardContent>
	</Card>

	{#if verdict}
		<Card class="overflow-hidden p-0 animate-in fade-in duration-300">
			<div class="flex items-center gap-3.5 border-b border-line p-5">
				<span class="size-3.5 flex-none rounded-full" style:background={verdict.color}></span>
				<div>
					<div class="text-[19px] font-extrabold tracking-tight">{verdict.title}</div>
					<div class="font-mono text-[11px] tracking-wider text-ink-faint uppercase">
						{verdict.tag}
					</div>
				</div>
			</div>
			<div class="p-5 text-[14.5px] text-ink-dim">
				<div><Prose value={verdict.text} /></div>
				{#if tasks[0]}
					<p class="mt-2.5 text-[13px] text-ink-faint">
						{m.td_applies()} <b class="text-chalk">{tasks[0].label}</b>
					</p>
				{/if}
				<div class="mt-3.5 flex flex-wrap gap-2">
					{#each verdict.focus as f, i (f)}
						<Badge
							variant="outline"
							class={cn(
								'border-line font-mono text-[11px] font-normal text-ink-dim',
								i === 0 && 'border-flag text-flag'
							)}
						>
							<Prose value={f} />
						</Badge>
					{/each}
				</div>
				<div class="mt-[18px] flex flex-wrap gap-2.5">
					<Button class="bg-flag text-white hover:bg-flag/90" onclick={logVerdict}>
						{m.btn_log_session()}
					</Button>
					<Button variant="outline" onclick={recheck}>{m.td_recheck()}</Button>
					<Button href="/week" variant="ghost">{m.btn_view_protocol()}</Button>
				</div>
			</div>
		</Card>
	{/if}
</section>
