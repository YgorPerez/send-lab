<script lang="ts">
import { toast } from 'svelte-sonner';
import { Button } from '$lib/components/ui/button';
import { type DeepBand, type DeepResult, type FlagArea, getContent, scoreDeep } from '$lib/content';
import Modal from '$lib/Modal.svelte';
import Prose from '$lib/Prose.svelte';
import * as m from '$lib/paraglide/messages';
import { startRehab } from '$lib/plan';
import { appState, today } from '$lib/state.svelte';
import { cn } from '$lib/utils';

let { area, onClose }: { area: FlagArea; onClose: () => void } = $props();

const content = getContent();
const da = $derived(content.deep[area]);

let answers = $state<Record<string, number>>({});
const complete = $derived(da ? Object.keys(answers).length === da.questions.length : false);
const result = $derived<DeepResult | null>(
	complete && da ? scoreDeep(da.questions.map((q) => answers[q.id])) : null,
);
const last = $derived([...appState.deepLog].reverse().find((e) => e.area === area));

const BAND_LABEL: Record<DeepBand, () => string> = {
	manageable: m.deep_band_manageable,
	moderate: m.deep_band_moderate,
	significant: m.deep_band_significant,
};
const BAND_REC: Record<DeepBand, () => string> = {
	manageable: m.deep_rec_manageable,
	moderate: m.deep_rec_moderate,
	significant: m.deep_rec_significant,
};
const BAND_COLOR: Record<DeepBand, string> = {
	manageable: 'text-teal',
	moderate: 'text-gold',
	significant: 'text-flag',
};
const STAGE_LABEL = {
	acute: m.deep_stage_acute,
	subacute: m.deep_stage_subacute,
	returning: m.deep_stage_returning,
};

function pick(qid: string, v: number) {
	answers = { ...answers, [qid]: v };
}

function save() {
	if (!result) return;
	appState.deepLog.push({ date: today(), area, score: result.score, band: result.band });
	toast.success(m.deep_saved());
}

function rehabPlan() {
	if (!result) return;
	startRehab(content, area, result.stage);
	onClose();
}
</script>

{#if da}
	<Modal open={true} title={da.title} onClose={onClose}>
		<p class="mb-2 text-sm text-ink-dim">{da.intro}</p>
		{#if last}
			<p class="mb-3 font-mono text-[11px] text-ink-faint">
				{m.deep_last({ score: last.score, date: last.date })}
			</p>
		{/if}

		<div class="flex flex-col gap-4">
			{#each da.questions as q, qi (q.id)}
				<div>
					<div class="mb-2 text-[14px] font-medium">
						<span class="mr-2 font-mono text-xs text-flag">0{qi + 1}</span>{q.q}
					</div>
					<div class="flex flex-wrap gap-1.5">
						{#each q.a as a (a.t)}
							<button
								type="button"
								onclick={() => pick(q.id, a.v)}
								class={cn(
									'rounded-md border px-2.5 py-1.5 text-[12.5px] transition',
									answers[q.id] === a.v
										? 'border-flag bg-flag/10 font-semibold text-chalk'
										: 'border-line bg-panel-2 text-ink-dim hover:text-ink'
								)}
							>
								{a.t}
							</button>
						{/each}
					</div>
				</div>
			{/each}
		</div>

		{#if result}
			<div class="mt-4 rounded-xl border border-line bg-panel-2 p-4 animate-in fade-in duration-300">
				<div class="flex items-baseline gap-2">
					<span class="font-mono text-[30px] leading-none font-bold text-chalk">{result.score}</span>
					<span class="text-sm text-ink-faint">/100</span>
					<span class={cn('ml-auto font-mono text-xs font-bold tracking-wider uppercase', BAND_COLOR[result.band])}>
						{BAND_LABEL[result.band]()}
					</span>
				</div>
				<p class="mt-2.5 text-[13.5px] text-ink-dim">{BAND_REC[result.band]()}</p>
				<div class="mt-3.5 flex flex-wrap gap-2">
					<Button size="sm" class="bg-chalk text-bg hover:bg-chalk/90" onclick={save}>
						{m.deep_save()}
					</Button>
					<Button size="sm" variant="outline" class="border-line text-xs" onclick={rehabPlan}>
						{m.deep_start_rehab()} · {STAGE_LABEL[result.stage]()}
					</Button>
				</div>
			</div>
		{/if}

		<p class="mt-4 text-[11px] leading-snug text-ink-faint">
			{m.deep_based_on({ source: da.source })}
			<a href={da.url} target="_blank" rel="noopener noreferrer" class="text-flag hover:underline">
				{m.deep_source_link()}
			</a>
		</p>
	</Modal>
{/if}
