<script lang="ts">
import { Badge } from '$lib/components/ui/badge';
import { Button } from '$lib/components/ui/button';
import { Card } from '$lib/components/ui/card';
import Prose from '$lib/Prose.svelte';
import * as m from '$lib/paraglide/messages';
import { cn } from '$lib/utils';

// Presentational: the readiness conclusion card (verdict + breakdown + outcome
// capture). Logic stays in the parent; this renders it and reports actions.
let {
	verdict,
	score,
	baselineLabel,
	breakdown,
	scoreNote,
	firstTaskLabel,
	showOutcomeCapture,
	outcomeSaved,
	onRecheck,
	onSetOutcome,
}: {
	verdict: { title: string; tag: string; color: string; text: string; focus: string[] };
	score: number;
	baselineLabel: string | null;
	breakdown: { label: string; v: number }[];
	scoreNote: string;
	firstTaskLabel: string | undefined;
	showOutcomeCapture: boolean;
	outcomeSaved: boolean;
	onRecheck: () => void;
	onSetOutcome: (v: number) => void;
} = $props();
</script>

<Card class="overflow-hidden p-0 animate-in fade-in duration-300">
	<div class="flex items-center gap-3.5 border-b border-line p-5">
		<span class="size-3.5 flex-none rounded-full" style:background={verdict.color}></span>
		<div class="min-w-0 flex-1">
			<div class="text-[19px] font-extrabold tracking-tight">{verdict.title}</div>
			<div class="font-mono text-[11px] tracking-wider text-ink-faint uppercase">
				{verdict.tag}
			</div>
		</div>
		<div class="flex-none text-right">
			<div class="font-mono text-[22px] leading-none font-bold text-chalk">{score}</div>
			<div class="font-mono text-[9px] tracking-wider text-ink-faint uppercase">
				{m.rd_score()}
			</div>
			{#if baselineLabel}
				<div class="mt-0.5 font-mono text-[9px] text-ink-faint">{baselineLabel}</div>
			{/if}
		</div>
	</div>
	<div class="p-5 text-[14.5px] text-ink-dim">
		<div><Prose value={verdict.text} /></div>
		{#if breakdown.length}
			<div class="mt-3 flex flex-wrap gap-1.5">
				{#each breakdown as b (b.label)}
					<span
						class={cn(
							'rounded-full border px-2 py-0.5 font-mono text-[10px]',
							b.v >= 7
								? 'border-teal/40 text-teal'
								: b.v >= 4
									? 'border-gold/40 text-gold'
									: 'border-flag/40 text-flag'
						)}
					>
						{b.label} {b.v}/10
					</span>
				{/each}
			</div>
		{/if}
		<p class="mt-2 text-[11px] leading-snug text-ink-faint italic">{scoreNote}</p>
		{#if firstTaskLabel}
			<p class="mt-2.5 text-[13px] text-ink-faint">
				{m.td_applies()} <b class="text-chalk">{firstTaskLabel}</b>
			</p>
		{/if}
		<div class="mt-3.5 flex flex-wrap gap-2">
			{#each verdict.focus as f, i (f)}
				<Badge
					variant="outline"
					class={cn(
						'border-line font-mono text-[11px] font-normal text-ink-dim',
						i === 0 && 'border-flag text-flag'
					)}
				>
					<Prose value={f} />
				</Badge>
			{/each}
		</div>
		<div class="mt-[18px] flex flex-wrap items-center gap-2.5">
			<Button variant="outline" onclick={onRecheck}>{m.td_recheck()}</Button>
			<Button href="/week" variant="ghost">{m.btn_view_protocol()}</Button>
			<span class="font-mono text-[10px] tracking-wider text-ink-faint uppercase">
				{m.train_autosave()}
			</span>
		</div>

		{#if showOutcomeCapture}
			<div class="mt-4 border-t border-line pt-3.5">
				<div class="mb-2 font-mono text-[10px] tracking-wider text-ink-faint uppercase">
					{m.rd_outcome_q()}
				</div>
				<div class="flex flex-wrap gap-2">
					{#each [{ v: 3, l: m.rd_outcome_strong() }, { v: 2, l: m.rd_outcome_ok() }, { v: 1, l: m.rd_outcome_flat() }, { v: 0, l: m.rd_outcome_bailed() }] as o (o.v)}
						<Button
							variant="outline"
							size="sm"
							class="border-line text-xs"
							onclick={() => onSetOutcome(o.v)}
						>
							{o.l}
						</Button>
					{/each}
				</div>
			</div>
		{:else if outcomeSaved}
			<p class="mt-3 font-mono text-[11px] text-teal">{m.rd_outcome_saved()}</p>
		{/if}
	</div>
</Card>
