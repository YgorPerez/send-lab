<script lang="ts">
import InfoIcon from '@lucide/svelte/icons/info';
import { toast } from 'svelte-sonner';
import { Button } from '$lib/components/ui/button';
import { Card } from '$lib/components/ui/card';
import { Input } from '$lib/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
import { gradeIndex, gradeLabel, gradeScale, isGradeMetric } from '$lib/grades';
import Prose from '$lib/Prose.svelte';
import * as m from '$lib/paraglide/messages';
import Sparkline from '$lib/Sparkline.svelte';
import { appState, type MetricEntry, round, today } from '$lib/state.svelte';
import {
	type Confidence,
	defaultMm,
	maxhangStrength,
	pinchStrength,
	SIZED_METRICS,
} from '$lib/strength';
import { metricUnit, showKg, showMetric, showMm, toMetricCanonical, toMm } from '$lib/units';
import { cn } from '$lib/utils';

interface Metric {
	id: string;
	name: string;
	abbr: string;
	cat: string;
	unit: string;
	desc: string;
}
let { metric, onInfo }: { metric: Metric; onInfo: (m: Metric) => void } = $props();

const id = $derived(metric.id);
const data = $derived(appState.metrics[id] ?? []);
const last = $derived<MetricEntry | null>(data.length ? data[data.length - 1] : null);
const grade = $derived(isGradeMetric(id));
const sized = $derived(SIZED_METRICS.has(id));

let value = $state('');
let mmValue = $state('');

const CONF: Record<Confidence, { label: () => string; cls: string }> = {
	high: { label: m.conf_high, cls: 'border-teal/40 text-teal' },
	med: { label: m.conf_med, cls: 'border-gold/40 text-gold' },
	low: { label: m.conf_low, cls: 'border-flag/40 text-flag' },
};

/** Latest logged bodyweight (kg), else the assessment's. */
function latestBw(): number | null {
	const h = appState.metrics.bodyweight;
	return h.length ? h[h.length - 1].v : (appState.assessment?.bodyweight ?? null);
}

function estimate(e: MetricEntry) {
	const mm = e.mm ?? defaultMm(id);
	if (id === 'maxhang') return maxhangStrength(e.v, mm, e.bw ?? latestBw());
	if (id === 'pinch') return pinchStrength(e.v, mm);
	return null;
}

const est = $derived(sized && last ? estimate(last) : null);
// Sparkline trends the normalized index for sized markers, raw value otherwise.
const spark = $derived(data.map((e) => ({ v: sized ? (estimate(e)?.index ?? 0) : e.v })));

function logEntry(label: string) {
	appState.log.unshift({
		date: today(),
		type: 'test',
		label,
		color: `var(${metric.cat})`,
		note: m.metric_test_note(),
	});
	toast.success(m.toast_metric_saved({ name: metric.name }));
}

function saveNumeric() {
	const entered = Number.parseFloat(value);
	if (Number.isNaN(entered)) {
		toast.error(m.toast_enter_number());
		return;
	}
	const entry: MetricEntry = { date: today(), v: toMetricCanonical(id, entered) };
	if (sized) {
		const mmRaw = Number.parseFloat(mmValue);
		entry.mm = Number.isNaN(mmRaw) ? defaultMm(id) : Math.round(toMm(mmRaw));
		if (id === 'maxhang') entry.bw = latestBw() ?? undefined;
	}
	if (!appState.metrics[id]) appState.metrics[id] = [];
	appState.metrics[id].push(entry);
	const size = sized ? ` @ ${showMm(entry.mm ?? null)}${appState.prefs.length}` : '';
	logEntry(
		`${metric.name}: ${round(showMetric(id, entry.v))} ${metricUnit(id, metric.unit)}${size}`,
	);
	value = '';
	mmValue = '';
}

function saveGrade(label: string) {
	const v = gradeIndex(id, label);
	if (v < 0) return;
	if (!appState.metrics[id]) appState.metrics[id] = [];
	appState.metrics[id].push({ date: today(), v });
	logEntry(`${metric.name}: ${label}`);
}
</script>

<Card class="gap-0 p-[18px]">
	<div class="mb-1 flex items-center justify-between gap-2">
		<span class="text-[14.5px] font-bold">{metric.name}</span>
		<div class="flex items-center gap-2">
			<span class="font-mono text-[10px] font-bold tracking-wider" style:color="var({metric.cat})">
				<Prose value={metric.abbr} />
			</span>
			<button
				type="button"
				class="text-ink-faint transition hover:text-ink"
				aria-label={m.metric_howto()}
				title={m.metric_howto()}
				onclick={() => onInfo(metric)}
			>
				<InfoIcon class="size-3.5" />
			</button>
		</div>
	</div>
	<div class="mb-3.5 text-xs leading-snug text-ink-faint"><Prose value={metric.desc} /></div>

	{#if sized}
		<div class="flex items-baseline gap-2">
			<span class="font-mono text-[30px] leading-none font-bold text-chalk">{est?.index ?? '—'}</span>
			{#if est}
				<span
					class={cn('rounded-full border px-2 py-0.5 font-mono text-[9px] tracking-wide uppercase', CONF[est.confidence].cls)}
				>
					{CONF[est.confidence].label()}
				</span>
			{/if}
		</div>
		<div class="mt-1 font-mono text-[10px] text-ink-faint">
			{#if last}
				{m.metric_strength()} · {round(showMetric(id, last.v))}{metricUnit(id, metric.unit)} @ {showMm(
					last.mm ?? defaultMm(id),
				)}{appState.prefs.length}
			{:else}
				{m.metric_strength()}
			{/if}
		</div>
	{:else}
		<div>
			<span class="font-mono text-[30px] leading-none font-bold text-chalk">
				{#if grade}
					{last ? gradeLabel(id, last.v) : '—'}
				{:else}
					{last ? round(showMetric(id, last.v)) : '—'}
				{/if}
			</span>
			{#if !grade}
				<span class="text-[13px] text-ink-faint">{metricUnit(id, metric.unit)}</span>
			{/if}
		</div>
	{/if}

	<Sparkline data={spark} catVar={metric.cat} />

	<div class="mt-3.5 flex gap-2">
		{#if grade}
			<Select
				type="single"
				value={last ? gradeLabel(id, last.v) : ''}
				onValueChange={(v) => v && saveGrade(v)}
			>
				<SelectTrigger class="w-full border-line bg-panel-2 font-mono text-[13px]">
					{last ? gradeLabel(id, last.v) : m.metric_pick_grade()}
				</SelectTrigger>
				<SelectContent>
					{#each gradeScale(id) as g (g)}<SelectItem value={g}>{g}</SelectItem>{/each}
				</SelectContent>
			</Select>
		{:else}
			<Input
				type="number"
				step="any"
				placeholder={m.metric_input_ph({ abbr: metric.abbr.toLowerCase() })}
				bind:value
				class="border-line bg-panel-2 font-mono text-[13px]"
			/>
			{#if sized}
				<Input
					type="number"
					step="any"
					placeholder={appState.prefs.length}
					bind:value={mmValue}
					class="w-16 border-line bg-panel-2 text-center font-mono text-[13px]"
				/>
			{/if}
			<Button
				variant="secondary"
				size="sm"
				class="bg-chalk text-bg hover:bg-chalk/90"
				onclick={saveNumeric}
			>
				{m.btn_save()}
			</Button>
		{/if}
	</div>
</Card>
