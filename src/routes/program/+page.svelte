<script lang="ts">
import { toast } from 'svelte-sonner';
import { Button } from '$lib/components/ui/button';
import { Card } from '$lib/components/ui/card';
import { Input } from '$lib/components/ui/input';
import { getContent } from '$lib/content';
import Periodization from '$lib/Periodization.svelte';
import ProgramDayCard from '$lib/ProgramDayCard.svelte';
import ProgramSummary from '$lib/ProgramSummary.svelte';
import Prose from '$lib/Prose.svelte';
import ProtocolPresets from '$lib/ProtocolPresets.svelte';
import * as m from '$lib/paraglide/messages';
import { programWeeks, resetProgram, setProgramWeeks } from '$lib/plan';
import SavedPrograms from '$lib/SavedPrograms.svelte';
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
			{#if appState.program.phases.length}
				<div class="flex items-center gap-2">
					<span class="font-mono text-[10px] tracking-wider text-ink-faint uppercase">
						{m.prog_weeks_from_phases()}
					</span>
					<span class="font-mono text-lg font-bold text-chalk">{programWeeks()}</span>
				</div>
			{:else}
				<Input
					type="number"
					min="1"
					max="24"
					value={appState.program.weeks}
					oninput={(e) => setProgramWeeks(Number(e.currentTarget.value))}
					class="h-9 w-24 bg-panel-2 text-center text-sm"
				/>
			{/if}
		</Card>
		<Periodization />
		<ProgramSummary />
	</div>

	<div class="grid gap-3 md:grid-cols-2">
		{#each content.days as slot (slot.k)}
			<ProgramDayCard {content} {slot} />
		{/each}
	</div>

	<div class="mt-3 flex flex-col gap-3">
		<ProtocolPresets />
		<SavedPrograms />
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
