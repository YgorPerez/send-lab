<script lang="ts">
import { Card, CardContent } from '$lib/components/ui/card';
import { Input } from '$lib/components/ui/input';
import { getContent, visibleQuestionsOrdered } from '$lib/content';
import type { Content } from '$lib/content/types';
import * as m from '$lib/paraglide/messages';
import type { ProbeReadiness } from '$lib/stats';
import { STUDIES } from '$lib/studies';
import { cn } from '$lib/utils';

type Question = Content['quiz'][number];

// The adaptive wellness quiz + the optional objective probe. Builds the display
// order (follow-ups nested under their parent, e.g. severity under `body`) and
// renders it; state lives in the parent and picks are reported back.
let {
	answers,
	onPick,
	probeValue,
	onProbe,
	probeResult,
}: {
	answers: Record<string, number>;
	onPick: (qid: string, value: number) => void;
	probeValue: number | null;
	onProbe: (value: number | null) => void;
	probeResult: ProbeReadiness;
} = $props();

const content = getContent();
const studyUrl = (id?: string) => (id ? STUDIES.find((s) => s.id === id)?.url : undefined);
const items = $derived.by(() => {
	let n = 0;
	const out: { q: Question; sub: boolean; n: number | null }[] = [];
	for (const o of visibleQuestionsOrdered(answers)) {
		const q = content.quiz.find((x) => x.id === o.id);
		if (!q) continue;
		if (!o.sub) n += 1;
		out.push({ q, sub: o.sub, n: o.sub ? null : n });
	}
	return out;
});
</script>

{#snippet body(q: Question)}
	{#if q.why}
		<p class="mb-2 max-w-[60ch] text-[12px] leading-snug text-ink-faint">
			{q.why}{#if studyUrl(q.study)}
				<a
					href={studyUrl(q.study)}
					target="_blank"
					rel="noopener noreferrer"
					class="ml-1 whitespace-nowrap text-flag hover:underline">{m.rd_evidence()}</a
				>{/if}
		</p>
	{/if}
	<div class="flex flex-wrap gap-2">
		{#each q.a as a (a.t)}
			<button
				type="button"
				onclick={() => onPick(q.id, a.v)}
				class={cn(
					'min-w-[120px] flex-1 rounded-[9px] border px-3 py-[11px] text-left text-[13.5px] transition',
					answers[q.id] === a.v
						? 'border-flag bg-flag/10 font-semibold text-chalk'
						: 'border-line bg-panel-2 text-ink-dim hover:border-ink-faint hover:text-ink'
				)}
			>
				{a.t}
			</button>
		{/each}
	</div>
{/snippet}

<Card class="mb-[22px] gap-0 p-6">
	<CardContent class="space-y-[22px] p-0">
		{#each items as item (item.q.id)}
			{#if item.sub}
				<!-- Follow-up: nested under its parent question, slides in on reveal. -->
				<div class="ml-3 border-l-2 border-flag/30 pl-4 motion-preset-slide-down motion-duration-300">
					<div class="mb-1 text-[14px] font-medium">
						<span class="mr-2 font-mono text-xs text-flag">↳</span>{item.q.q}
					</div>
					{@render body(item.q)}
				</div>
			{:else}
				<div class="motion-preset-fade motion-duration-300">
					<div class="mb-1 text-[15px] font-semibold">
						<span class="mr-2 font-mono text-xs text-flag">0{item.n}</span>{item.q.q}
					</div>
					{@render body(item.q)}
				</div>
			{/if}
		{/each}

		<!-- Optional climbing-specific objective probe: a quick max finger pull. -->
		<div class="border-t border-line pt-[22px] motion-preset-fade motion-duration-300">
			<div class="mb-1 text-[15px] font-semibold">
				<span class="mr-2 font-mono text-xs text-flag">+</span>{m.rd_probe_label()}
			</div>
			<p class="mb-2 max-w-[60ch] text-[12px] leading-snug text-ink-faint">
				{m.rd_probe_why()}{#if studyUrl('probe')}
					<a
						href={studyUrl('probe')}
						target="_blank"
						rel="noopener noreferrer"
						class="ml-1 whitespace-nowrap text-flag hover:underline">{m.rd_evidence()}</a
					>{/if}
			</p>
			<div class="flex items-center gap-2">
				<Input
					type="number"
					inputmode="decimal"
					step="any"
					min="0"
					value={probeValue ?? ''}
					oninput={(e) =>
						onProbe(e.currentTarget.value === '' ? null : e.currentTarget.valueAsNumber)}
					placeholder={m.rd_probe_ph()}
					class="w-32 bg-panel-2 text-sm"
				/>
				<span class="text-xs text-ink-faint">kg</span>
				{#if probeResult.baseline != null}
					<span class="font-mono text-[11px] text-ink-faint">
						{m.rd_probe_baseline({ kg: probeResult.baseline })}{#if probeResult.deficitPct != null}
							· <span
								class={cn(
									probeResult.deficitPct >= 6
										? 'text-flag'
										: probeResult.deficitPct <= -5
											? 'text-teal'
											: 'text-ink-faint'
								)}
								>{probeResult.deficitPct > 0 ? '−' : '+'}{Math.abs(probeResult.deficitPct)}%</span
							>{/if}
					</span>
				{:else if probeValue != null}
					<span class="font-mono text-[11px] text-ink-faint">{m.rd_probe_building()}</span>
				{/if}
			</div>
		</div>
	</CardContent>
</Card>
