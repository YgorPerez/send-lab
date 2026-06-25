<script lang="ts">
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from '$lib/components/ui/accordion';
import { getContent } from '$lib/content';
import type { VerdictId } from '$lib/content/types';
import * as m from '$lib/paraglide/messages';
import SectionHeading from '$lib/SectionHeading.svelte';
import SetRows from '$lib/SetRows.svelte';
import { appState } from '$lib/state.svelte';
import type { Col } from '$lib/trainColumns';
import { edgeLabel, weightLabel } from '$lib/units';

// Editable columns for past-workout sets (all fields; values are unit-aware).
const LOG_COLS: Col[] = [
	{ key: 'weight', label: weightLabel },
	{ key: 'edge', label: edgeLabel },
	{ key: 'time', label: m.field_time },
	{ key: 'reps', label: m.field_reps },
	{ key: 'grip', label: m.field_grip },
	{ key: 'rest', label: m.field_rest },
	{ key: 'rpe', label: m.field_rpe },
];

const typeLabel: Record<string, () => string> = {
	rec: m.log_type_rec,
	day: m.log_type_day,
	test: m.log_type_test,
};

const content = getContent();
// Post-session outcome, indexed by the stored value: 0 bailed · 1 flat · 2 as
// expected · 3 strong.
const OUTCOME_LABEL = [
	m.rd_outcome_bailed,
	m.rd_outcome_flat,
	m.rd_outcome_ok,
	m.rd_outcome_strong,
];

function remove(idx: number) {
	appState.log.splice(idx, 1);
}
function removeWorkout(idx: number) {
	appState.workouts.splice(idx, 1);
}
// readinessLog is stored oldest→newest, so removal is by identity (the list is
// reversed for display).
function removeReadiness(entry: (typeof appState.readinessLog)[number]) {
	const i = appState.readinessLog.indexOf(entry);
	if (i >= 0) appState.readinessLog.splice(i, 1);
}
</script>

<section class="animate-in fade-in duration-300">
	<SectionHeading title={m.sec_log()} />
	<p class="mb-[26px] max-w-[62ch] text-[15px] text-ink-dim">{m.lede_log()}</p>

	{#if appState.readinessLog.length > 0}
		<h3 class="mb-2 font-mono text-[11px] tracking-wider text-ink-faint uppercase">
			{m.log_readiness()}
		</h3>
		<div class="mb-6 flex flex-col gap-2.5">
			{#each [...appState.readinessLog].reverse() as r (r)}
				{@const v = content.verdicts[r.verdict as VerdictId]}
				<div class="flex items-center gap-3.5 rounded-[10px] border border-line bg-panel px-4 py-3.5">
					<span class="w-[90px] flex-none font-mono text-xs text-ink-faint">{r.date}</span>
					<span
						class="flex-none rounded-md px-2.5 py-1 font-mono text-[11px] font-bold tabular-nums"
						style:background="color-mix(in srgb, {v?.color ?? 'var(--ink-faint)'} 18%, transparent)"
						style:color={v?.color ?? 'var(--ink-faint)'}
					>
						{r.score}
					</span>
					<span class="flex-1 text-[13px] text-ink-dim">
						<b class="text-chalk">{v?.title ?? r.verdict}</b>{#if r.outcome != null}
							· <span class="text-ink-faint">{OUTCOME_LABEL[r.outcome]?.() ?? ''}</span>
						{/if}
					</span>
					<button
						type="button"
						title={m.btn_delete()}
						onclick={() => removeReadiness(r)}
						class="px-1 text-base text-ink-faint transition hover:text-flag"
					>
						✕
					</button>
				</div>
			{/each}
		</div>
	{/if}

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
								<SetRows rows={ex.sets} cols={LOG_COLS} onRemove={(i) => ex.sets.splice(i, 1)} />
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
</section>
