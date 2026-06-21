<script lang="ts">
import { toast } from 'svelte-sonner';
import { Button } from '$lib/components/ui/button';
import { Card } from '$lib/components/ui/card';
import { Input } from '$lib/components/ui/input';
import { getContent, type MetricId } from '$lib/content';
import Prose from '$lib/Prose.svelte';
import * as m from '$lib/paraglide/messages';
import SectionHeading from '$lib/SectionHeading.svelte';
import Sparkline from '$lib/Sparkline.svelte';
import { appState, round, today } from '$lib/state.svelte';
import { cn } from '$lib/utils';

const content = getContent();
let inputs = $state<Record<string, string>>({});

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
				<div class="mb-1 flex items-baseline justify-between">
					<span class="text-[14.5px] font-bold">{metric.name}</span>
					<span
						class="font-mono text-[10px] font-bold tracking-wider"
						style:color="var({metric.cat})"
					>
						<Prose value={metric.abbr} />
					</span>
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
