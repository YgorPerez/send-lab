<script lang="ts">
import PlusIcon from '@lucide/svelte/icons/plus';
import RepeatIcon from '@lucide/svelte/icons/repeat';
import TimerIcon from '@lucide/svelte/icons/timer';
import XIcon from '@lucide/svelte/icons/x';
import { toast } from 'svelte-sonner';
import { page } from '$app/state';
import { recordAssessment } from '$lib/assessment';
import { Button } from '$lib/components/ui/button';
import { Card } from '$lib/components/ui/card';
import { Input } from '$lib/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
import { getContent } from '$lib/content';
import type { Range, Variant } from '$lib/content/types';
import {
	addSetTo,
	clearExercise,
	defaultSet,
	getNote,
	removeSetFrom,
	repeatLastInto,
	setNote,
	setsFor,
} from '$lib/dayLog';
import PrescriptionView from '$lib/PrescriptionView.svelte';
import Prose from '$lib/Prose.svelte';
import * as m from '$lib/paraglide/messages';
import {
	addDayExercise,
	removeDayExercise,
	resolveExerciseIds,
	resolveSwapIndex,
	setDaySwap,
	taskKey,
	timerSeedFor,
	variantOf,
} from '$lib/plan';
import SectionHeading from '$lib/SectionHeading.svelte';
import SetRows from '$lib/SetRows.svelte';
import { appState, type WorkoutSet } from '$lib/state.svelte';
import Timer from '$lib/Timer.svelte';
import { configureTimer, startRest, timer } from '$lib/timerStore.svelte';
import { type Col, colsFor } from '$lib/trainColumns';
import { cn } from '$lib/utils';
import VariantPicker from '$lib/VariantPicker.svelte';

const content = getContent();
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const weekday = WEEKDAYS[new Date().getDay()];
const week = $derived(appState.currentWeek);
const dayLabel = $derived(content.days.find((d) => d.k === weekday)?.label ?? weekday);

const dayExIds = $derived(resolveExerciseIds(content, week, weekday));

interface Item {
	exId: string;
	exName: string;
	idx: number;
	variantName: string;
	spec: Variant;
	cols: Col[];
	/** Whether this exercise has interval timings the timer can run. */
	timed: boolean;
}
const items = $derived<Item[]>(
	dayExIds.flatMap((exId) => {
		const ex = content.exercises[exId];
		if (!ex) return [];
		const idx = resolveSwapIndex(week, weekday, exId);
		if (exId === 'rest' && idx === 0) return [];
		const spec = variantOf(ex, idx);
		return [
			{
				exId,
				exName: ex.name,
				idx,
				variantName: spec.name,
				spec,
				cols: colsFor(spec),
				timed: spec.workSec != null,
			},
		];
	}),
);

// Key a seed by exercise + variant so changing the variant re-seeds the timer.
const seedOf = (it: Item) => timerSeedFor(it.spec, `${it.exId}:${it.idx}`, it.exName);

/** Name to record in the log: exercise, plus the variant when it differs. */
function logName(it: Item): string {
	return it.variantName && it.variantName !== it.exName
		? `${it.exName} · ${it.variantName}`
		: it.exName;
}
const avail = $derived(
	Object.entries(content.exercises).filter(([id]) => id !== 'rest' && !dayExIds.includes(id)),
);

// Exercise the timer follows when set; otherwise it auto-picks the next task.
let activeExId = $state<string | null>(null);
// Exercises opened as a metric assessment (exId → metricId): when completed,
// their logged sets auto-record that metric (once).
let assess = $state<Record<string, string>>({});
let recorded = $state<Record<string, boolean>>({});

// The timer reflects: your explicit pick, else the first un-logged timed
// exercise, else the first timed exercise of the day.
const timerTarget = $derived.by(() => {
	const picked = activeExId ? items.find((it) => it.exId === activeExId && it.timed) : undefined;
	if (picked) return picked;
	const next = items.find((it) => it.timed && setsFor(dayLabel, it.exId).length === 0);
	if (next) return next;
	return items.find((it) => it.timed) ?? null;
});

