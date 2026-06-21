<script lang="ts">
import PlusIcon from '@lucide/svelte/icons/plus';
import TimerIcon from '@lucide/svelte/icons/timer';
import XIcon from '@lucide/svelte/icons/x';
import { toast } from 'svelte-sonner';
import { Button } from '$lib/components/ui/button';
import { Card } from '$lib/components/ui/card';
import { Input } from '$lib/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
import { getContent } from '$lib/content';
import type { Range, Variant } from '$lib/content/types';
import PrescriptionView from '$lib/PrescriptionView.svelte';
import Prose from '$lib/Prose.svelte';
import * as m from '$lib/paraglide/messages';
import {
	addDayExercise,
	removeDayExercise,
	resolveExerciseIds,
	resolveSwapIndex,
	setDaySwap,
	timerSeedFor,
	variantOf,
} from '$lib/plan';
import SectionHeading from '$lib/SectionHeading.svelte';
import SetRows from '$lib/SetRows.svelte';
import { appState, today, type WorkoutSet } from '$lib/state.svelte';
import Timer from '$lib/Timer.svelte';
import { configureTimer, timer } from '$lib/timerStore.svelte';
import { loadTrainDraft, saveTrainDraft } from '$lib/trainDraft';
import { cn } from '$lib/utils';

const content = getContent();
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const weekday = WEEKDAYS[new Date().getDay()];
const week = $derived(appState.currentWeek);
const dayLabel = $derived(content.days.find((d) => d.k === weekday)?.label ?? weekday);

const dayExIds = $derived(resolveExerciseIds(content, week, weekday));

/** A loggable column, shown only when the exercise's prescription uses it. */
type ColKey = 'weight' | 'edge' | 'time' | 'reps' | 'rest' | 'rpe' | 'grip';
interface Col {
	key: ColKey;
	label: () => string;
}
// Weight (kg) and edge (mm) are always loggable — you can add load or change the
// edge on any exercise even when its target doesn't specify them. The rest are
// the universal per-set fields; grip shows when the exercise loads a grip.
function colsFor(spec: Variant): Col[] {
	const c: Col[] = [
		{ key: 'weight', label: m.field_weight },
		{ key: 'edge', label: m.field_edge },
		{ key: 'time', label: m.field_time },
		{ key: 'reps', label: m.field_reps },
	];
	if (spec.grip) c.push({ key: 'grip', label: m.field_grip });
	c.push({ key: 'rest', label: m.field_rest });
	c.push({ key: 'rpe', label: m.field_rpe });
	return c;
}

