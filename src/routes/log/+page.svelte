<script lang="ts">
import { toast } from 'svelte-sonner';
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from '$lib/components/ui/accordion';
import { Button } from '$lib/components/ui/button';
import * as m from '$lib/paraglide/messages';
import { gripLabel } from '$lib/plan';
import SectionHeading from '$lib/SectionHeading.svelte';
import { appState, resetAll } from '$lib/state.svelte';
import { edgeLabel, showKg, showMm, weightLabel } from '$lib/units';

const typeLabel: Record<string, () => string> = {
	rec: m.log_type_rec,
	day: m.log_type_day,
	test: m.log_type_test,
};

function remove(idx: number) {
	appState.log.splice(idx, 1);
}
function removeWorkout(idx: number) {
	appState.workouts.splice(idx, 1);
}
function reset() {
	if (confirm(m.reset_confirm())) {
		resetAll();
		toast.success(m.toast_all_reset());
	}
}

const fmt = (v: number | null) => (v == null ? '—' : String(v));
</script>

<section class="animate-in fade-in duration-300">
	<SectionHeading title={m.sec_log()} />
	<p class="mb-[26px] max-w-[62ch] text-[15px] text-ink-dim">{m.lede_log()}</p>

	{#if appState.workouts.length > 0}
		<h3 class="mb-2 font-mono text-[11px] tracking-wider text-ink-faint uppercase">
			{m.log_workouts()}
		</h3>
		<Accordion type="multiple" class="mb-6 flex flex-col gap-2.5">
			{#each appState.workouts.slice(0, 60) as w, idx (w)}
				<AccordionItem value={`w${idx}`} class="rounded-xl border border-line bg-panel last:border-b">
					<AccordionTrigger class="px-4 py-3 hover:no-underline">
						<span class="font-mono text-xs text-ink-faint">{w.date}</span>
						<span class="ml-2 flex-1 text-left text-[13px]">
							<b class="text-chalk">{w.day}</b>
							<span class="text-ink-faint">· {w.exercises.length}×</span>
						</span>
					</AccordionTrigger>
					<AccordionContent class="px-4 pb-4">
						{#each w.exercises as ex (ex.exId)}
							<div class="mb-2.5">
								<div class="mb-1 text-[13px] font-semibold text-chalk">{ex.name}</div>
								<div class="overflow-x-auto">
									<div
										class="grid min-w-max gap-x-3 gap-y-1 font-mono text-[11px] text-ink-faint"
										style="grid-template-columns:repeat(7,minmax(40px,1fr))"
									>
										<span>{weightLabel()}</span>
										<span>{edgeLabel()}</span>
										<span>{m.field_time()}</span>
										<span>{m.field_reps()}</span>
										<span>{m.field_rest()}</span>
										<span>{m.field_rpe()}</span>
										<span>{m.field_grip()}</span>
										{#each ex.sets as s, i (i)}
											<span class="text-ink-dim">{fmt(showKg(s.weight))}</span>
											<span class="text-ink-dim">{fmt(showMm(s.edge))}</span>
											<span class="text-ink-dim">{fmt(s.time)}</span>
											<span class="text-ink-dim">{fmt(s.reps)}</span>
											<span class="text-ink-dim">{fmt(s.rest)}</span>
											<span class="text-ink-dim">{fmt(s.rpe)}</span>
											<span class="text-ink-dim">{s.grip ? gripLabel(s.grip) : '—'}</span>
										{/each}
									</div>
								</div>
							</div>
						{/each}
						{#if w.note}<p class="text-[12px] text-ink-dim italic">“{w.note}”</p>{/if}
						<button
							type="button"
							class="mt-2 font-mono text-[10px] tracking-wider text-ink-faint uppercase hover:text-flag"
							onclick={() => removeWorkout(idx)}
						>
							✕ {m.btn_delete()}
						</button>
					</AccordionContent>
				</AccordionItem>
			{/each}
		</Accordion>
	{/if}

	<h3 class="mb-2 font-mono text-[11px] tracking-wider text-ink-faint uppercase">{m.log_activity()}</h3>
	{#if appState.log.length === 0}
		<div class="rounded-xl border border-dashed border-line px-5 py-[46px] text-center text-sm text-ink-faint">
			{m.log_empty()}
		</div>
	{:else}
		<div class="flex flex-col gap-2.5">
			{#each appState.log.slice(0, 120) as entry, idx (entry)}
				<div class="flex items-center gap-3.5 rounded-[10px] border border-line bg-panel px-4 py-3.5">
					<span class="w-[90px] flex-none font-mono text-xs text-ink-faint">{entry.date}</span>
					<span
						class="flex-none rounded-md px-2.5 py-1 font-mono text-[10px] font-bold tracking-wide uppercase"
						style:background="color-mix(in srgb, {entry.color} 18%, transparent)"
						style:color={entry.color}
					>
						{typeLabel[entry.type]?.() ?? entry.type}
					</span>
					<span class="flex-1 text-[13px] text-ink-dim">
						<b class="text-chalk">{entry.label}</b>{entry.note ? ` · ${entry.note}` : ''}
					</span>
					<button
						type="button"
						title="delete"
						onclick={() => remove(idx)}
						class="px-1 text-base text-ink-faint transition hover:text-flag"
					>
						✕
					</button>
				</div>
			{/each}
		</div>
	{/if}

	<Button
		variant="outline"
		size="sm"
		onclick={reset}
		class="mt-6 border-line font-mono text-[11px] text-ink-faint hover:border-flag hover:text-flag"
	>
		{m.btn_reset_all()}
	</Button>
</section>