// Keep the (global) timer loaded with the current target while it's idle.
$effect(() => {
	const t = timerTarget;
	if (!t) return;
	const s = seedOf(t);
	if (s && s.key !== timer.key) configureTimer(s);
});

// Reflect completion on the Today tab: an exercise with any done set marks its
// task done; an assessed exercise also records its metric once.
$effect(() => {
	for (const it of items) {
		const k = taskKey(week, weekday, it.exId);
		const done = setsFor(dayLabel, it.exId).some((s) => s.done);
		if (done) {
			if (!appState.taskDone[k]) appState.taskDone[k] = true;
			const metricId = assess[it.exId];
			if (metricId && !recorded[it.exId]) {
				recorded[it.exId] = true;
				recordAssessment(metricId, setsFor(dayLabel, it.exId), content);
			}
		} else if (appState.taskDone[k]) {
			delete appState.taskDone[k];
		}
	}
});

/** Load an exercise into the timer now (overrides a running session). */
function useInTimer(it: Item) {
	activeExId = it.exId;
	const s = seedOf(it);
	if (s) configureTimer(s, true);
}

/** Switch variant; if the timer is running this exercise, reflect it immediately. */
function selectVariant(it: Item, i: number) {
	setDaySwap(week, weekday, it.exId, i);
	if (timer.key?.startsWith(`${it.exId}:`)) {
		const ex = content.exercises[it.exId];
		const s = ex && timerSeedFor(variantOf(ex, i), `${it.exId}:${i}`, ex.name);
		if (s) configureTimer(s, true);
	}
}

// Arriving via /train?ex=<id> (Today or Metrics) adds that exercise to today if
// missing, then focuses it — once.
let consumedParam = $state(false);
$effect(() => {
	if (consumedParam) return;
	const exId = page.url.searchParams.get('ex');
	if (!exId || !content.exercises[exId]) {
		consumedParam = true;
		return;
	}
	const metricId = page.url.searchParams.get('assess');
	if (metricId) assess[exId] = metricId;
	if (!dayExIds.includes(exId)) {
		addDayExercise(content, week, weekday, exId);
		return; // wait for items to include it on the next run
	}
	const it = items.find((i) => i.exId === exId);
	if (!it) return;
	consumedParam = true;
	activeExId = exId;
	if (it.timed) {
		const s = seedOf(it);
		if (s) configureTimer(s, true);
	}
});

const mid = (r?: Range): number | null => (r ? Math.round((r.min + r.max) / 2) : null);

/** Start the rest countdown after marking a set done (inter-set rest, else rest). */
function restAfter(it: Item) {
	const secs = mid(it.spec.setRestSec) ?? mid(it.spec.restSec) ?? 60;
	startRest(secs, `${m.timer_rest()} · ${it.exName}`);
}

// Whether anything is logged today (gates the "repeat last session" shortcut).
const loggedAny = $derived(items.some((it) => setsFor(dayLabel, it.exId).length > 0));

/** Pre-fill today from the most recent prior session of the same weekday. */
function repeatLast() {
	const ids = repeatLastInto(dayLabel);
	if (!ids) {
		toast.error(m.train_no_prev());
		return;
	}
	for (const id of ids) if (!dayExIds.includes(id)) addDayExercise(content, week, weekday, id);
	toast.success(m.train_repeated());
}

function addSet(it: Item) {
	const existing = setsFor(dayLabel, it.exId);
	// First set: prefill from the target. Later sets: carry over the previous one
	// (so your edits become the default for what you add next).
	const seed: WorkoutSet = existing.length
		? { ...existing[existing.length - 1], done: false }
		: defaultSet(it.spec);
	addSetTo(dayLabel, it.exId, logName(it), seed);
}
function removeSet(exId: string, i: number) {
	removeSetFrom(dayLabel, exId, i);
}
function removeItem(exId: string) {
	removeDayExercise(content, week, weekday, exId);
	clearExercise(dayLabel, exId);
}
</script>

