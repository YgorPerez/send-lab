<script lang="ts">
import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
import ChevronUpIcon from '@lucide/svelte/icons/chevron-up';
import XIcon from '@lucide/svelte/icons/x';
import { Input } from '$lib/components/ui/input';
import type { Content, Range } from '$lib/content/types';
import * as m from '$lib/paraglide/messages';
import {
	moveProgramExercise,
	programTarget,
	programVariantIndex,
	removeProgramExercise,
	setProgramTarget,
	variantOf,
} from '$lib/plan';
import { appState } from '$lib/state.svelte';
import { showKg, showMm, toKg, toMm } from '$lib/units';
import VariantPicker from '$lib/VariantPicker.svelte';

interface Props {
	content: Content;
	weekday: string;
	exId: string;
	first: boolean;
	last: boolean;
}
let { content, weekday, exId, first, last }: Props = $props();

const ex = $derived(content.exercises[exId]);
const idx = $derived(programVariantIndex(weekday, exId));
const base = $derived(ex ? variantOf(ex, idx) : undefined);
const target = $derived(programTarget(weekday, exId));

type Key = 'sets' | 'reps' | 'loadKg' | 'edgeMm' | 'workSec' | 'restSec' | 'rpe';
const mid = (r: Range): number => Math.round((r.min + r.max) / 2);
const show = (conv: string, v: number): number =>
	conv === 'kg' ? (showKg(v) ?? v) : conv === 'mm' ? (showMm(v) ?? v) : v;
const canon = (conv: string, v: number): number =>
	conv === 'kg' ? toKg(v) : conv === 'mm' ? toMm(v) : v;

// Only the fields this exercise actually prescribes get an override input.
const fields = $derived(
	(
		[
			{ key: 'sets', label: m.presc_sets(), range: base?.sets, conv: '' },
			{ key: 'reps', label: m.field_reps(), range: base?.reps, conv: '' },
			{
				key: 'loadKg',
				label: `${m.field_weight()} (${appState.prefs.weight})`,
				range: base?.loadKg,
				conv: 'kg',
			},
			{
				key: 'edgeMm',
				label: `${m.field_edge()} (${appState.prefs.length})`,
				range: base?.edgeMm,
				conv: 'mm',
			},
			{ key: 'workSec', label: m.field_time(), range: base?.workSec, conv: '' },
			{ key: 'restSec', label: m.field_rest(), range: base?.restSec, conv: '' },
			{ key: 'rpe', label: m.field_rpe(), range: base?.rpe, conv: '' },
		] as { key: Key; label: string; range?: Range; conv: string }[]
	).filter((f): f is { key: Key; label: string; range: Range; conv: string } => f.range != null),
);

function onInput(key: Key, conv: string, raw: string) {
	const v = raw.trim() === '' ? undefined : canon(conv, Number(raw));
	setProgramTarget(weekday, exId, { [key]: v });
}
</script>

{#if ex}
	<div class="flex flex-col gap-2 rounded-lg border border-line bg-panel-2 p-2.5">
		<div class="flex items-center gap-1.5">
			<div class="flex flex-col">
				<button
					type="button"
					disabled={first}
					onclick={() => moveProgramExercise(content, weekday, exId, -1)}
					aria-label="up"
					class="text-ink-faint transition hover:text-ink disabled:opacity-30"
				>
					<ChevronUpIcon class="size-3.5" />
				</button>
				<button
					type="button"
					disabled={last}
					onclick={() => moveProgramExercise(content, weekday, exId, 1)}
					aria-label="down"
					class="text-ink-faint transition hover:text-ink disabled:opacity-30"
				>
					<ChevronDownIcon class="size-3.5" />
				</button>
			</div>
			<span class="flex-1 text-[13px] font-semibold text-chalk">{ex.name}</span>
			<button
				type="button"
				class="text-ink-faint transition hover:text-flag"
				aria-label={m.btn_delete()}
				onclick={() => removeProgramExercise(content, weekday, exId)}
			>
				<XIcon class="size-3.5" />
			</button>
		</div>

		{#if ex.variants.length > 1}
			<VariantPicker
				exercise={ex}
				{idx}
				onSelect={(i) => setProgramTarget(weekday, exId, { variant: i })}
			/>
		{/if}

		{#if fields.length}
			<div class="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
				{#each fields as f (f.key)}
					<label class="flex flex-col gap-0.5 font-mono text-[9px] tracking-wider text-ink-faint uppercase">
						{f.label}
						<Input
							type="number"
							value={target?.[f.key] != null ? show(f.conv, target[f.key] as number) : ''}
							placeholder={String(show(f.conv, mid(f.range)))}
							oninput={(e) => onInput(f.key, f.conv, e.currentTarget.value)}
							class="h-7 bg-panel text-center text-xs"
						/>
					</label>
				{/each}
			</div>
		{/if}
	</div>
{/if}
