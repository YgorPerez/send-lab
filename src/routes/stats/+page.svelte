<script lang="ts">
import Bars from '$lib/Bars.svelte';
import { Card } from '$lib/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
import { getContent } from '$lib/content';
import Prose from '$lib/Prose.svelte';
import * as m from '$lib/paraglide/messages';
import { qualityLabel, regionLabel } from '$lib/plan';
import SectionHeading from '$lib/SectionHeading.svelte';
import { appState } from '$lib/state.svelte';
import {
	dominantField,
	loggedExerciseIds,
	type NumField,
	progression,
	qualityVolume,
	regionVolume,
	rpeHistogram,
	weeklyStats,
} from '$lib/stats';
import TrendChart from '$lib/TrendChart.svelte';

const content = getContent();
const workouts = $derived(appState.workouts);
const loggedIds = $derived(loggedExerciseIds(workouts));

const FIELDS: { key: NumField; label: () => string }[] = [
	{ key: 'weight', label: m.field_weight },
	{ key: 'edge', label: m.field_edge },
	{ key: 'time', label: m.field_time },
	{ key: 'reps', label: m.field_reps },
	{ key: 'rpe', label: m.field_rpe },
];

let pickedEx = $state<string | null>(null);
let pickedField = $state<NumField | null>(null);
const selEx = $derived(pickedEx ?? loggedIds[0] ?? '');
const field = $derived(pickedField ?? (selEx ? dominantField(workouts, selEx) : 'weight'));
const progPoints = $derived(selEx ? progression(workouts, selEx, field) : []);
const pr = $derived(progPoints.length ? Math.max(...progPoints.map((p) => p.value)) : null);
const fieldLabel = $derived(FIELDS.find((f) => f.key === field)?.label() ?? '');

const REGION_COLOR: Record<string, string> = {
	fingers: 'var(--flag)',
	wrist: 'var(--gold)',
	pull: 'var(--violet)',
	antagonist: 'var(--teal)',
};

const regionBars = $derived(
	regionVolume(workouts).map((b) => ({
		label: regionLabel(b.key),
		value: b.value,
		color: REGION_COLOR[b.key],
	})),
);
const qualityBars = $derived(
	qualityVolume(workouts).map((b) => ({ label: qualityLabel(b.key), value: b.value })),
);

const weeks = $derived(weeklyStats(workouts));
const volPoints = $derived(weeks.map((s) => ({ label: s.label, value: s.sets })));
const tonPoints = $derived(
	weeks.filter((s) => s.tonnage > 0).map((s) => ({ label: s.label, value: Math.round(s.tonnage) })),
);
const tutPoints = $derived(
	weeks.filter((s) => s.tut > 0).map((s) => ({ label: s.label, value: s.tut })),
);
const cnsPoints = $derived(weeks.map((s) => ({ label: s.label, value: s.cns })));
const rpeBars = $derived(rpeHistogram(workouts));

const loadCharts = $derived([
	{ title: m.stats_volume(), points: volPoints, color: 'var(--gold)' },
	{ title: m.stats_tonnage(), points: tonPoints, color: 'var(--violet)' },
	{ title: m.stats_tut(), points: tutPoints, color: 'var(--teal)' },
	{ title: m.stats_cns(), points: cnsPoints, color: 'var(--flag)' },
]);
</script>

<section class="animate-in fade-in duration-300">
	<SectionHeading title={m.sec_stats()} />
	<p class="mb-[26px] max-w-[62ch] text-[15px] text-ink-dim"><Prose value={m.lede_stats()} /></p>

	{#if workouts.length === 0}
		<div class="rounded-xl border border-dashed border-line px-5 py-[46px] text-center text-sm text-ink-faint">
			{m.stats_empty()}
		</div>
	{:else}
		<div class="flex flex-col gap-[22px]">
			<!-- Per-exercise progression -->
			<Card class="gap-3 p-[18px]">
				<div class="flex items-center justify-between gap-2">
					<span class="font-bold">{m.stats_progression()}</span>
					{#if pr != null}
						<span class="font-mono text-[11px] text-teal">
							{m.stats_pr()} · {Math.round(pr * 10) / 10}
						</span>
					{/if}
				</div>
				<div class="flex gap-2">
					<Select type="single" value={selEx} onValueChange={(v) => v && (pickedEx = v)}>
						<SelectTrigger class="h-9 flex-1 border-line bg-panel-2 text-xs">
							{content.exercises[selEx]?.name ?? selEx}
						</SelectTrigger>
						<SelectContent>
							{#each loggedIds as id (id)}
								<SelectItem value={id}>{content.exercises[id]?.name ?? id}</SelectItem>
							{/each}
						</SelectContent>
					</Select>
					<Select
						type="single"
						value={field}
						onValueChange={(v) => v && (pickedField = v as NumField)}
					>
						<SelectTrigger class="h-9 w-32 border-line bg-panel-2 text-xs">{fieldLabel}</SelectTrigger>
						<SelectContent>
							{#each FIELDS as f (f.key)}
								<SelectItem value={f.key}>{f.label()}</SelectItem>
							{/each}
						</SelectContent>
					</Select>
				</div>
				{#if progPoints.length}
					<TrendChart points={progPoints} color="var(--flag)" pr />
				{:else}
					<p class="py-6 text-center text-xs text-ink-faint">{m.stats_need_more()}</p>
				{/if}
			</Card>

			<!-- Training balance -->
			<Card class="gap-3 p-[18px]">
				<span class="font-bold">{m.stats_balance()}</span>
				<div class="grid gap-5 sm:grid-cols-2">
					<div>
						<div class="mb-2 font-mono text-[10px] tracking-wider text-ink-faint uppercase">
							{m.stats_by_region()}
						</div>
						<Bars bars={regionBars} unit={m.stats_sets()} />
					</div>
					<div>
						<div class="mb-2 font-mono text-[10px] tracking-wider text-ink-faint uppercase">
							{m.stats_by_quality()}
						</div>
						<Bars bars={qualityBars} unit={m.stats_sets()} />
					</div>
				</div>
			</Card>

			<!-- Load over time -->
			<Card class="gap-3 p-[18px]">
				<span class="font-bold">{m.stats_load()}</span>
				<div class="grid gap-5 sm:grid-cols-2">
					{#each loadCharts as c (c.title)}
						<div>
							<div class="mb-1 font-mono text-[10px] tracking-wider text-ink-faint uppercase">
								{c.title}
							</div>
							{#if c.points.length}
								<TrendChart points={c.points} color={c.color} />
							{:else}
								<p class="py-6 text-center text-xs text-ink-faint">{m.stats_need_more()}</p>
							{/if}
						</div>
					{/each}
				</div>
			</Card>

			<!-- Effort distribution -->
			<Card class="gap-3 p-[18px]">
				<span class="font-bold">{m.stats_rpe()}</span>
				{#if rpeBars.length}
					<Bars bars={rpeBars} />
				{:else}
					<p class="py-2 text-center text-xs text-ink-faint">{m.stats_need_more()}</p>
				{/if}
			</Card>
		</div>
	{/if}
</section>