<section class="animate-in fade-in duration-300">
	<SectionHeading title={m.sec_train()} />
	<p class="mb-[26px] max-w-[62ch] text-[15px] text-ink-dim">
		<Prose value={m.lede_train()} />
	</p>

	<div class="mb-[22px]"><Timer /></div>

	{#if items.length === 0}
		<div class="mb-3 rounded-xl border border-dashed border-line px-5 py-[34px] text-center text-sm text-ink-faint">
			{m.train_empty()}
		</div>
	{:else}
		<div class="flex flex-col gap-3">
			{#each items as it (it.exId)}
				{@const isActive = timer.key === `${it.exId}:${it.idx}` || it.exId === activeExId}
				<Card class={cn('gap-2.5 p-4', isActive && 'ring-1 ring-flag/60')}>
					<div class="flex items-start justify-between gap-2">
						<div class="font-bold">{it.exName}</div>
						<div class="flex items-center gap-2">
							{#if it.timed}
								<button
									type="button"
									class={cn(
										'transition',
										isActive ? 'text-flag' : 'text-ink-faint hover:text-ink'
									)}
									aria-label={m.timer_use()}
									title={m.timer_use()}
									onclick={() => useInTimer(it)}
								>
									<TimerIcon class="size-4" />
								</button>
							{/if}
							<button
								type="button"
								class="text-ink-faint transition hover:text-flag"
								aria-label={m.btn_delete()}
								onclick={() => removeItem(it.exId)}
							>
								<XIcon class="size-4" />
							</button>
						</div>
					</div>
					{@const ex = content.exercises[it.exId]}
					{#if ex}
						<VariantPicker exercise={ex} idx={it.idx} onSelect={(i) => selectVariant(it, i)} />
					{/if}
					<div
						class="rounded-lg border border-line bg-panel-2 px-3 py-2.5"
						aria-label={m.train_target()}
					>
						<PrescriptionView spec={it.spec} />
					</div>

					<SetRows
						rows={setsFor(dayLabel, it.exId)}
						cols={it.cols}
						onRemove={(i) => removeSet(it.exId, i)}
						onDone={() => restAfter(it)}
					/>

					<Button
						variant="outline"
						size="sm"
						class="mt-1 self-start border-line text-xs"
						onclick={() => addSet(it)}
					>
						<PlusIcon class="mr-1 size-3.5" />{m.train_add_set()}
					</Button>
				</Card>
			{/each}
		</div>
	{/if}

	{#if avail.length}
		<div class="mt-3">
			<Select
				type="single"
				value=""
				onValueChange={(v) => v && addDayExercise(content, week, weekday, v)}
			>
				<SelectTrigger class="h-9 w-full border-dashed border-line bg-panel-2 text-xs text-ink-dim">
					<PlusIcon class="mr-1 size-3.5" />{m.wk_add_ex()}
				</SelectTrigger>
				<SelectContent>
					{#each avail as [id, ex] (id)}
						<SelectItem value={id}>{ex.name}</SelectItem>
					{/each}
				</SelectContent>
			</Select>
		</div>
	{/if}

	{#if !loggedAny}
		<Button
			variant="outline"
			size="sm"
			class="mt-3 self-start border-line text-xs"
			onclick={repeatLast}
		>
			<RepeatIcon class="mr-1.5 size-3.5" />{m.train_repeat()}
		</Button>
	{/if}

	{#if items.length > 0}
		<div class="mt-4 flex flex-col gap-1.5">
			<Input
				value={getNote(dayLabel)}
				oninput={(e) => setNote(dayLabel, e.currentTarget.value)}
				placeholder={m.train_note()}
				class="bg-panel-2 text-sm"
			/>
			<p class="font-mono text-[10px] tracking-wider text-ink-faint uppercase">
				{m.train_autosave()}
			</p>
		</div>
	{/if}
</section>