interface Item {
	exId: string;
	exName: string;
	idx: number;
	variantName: string;
	variantNames: string[];
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
				variantNames: ex.variants.map((v) => v.name),
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

// In-progress sets, keyed by exercise id (committed on "finish"). Persisted to
// localStorage so a page refresh doesn't lose what you've filled in.
const draft = loadTrainDraft();
let sets = $state<Record<string, WorkoutSet[]>>(draft.sets);
let note = $state(draft.note);

$effect(() => {
	saveTrainDraft({ sets, note });
});
// Exercise the timer follows when set; otherwise it auto-picks the next task.
let activeExId = $state<string | null>(null);

// The timer reflects: your explicit pick, else the first un-logged timed
// exercise, else the first timed exercise of the day.
const timerTarget = $derived.by(() => {
	const picked = activeExId ? items.find((it) => it.exId === activeExId && it.timed) : undefined;
	if (picked) return picked;
	const next = items.find((it) => it.timed && (sets[it.exId]?.length ?? 0) === 0);
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

/** Load an exercise into the timer now (overrides a running session). */
function useInTimer(it: Item) {
	activeExId = it.exId;
	const s = seedOf(it);
	if (s) configureTimer(s, true);
}

/** When the timer is running this exercise, reflect a variant change immediately. */
function changeVariant(it: Item, v: string) {
	const nv = Number(v);
	setDaySwap(week, weekday, it.exId, nv);
	if (timer.key?.startsWith(`${it.exId}:`)) {
		const ex = content.exercises[it.exId];
		const s = ex && timerSeedFor(variantOf(ex, nv), `${it.exId}:${nv}`, ex.name);
		if (s) configureTimer(s, true);
	}
}

const mid = (r?: Range): number | null => (r ? Math.round((r.min + r.max) / 2) : null);

/** A set pre-filled from the exercise's target prescription. */
function defaultSet(spec: Variant): WorkoutSet {
	return {
		weight: mid(spec.loadKg),
		edge: mid(spec.edgeMm),
		time: mid(spec.workSec),
		reps: mid(spec.reps),
		rest: mid(spec.restSec ?? spec.setRestSec),
		rpe: mid(spec.rpe),
		grip: spec.grip ?? null,
		done: false,
	};
}

function addSet(exId: string) {
	const existing = sets[exId] ?? [];
	const spec = items.find((it) => it.exId === exId)?.spec;
	// First set: prefill from the target. Later sets: carry over the previous one
	// (so your edits become the default for what you add next).
	const seed: WorkoutSet = existing.length
		? { ...existing[existing.length - 1], done: false }
		: spec
			? defaultSet(spec)
			: {
					weight: null,
					edge: null,
					time: null,
					reps: null,
					rest: null,
					rpe: null,
					grip: null,
					done: false,
				};
	sets[exId] = [...existing, seed];
}
function removeSet(exId: string, i: number) {
	sets[exId] = (sets[exId] ?? []).filter((_, idx) => idx !== i);
}
function removeItem(exId: string) {
	removeDayExercise(content, week, weekday, exId);
	delete sets[exId];
}

function finish() {
	const exercises = items
		.map((it) => ({ exId: it.exId, name: logName(it), sets: sets[it.exId] ?? [] }))
		.filter((e) => e.sets.length > 0);
	if (exercises.length === 0) {
		toast.error(m.train_nothing());
		return;
	}
	appState.workouts.unshift({ date: today(), day: dayLabel, exercises, note });
	sets = {};
	note = '';
	toast.success(m.train_logged());
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
				{@const activeForTimer = timer.key === `${it.exId}:${it.idx}`}
				<Card class={cn('gap-2.5 p-4', activeForTimer && 'ring-1 ring-flag/60')}>
					<div class="flex items-start justify-between gap-2">
						<div class="font-bold">{it.exName}</div>
						<div class="flex items-center gap-2">
							{#if it.timed}
								<button
									type="button"
									class={cn(
										'transition',
										activeForTimer ? 'text-flag' : 'text-ink-faint hover:text-ink'
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
					{#if it.variantNames.length > 1}
						<Select
							type="single"
							value={String(it.idx)}
							onValueChange={(v) => v != null && changeVariant(it, v)}
						>
							<SelectTrigger class="h-8 w-full border-line bg-panel-2 text-xs">
								{it.variantName}
							</SelectTrigger>
							<SelectContent>
								{#each it.variantNames as vn, i (i)}
									<SelectItem value={String(i)}>{vn}</SelectItem>
								{/each}
							</SelectContent>
						</Select>
					{/if}
					<div
						class="rounded-lg border border-line bg-panel-2 px-3 py-2.5"
						aria-label={m.train_target()}
					>
						<PrescriptionView spec={it.spec} />
					</div>

					<SetRows
						rows={sets[it.exId] ?? []}
						cols={it.cols}
						onRemove={(i) => removeSet(it.exId, i)}
					/>

					<Button
						variant="outline"
						size="sm"
						class="mt-1 self-start border-line text-xs"
						onclick={() => addSet(it.exId)}
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

	{#if items.length > 0}
		<div class="mt-4 flex flex-col gap-2.5">
			<Input bind:value={note} placeholder={m.train_note()} class="bg-panel-2 text-sm" />
			<Button class="self-start bg-flag text-white hover:bg-flag/90" onclick={finish}>
				{m.train_finish()}
			</Button>
		</div>
	{/if}
</section>
