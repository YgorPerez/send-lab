<script lang="ts">
import PlusIcon from '@lucide/svelte/icons/plus';
import XIcon from '@lucide/svelte/icons/x';
import { toast } from 'svelte-sonner';
import { Button } from '$lib/components/ui/button';
import { Card } from '$lib/components/ui/card';
import { Input } from '$lib/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
import { getContent } from '$lib/content';
import Prose from '$lib/Prose.svelte';
import * as m from '$lib/paraglide/messages';
import {
	addDayExercise,
	exerciseLabel,
	removeDayExercise,
	resolveExerciseIds,
	resolveSwapIndex,
} from '$lib/plan';
import SectionHeading from '$lib/SectionHeading.svelte';
import { appState, today, type WorkoutSet } from '$lib/state.svelte';
import Timer from '$lib/Timer.svelte';

const content = getContent();
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const weekday = WEEKDAYS[new Date().getDay()];
const week = $derived(appState.currentWeek);
const dayLabel = $derived(content.days.find((d) => d.k === weekday)?.label ?? weekday);

const dayExIds = $derived(resolveExerciseIds(content, week, weekday));

interface Item {
	exId: string;
	name: string;
	spec: string;
}
const items = $derived<Item[]>(
	dayExIds.flatMap((exId) => {
		const ex = content.exercises[exId];
		if (!ex) return [];
		const idx = resolveSwapIndex(week, weekday, exId);
		if (exId === 'rest' && idx === 0) return [];
		return [{ exId, name: exerciseLabel(ex, idx), spec: ex.spec }];
	}),
);
const avail = $derived(
	Object.entries(content.exercises).filter(([id]) => id !== 'rest' && !dayExIds.includes(id)),
);

// In-progress sets, keyed by exercise id (committed on "finish").
let sets = $state<Record<string, WorkoutSet[]>>({});
let note = $state('');

function addSet(exId: string) {
	sets[exId] = [...(sets[exId] ?? []), { weight: null, time: null, reps: null, rest: null }];
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
		.map((it) => ({ exId: it.exId, name: it.name, sets: sets[it.exId] ?? [] }))
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
				<Card class="gap-2.5 p-4">
					<div class="flex items-start justify-between gap-2">
						<div class="font-bold">{it.name}</div>
						<button
							type="button"
							class="text-ink-faint transition hover:text-flag"
							aria-label={m.btn_delete()}
							onclick={() => removeItem(it.exId)}
						>
							<XIcon class="size-4" />
						</button>
					</div>
					<div class="font-mono text-[12px] text-ink-dim"><Prose value={it.spec} /></div>

					{#if (sets[it.exId] ?? []).length > 0}
						<div class="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-1.5 text-[10px] text-ink-faint">
							<span>{m.field_weight()}</span>
							<span>{m.field_time()}</span>
							<span>{m.field_reps()}</span>
							<span>{m.field_rest()}</span>
							<span></span>
						</div>
					{/if}
					{#each sets[it.exId] ?? [] as set, i (i)}
						<div class="grid grid-cols-[1fr_1fr_1fr_1fr_auto] items-center gap-1.5">
							<Input type="number" step="any" bind:value={set.weight} class="h-8 bg-panel-2 text-sm" />
							<Input type="number" step="any" bind:value={set.time} class="h-8 bg-panel-2 text-sm" />
							<Input type="number" step="any" bind:value={set.reps} class="h-8 bg-panel-2 text-sm" />
							<Input type="number" step="any" bind:value={set.rest} class="h-8 bg-panel-2 text-sm" />
							<button
								type="button"
								class="text-ink-faint transition hover:text-flag"
								aria-label={m.btn_delete()}
								onclick={() => removeSet(it.exId, i)}
							>
								<XIcon class="size-4" />
							</button>
						</div>
					{/each}

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
