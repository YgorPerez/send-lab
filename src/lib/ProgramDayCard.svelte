<script lang="ts">
import CopyIcon from '@lucide/svelte/icons/copy';
import MoonIcon from '@lucide/svelte/icons/moon';
import PlusIcon from '@lucide/svelte/icons/plus';
import { toast } from 'svelte-sonner';
import { Card } from '$lib/components/ui/card';
import { Input } from '$lib/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
import type { Content, Day } from '$lib/content/types';
import ProgramExerciseRow from '$lib/ProgramExerciseRow.svelte';
import * as m from '$lib/paraglide/messages';
import {
	addProgramExercise,
	dayTemplate,
	duplicateProgramDay,
	isProgramDayCustom,
	programDayKey,
	programDayName,
	programExercises,
	resetProgramDay,
	restDayKey,
	setProgramDay,
	setProgramDayName,
} from '$lib/plan';

let { content, slot }: { content: Content; slot: Day } = $props();

const resolved = $derived(dayTemplate(content, programDayKey(slot.k)));
const exIds = $derived(programExercises(content, slot.k));
const custom = $derived(isProgramDayCustom(slot.k));
const avail = $derived(
	Object.entries(content.exercises).filter(([id]) => id !== 'rest' && !exIds.includes(id)),
);
const isRest = $derived(resolved.load === 'OFF');
const others = $derived(content.days.filter((d) => d.k !== slot.k));

function toggleRest() {
	setProgramDay(slot.k, isRest ? slot.k : restDayKey(content));
}
function duplicate(to: string) {
	duplicateProgramDay(content, slot.k, to);
	toast.success(m.prog_duplicated({ day: content.days.find((d) => d.k === to)?.label ?? to }));
}
</script>

<Card class="relative gap-2.5 overflow-hidden p-3.5">
	<span class="absolute inset-x-0 top-0 h-[3px]" style:background={resolved.color}></span>
	<div class="flex items-center justify-between">
		<span class="font-mono text-[11px] tracking-wider text-ink-faint uppercase">{slot.label}</span>
		<span
			class="font-mono text-[10px] font-bold tracking-wider uppercase"
			style:color={resolved.color}
		>
			{resolved.type} · {resolved.load}
		</span>
	</div>

	<Input
		value={programDayName(slot.k)}
		oninput={(e) => setProgramDayName(slot.k, e.currentTarget.value)}
		placeholder={m.prog_day_name_ph()}
		class="h-8 bg-panel-2 text-sm"
	/>

	<Select
		type="single"
		value={programDayKey(slot.k)}
		onValueChange={(v) => v && setProgramDay(slot.k, v)}
	>
		<SelectTrigger class="h-9 w-full border-line bg-panel-2 text-xs">
			{resolved.type} · {resolved.load}
		</SelectTrigger>
		<SelectContent>
			{#each content.days as opt (opt.k)}
				<SelectItem value={opt.k}>{opt.type} · {opt.load}</SelectItem>
			{/each}
		</SelectContent>
	</Select>

	{#if !isRest}
		<div class="flex flex-col gap-1.5">
			{#each exIds as exId, i (exId)}
				<ProgramExerciseRow
					{content}
					weekday={slot.k}
					{exId}
					first={i === 0}
					last={i === exIds.length - 1}
				/>
			{/each}
		</div>

		{#if avail.length}
			<Select type="single" value="" onValueChange={(v) => v && addProgramExercise(content, slot.k, v)}>
				<SelectTrigger class="h-8 w-full border-dashed border-line bg-panel-2 text-xs text-ink-dim">
					<PlusIcon class="mr-1 size-3.5" />{m.wk_add_ex()}
				</SelectTrigger>
				<SelectContent>
					{#each avail as [id, ex] (id)}
						<SelectItem value={id}>{ex.name}</SelectItem>
					{/each}
				</SelectContent>
			</Select>
		{/if}
	{/if}

	<div class="flex flex-wrap items-center gap-1.5 border-t border-line pt-2.5">
		<button
			type="button"
			onclick={toggleRest}
			class="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 font-mono text-[10px] tracking-wider text-ink-faint uppercase transition hover:text-ink"
		>
			<MoonIcon class="size-3" />{isRest ? m.prog_make_training() : m.prog_make_rest()}
		</button>

		<Select type="single" value="" onValueChange={(v) => v && duplicate(v)}>
			<SelectTrigger
				class="h-[26px] w-auto gap-1 border-line bg-transparent px-2 font-mono text-[10px] tracking-wider text-ink-faint uppercase"
			>
				<CopyIcon class="size-3" />{m.prog_duplicate_to()}
			</SelectTrigger>
			<SelectContent>
				{#each others as d (d.k)}
					<SelectItem value={d.k}>{d.label}</SelectItem>
				{/each}
			</SelectContent>
		</Select>

		{#if custom}
			<button
				type="button"
				onclick={() => resetProgramDay(slot.k)}
				class="ml-auto font-mono text-[10px] tracking-wider text-ink-faint uppercase transition hover:text-flag"
			>
				{m.wk_reset_day()}
			</button>
		{/if}
	</div>
</Card>
