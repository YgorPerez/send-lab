<script lang="ts">
import InfoIcon from '@lucide/svelte/icons/info';
import TimerIcon from '@lucide/svelte/icons/timer';
import { toast } from 'svelte-sonner';
import { Button } from '$lib/components/ui/button';
import { Card } from '$lib/components/ui/card';
import { Input } from '$lib/components/ui/input';
import { getContent, type MetricId } from '$lib/content';
import Modal from '$lib/Modal.svelte';
import Prose from '$lib/Prose.svelte';
import * as m from '$lib/paraglide/messages';
import SectionHeading from '$lib/SectionHeading.svelte';
import Sparkline from '$lib/Sparkline.svelte';
import { appState, round, today } from '$lib/state.svelte';
import { configureTimer } from '$lib/timerStore.svelte';
import { cn } from '$lib/utils';

const content = getContent();
let inputs = $state<Record<string, string>>({});

type Metric = (typeof content.metrics)[number];
let openMetric = $state<Metric | null>(null);

interface TestProtocol {
	prepare: number;
	work: number;
	rest: number;
	rounds: number;
	sets: number;
	setRest: number;
}
// Timer protocol for the assessment, where the test is timed (5s get-ready).
const TEST: Partial<Record<MetricId, TestProtocol>> = {
	rfd: { prepare: 5, work: 5, rest: 0, rounds: 1, sets: 3, setRest: 120 },
	contact: { prepare: 5, work: 3, rest: 0, rounds: 1, sets: 3, setRest: 120 },
	cf: { prepare: 5, work: 7, rest: 3, rounds: 20, sets: 1, setRest: 0 },
	pinch: { prepare: 5, work: 7, rest: 0, rounds: 1, sets: 3, setRest: 120 },
	maxhang: { prepare: 5, work: 10, rest: 0, rounds: 1, sets: 3, setRest: 180 },
};

function sendToTimer(metric: Metric) {
	const t = TEST[metric.id];
	if (!t) return;
	configureTimer({ name: metric.name, key: `test:${metric.id}`, ...t }, true);
	toast.success(m.toast_timer_loaded({ name: metric.name }));
	openMetric = null;
}

function deltaFor(data: { v: number }[]): { text: string; cls: string } {
	if (data.length > 1) {
		const d = data[data.length - 1].v - data[data.length - 2].v;
		if (d > 0) return { text: `▲ +${round(d)}`, cls: 'text-teal' };
		if (d < 0) return { text: `▼ ${round(d)}`, cls: 'text-flag' };
		return { text: m.delta_nochange(), cls: 'text-ink-faint' };
	}
	if (data.length === 1) return { text: m.delta_first(), cls: 'text-ink-faint' };
	return { text: '', cls: 'text-ink-faint' };
}

function saveMetric(id: MetricId, name: string, unit: string, cat: string) {
	const v = parseFloat(inputs[id] ?? '');
	if (Number.isNaN(v)) {
		toast.error(m.toast_enter_number());
		return;
	}
	appState.metrics[id].push({ date: today(), v });
	appState.log.unshift({
		date: today(),
		type: 'test',
		label: `${name}: ${round(v)} ${unit}`,
		color: `var(${cat})`,
		note: m.metric_test_note(),
	});
	inputs[id] = '';
	toast.success(m.toast_metric_saved({ name }));
}
</script>

<section class="animate-in fade-in duration-300">
	<SectionHeading title={m.sec_metrics()} />
	<p class="mb-[26px] max-w-[62ch] text-[15px] text-ink-dim">
		<Prose value={m.lede_metrics()} />
	</p>

	<div class="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
		{#each content.metrics as metric (metric.id)}
			{@const data = appState.metrics[metric.id] ?? []}
			{@const last = data.length ? data[data.length - 1].v : null}
			{@const delta = deltaFor(data)}
			<Card class="gap-0 p-[18px]">
				<div class="mb-1 flex items-center justify-between gap-2">
					<span class="text-[14.5px] font-bold">{metric.name}</span>
					<div class="flex items-center gap-2">
						<span
							class="font-mono text-[10px] font-bold tracking-wider"
							style:color="var({metric.cat})"
						>
							<Prose value={metric.abbr} />
						</span>
						<button
							type="button"
							class="text-ink-faint transition hover:text-ink"
							aria-label={m.metric_howto()}
							title={m.metric_howto()}
							onclick={() => (openMetric = metric)}
						>
							<InfoIcon class="size-3.5" />
						</button>
					</div>
				</div>
				<div class="mb-3.5 text-xs leading-snug text-ink-faint"><Prose value={metric.desc} /></div>
				<div>
					<span class="font-mono text-[30px] leading-none font-bold text-chalk">
						{last != null ? round(last) : '—'}
					</span>
					<span class="text-[13px] text-ink-faint">{metric.unit}</span>
				</div>
				<div class={cn('mt-1.5 font-mono text-xs', delta.cls)}>{delta.text}</div>
				<Sparkline {data} catVar={metric.cat} />
				<div class="mt-3.5 flex gap-2">
					<Input
						type="number"
						step="any"
						placeholder={m.metric_input_ph({ abbr: metric.abbr.toLowerCase() })}
						bind:value={inputs[metric.id]}
						class="border-line bg-panel-2 font-mono text-[13px]"
					/>
					<Button
						variant="secondary"
						size="sm"
						class="bg-chalk text-bg hover:bg-chalk/90"
						onclick={() => saveMetric(metric.id, metric.name, metric.unit, metric.cat)}
					>
						{m.btn_save()}
					</Button>
				</div>
			</Card>
		{/each}
	</div>
</section>

{#if openMetric}
	{@const protocol = TEST[openMetric.id]}
	<Modal open={true} title={openMetric.name} onClose={() => (openMetric = null)}>
		<div class="mb-1 font-mono text-[10px] tracking-wider text-ink-faint uppercase">
			{m.metric_howto()}
		</div>
		<p class="mb-3 text-sm leading-relaxed text-ink-dim"><Prose value={openMetric.desc} /></p>
		<div class="mb-4 font-mono text-xs text-ink-faint">
			{m.metric_unit_label()}: <span class="text-chalk">{openMetric.unit}</span>
		</div>
		{#if protocol}
			<div
				class="mb-3 rounded-lg border border-line bg-panel-2 px-3 py-2.5 font-mono text-xs text-chalk"
			>
				{protocol.work}s × {protocol.sets}
				{m.timer_sets().toLowerCase()}{#if protocol.rounds > 1} · {protocol.rounds}×{/if}{#if protocol.setRest > 0}
					· {protocol.setRest}s {m.timer_setrest().toLowerCase()}{/if}
			</div>
			<Button
				class="w-full bg-flag text-white hover:bg-flag/90"
				onclick={() => openMetric && sendToTimer(openMetric)}
			>
				<TimerIcon class="mr-1.5 size-4" />{m.metric_send_timer()}
			</Button>
		{/if}
	</Modal>
{/if}
