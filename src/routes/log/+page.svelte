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
import { getLocale } from '$lib/paraglide/runtime';
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

/** Logged time-of-day (HH:MM) for an epoch-ms timestamp. */
const hour = (at: number) =>
	new Date(at).toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' });

/** Map a stored answers map back to readable question → chosen-answer pairs. */
function responses(answers?: Record<string, number>): { q: string; a: string }[] {
	if (!answers) return [];
	const out: { q: string; a: string }[] = [];
	for (const q of content.quiz) {
		const v = answers[q.id];
		if (v == null) continue;
		out.push({ q: q.q, a: q.a.find((o) => o.v === v)?.t ?? String(v) });
	}
	return out;
}

/** The conclusion's flag titles. */
const flagTitles = (flags?: { id: string }[]): string[] =>
	(flags ?? []).map((f) => content.flags[f.id]?.title ?? f.id);
</script>

<section class="animate-in fade-in duration-300">
	<SectionHeading title={m.sec_log()} />
	<p class="mb-[26px] max-w-[62ch] text-[15px] text-ink-dim">{m.lede_log()}</p>

	{#if appState.readinessLog.length > 0}
		<h3 class="mb-2 font-mono text-[11px] tracking-wider text-ink-faint uppercase">
			{m.log_readiness()}
		</h3>
		<Accordion type="multiple" class="mb-6 flex flex-col gap-2.5">
			{#each [...appState.readinessLog].reverse() as r, i (r)}
				{@const v = content.verdicts[r.verdict as VerdictId]}
				<AccordionItem value={`r${i}`} class="rounded-xl border border-line bg-panel last:border-b">
					<AccordionTrigger class="px-4 py-3 hover:no-underline">
						<span class="font-mono text-xs text-ink-faint">{r.date} · {hour(r.at)}</span>
						<span
							class="ml-2 flex-none rounded-md px-2 py-0.5 font-mono text-[11px] font-bold tabular-nums"
							style:background="color-mix(in srgb, {v?.color ?? 'var(--ink-faint)'} 18%, transparent)"
							style:color={v?.color ?? 'var(--ink-faint)'}
						>
							{r.score}
						</span>
						<span class="ml-2 flex-1 text-left text-[13px]">
							<b class="text-chalk">{v?.title ?? r.verdict}</b>{#if r.outcome != null}<span
									class="text-ink-faint"
								>
									· {OUTCOME_LABEL[r.outcome]?.() ?? ''}</span
								>{/if}
						</span>
					</AccordionTrigger>
					<AccordionContent class="px-4 pb-4">
						{#if responses(r.answers).length}
							<div class="mb-1.5 font-mono text-[10px] tracking-wider text-ink-faint uppercase">
								{m.log_rd_responses()}
							</div>
							<div class="mb-3 flex flex-col gap-1">
								{#each responses(r.answers) as row (row.q)}
									<div class="flex items-baseline justify-between gap-3 text-[13px]">
										<span class="text-ink-dim">{row.q}</span>
										<span class="flex-none font-semibold text-chalk">{row.a}</span>
									</div>
								{/each}
							</div>
						{/if}
						<div class="mb-1.5 font-mono text-[10px] tracking-wider text-ink-faint uppercase">
							{m.log_rd_conclusion()}
						</div>
						<p class="text-[13px] text-ink-dim">
							<b class="text-chalk">{v?.title ?? r.verdict}</b>
						</p>
						{#if flagTitles(r.flags).length}
							<div class="mt-2 flex flex-wrap gap-1.5">
								{#each flagTitles(r.flags) as t (t)}
									<span class="rounded-full border border-line px-2 py-0.5 text-[11px] text-ink-dim">
										{t}
									</span>
								{/each}
							</div>
						{/if}
						<button
							type="button"
							class="mt-3 font-mono text-[10px] tracking-wider text-ink-faint uppercase hover:text-flag"
							onclick={() => removeReadiness(r)}
						>
							✕ {m.btn_delete()}
						</button>
					</AccordionContent>
				</AccordionItem>
			{/each}
		</Accordion>
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
