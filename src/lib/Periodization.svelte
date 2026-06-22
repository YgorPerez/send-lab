<script lang="ts">
import PlusIcon from '@lucide/svelte/icons/plus';
import XIcon from '@lucide/svelte/icons/x';
import { Button } from '$lib/components/ui/button';
import { Card } from '$lib/components/ui/card';
import { Input } from '$lib/components/ui/input';
import * as m from '$lib/paraglide/messages';
import { addPhase, phaseForWeek, programWeeks, removePhase, updatePhase } from '$lib/plan';
import { appState } from '$lib/state.svelte';
import { cn } from '$lib/utils';

const PALETTE = ['var(--gold)', 'var(--flag)', 'var(--violet)', 'var(--teal)'];
const phases = $derived(appState.program.phases);

// One chip per week of the block, coloured by its phase (faint when deload).
const weeks = $derived(
	Array.from({ length: programWeeks() }, (_, i) => {
		const wk = i + 1;
		const ph = phaseForWeek(wk);
		const idx = ph ? phases.indexOf(ph) : -1;
		return {
			wk,
			color: !ph ? 'var(--line)' : ph.deload ? 'var(--ink-faint)' : PALETTE[idx % PALETTE.length],
		};
	}),
);

const int = (e: Event) => Math.round(Number((e.currentTarget as HTMLInputElement).value));
const numCell = 'flex flex-col gap-1 font-mono text-[10px] tracking-wider text-ink-faint uppercase';
</script>

<Card class="gap-3.5 p-[18px]">
	<div>
		<span class="font-bold">{m.prog_periodization()}</span>
		<p class="mt-0.5 max-w-[64ch] text-xs text-ink-dim">{m.prog_periodization_desc()}</p>
	</div>

	<div class="flex items-start justify-between gap-3 rounded-lg border border-line bg-panel-2 p-2.5">
		<div class="flex-1">
			<span class="text-sm text-ink">{m.prog_autoprogress()}</span>
			<p class="mt-0.5 max-w-[56ch] text-xs text-ink-dim">{m.prog_autoprogress_desc()}</p>
			<a href="/studies" class="font-mono text-[10px] tracking-wider text-flag uppercase hover:underline">
				{m.nav_studies()} →
			</a>
		</div>
		<button
			type="button"
			role="switch"
			aria-checked={appState.program.autoProgress}
			onclick={() => (appState.program.autoProgress = !appState.program.autoProgress)}
			class={cn(
				'relative h-6 w-10 flex-none rounded-full transition',
				appState.program.autoProgress ? 'bg-flag' : 'bg-line'
			)}
		>
			<span
				class={cn(
					'absolute top-0.5 size-5 rounded-full bg-white transition-all',
					appState.program.autoProgress ? 'left-[18px]' : 'left-0.5'
				)}
			></span>
		</button>
	</div>

	{#if weeks.length}
		<div>
			<div class="mb-1.5 font-mono text-[10px] tracking-wider text-ink-faint uppercase">
				{m.prog_timeline()}
			</div>
			<div class="flex flex-wrap gap-1">
				{#each weeks as w (w.wk)}
					<span
						class="flex h-7 min-w-7 items-center justify-center rounded font-mono text-[10px] text-bg"
						style:background={w.color}
						title={`W${w.wk}`}
					>
						{w.wk}
					</span>
				{/each}
			</div>
		</div>
	{/if}

	{#if phases.length === 0}
		<p class="text-xs text-ink-faint">{m.prog_no_phases()}</p>
	{:else}
		<div class="flex flex-col gap-2.5">
			{#each phases as phase, i (i)}
				{@const color = phase.deload ? 'var(--ink-faint)' : PALETTE[i % PALETTE.length]}
				<div class="flex flex-wrap items-end gap-2.5 rounded-lg border border-line bg-panel-2 p-2.5">
					<span class="h-9 w-1.5 flex-none rounded" style:background={color}></span>
					<label class="flex min-w-[120px] flex-1 flex-col gap-1 {numCell}">
						{m.prog_phase()}
						<Input
							value={phase.name}
							oninput={(e) => updatePhase(i, { name: e.currentTarget.value })}
							class="h-8 bg-panel text-sm tracking-normal normal-case"
						/>
					</label>
					<label class="flex w-16 flex-col gap-1 {numCell}">
						{m.prog_phase_weeks()}
						<Input
							type="number"
							min="1"
							value={phase.weeks}
							oninput={(e) => updatePhase(i, { weeks: Math.max(1, int(e)) })}
							class="h-8 bg-panel text-center text-sm"
						/>
					</label>
					<label class="flex w-20 flex-col gap-1 {numCell}">
						{m.prog_intensity()} %
						<Input
							type="number"
							min="0"
							value={phase.intensity}
							oninput={(e) => updatePhase(i, { intensity: Math.max(0, int(e)) })}
							class="h-8 bg-panel text-center text-sm"
						/>
					</label>
					<label class="flex w-20 flex-col gap-1 {numCell}">
						{m.prog_volume()} %
						<Input
							type="number"
							min="0"
							value={phase.volume}
							oninput={(e) => updatePhase(i, { volume: Math.max(0, int(e)) })}
							class="h-8 bg-panel text-center text-sm"
						/>
					</label>
					<button
						type="button"
						onclick={() => updatePhase(i, { deload: !phase.deload })}
						class={cn(
							'h-8 rounded-md border px-2.5 font-mono text-[10px] tracking-wider uppercase transition',
							phase.deload
								? 'border-ink-faint bg-ink-faint/10 text-ink'
								: 'border-line text-ink-faint hover:text-ink'
						)}
						aria-pressed={phase.deload}
					>
						{m.prog_deload()}
					</button>
					<button
						type="button"
						onclick={() => removePhase(i)}
						aria-label={m.btn_delete()}
						class="flex size-8 items-center justify-center rounded-md text-ink-faint transition hover:text-flag"
					>
						<XIcon class="size-4" />
					</button>
				</div>
			{/each}
		</div>
	{/if}

	<Button
		variant="outline"
		size="sm"
		onclick={() => addPhase(`${m.prog_phase()} ${phases.length + 1}`)}
		class="self-start border-dashed border-line text-xs"
	>
		<PlusIcon class="mr-1 size-3.5" />{m.prog_add_phase()}
	</Button>
</Card>
