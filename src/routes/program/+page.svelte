<script lang="ts">
import PlusIcon from '@lucide/svelte/icons/plus';
import { toast } from 'svelte-sonner';
import { Button } from '$lib/components/ui/button';
import { Card } from '$lib/components/ui/card';
import { Input } from '$lib/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
import { getContent } from '$lib/content';
import Periodization from '$lib/Periodization.svelte';
import ProgramExerciseRow from '$lib/ProgramExerciseRow.svelte';
import Prose from '$lib/Prose.svelte';
import * as m from '$lib/paraglide/messages';
import {
	addProgramExercise,
	dayTemplate,
	isProgramDayCustom,
	programDayKey,
	programExercises,
	resetProgram,
	resetProgramDay,
	setProgramDay,
	setProgramWeeks,
} from '$lib/plan';
import SectionHeading from '$lib/SectionHeading.svelte';
import { appState } from '$lib/state.svelte';

const content = getContent();
</script>

<section class="animate-in fade-in duration-300">
	<SectionHeading title={m.sec_program()} />
	<p class="mb-[26px] max-w-[62ch] text-[15px] text-ink-dim"><Prose value={m.lede_program()} /></p>

	<div class="mb-[22px] flex flex-col gap-3">
		<Card class="flex-row items-center justify-between gap-3 p-[18px]">
			<span class="font-bold">{m.prog_weeks()}</span>
			<Input
				type="number"
				min="1"
				max="24"
				value={appState.program.weeks}
				oninput={(e) => setProgramWeeks(Number(e.currentTarget.value))}
				class="h-9 w-24 bg-panel-2 text-center text-sm"
			/>
		</Card>
		<Periodization />
	</div>

	<div class="grid gap-3 md:grid-cols-2">
		{#each content.days as slot (slot.k)}
			{@const resolved = dayTemplate(content, programDayKey(slot.k))}
			{@const exIds = programExercises(content, slot.k)}
			{@const custom = isProgramDayCustom(slot.k)}
			{@const avail = Object.entries(content.exercises).filter(
				([id]) => id !== 'rest' && !exIds.includes(id)
			)}
			<Card class="relative gap-2.5 overflow-hidden p-3.5">
				<span class="absolute inset-x-0 top-0 h-[3px]" style:background={resolved.color}></span>
				<div class="flex items-center justify-between">
					<span class="font-mono text-[11px] tracking-wider text-ink-faint uppercase">
						{slot.label}
					</span>
					<span
						class="font-mono text-[10px] font-bold tracking-wider uppercase"
						style:color={resolved.color}
					>
						{resolved.type} · {resolved.load}
					</span>
				</div>

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
					<Select
						type="single"
						value=""
						onValueChange={(v) => v && addProgramExercise(content, slot.k, v)}
					>
						<SelectTrigger
							class="h-8 w-full border-dashed border-line bg-panel-2 text-xs text-ink-dim"
						>
							<PlusIcon class="mr-1 size-3.5" />{m.wk_add_ex()}
						</SelectTrigger>
						<SelectContent>
							{#each avail as [id, ex] (id)}
								<SelectItem value={id}>{ex.name}</SelectItem>
							{/each}
						</SelectContent>
					</Select>
				{/if}

				{#if custom}
					<button
						type="button"
						onclick={() => resetProgramDay(slot.k)}
						class="self-start font-mono text-[10px] tracking-wider text-ink-faint uppercase transition hover:text-flag"
					>
						{m.wk_reset_day()}
					</button>
				{/if}
			</Card>
		{/each}
	</div>

	<Button
		variant="outline"
		size="sm"
		onclick={() => {
			resetProgram();
			toast.success(m.prog_reset_done());
		}}
		class="mt-6 border-line font-mono text-[11px] text-ink-faint hover:border-flag hover:text-flag"
	>
		{m.prog_reset()}
	</Button>
</section>
