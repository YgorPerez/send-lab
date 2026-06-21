<script lang="ts">
import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
import type { Exercise } from '$lib/content/types';
import * as m from '$lib/paraglide/messages';

interface Props {
	exercise: Exercise;
	idx: number;
	onSelect: (i: number) => void;
}

let { exercise, idx, onSelect }: Props = $props();

const variants = $derived(exercise.variants);
const current = $derived(variants[idx] ?? variants[0]);
// Two-axis (tool + speed) when every variant declares both; else a flat list.
const hasAxes = $derived(variants.every((v) => v.tool && v.speed));
const tools = $derived([...new Set(variants.map((v) => v.tool))].filter((t): t is string => !!t));
const speeds = $derived([...new Set(variants.map((v) => v.speed))].filter((s): s is string => !!s));

function pick(tool: string | undefined, speed: string | undefined) {
	const i = variants.findIndex((v) => v.tool === tool && v.speed === speed);
	if (i >= 0) onSelect(i);
}
</script>

{#if hasAxes}
	<div class="flex gap-2">
		<div class="flex-1">
			<div class="mb-1 font-mono text-[9px] tracking-wider text-ink-faint uppercase">
				{m.var_tool()}
			</div>
			<Select
				type="single"
				value={current.tool}
				onValueChange={(v) => v && pick(v, current.speed)}
			>
				<SelectTrigger class="h-8 w-full border-line bg-panel-2 text-xs">{current.tool}</SelectTrigger>
				<SelectContent>
					{#each tools as t (t)}
						<SelectItem value={t}>{t}</SelectItem>
					{/each}
				</SelectContent>
			</Select>
		</div>
		<div class="flex-1">
			<div class="mb-1 font-mono text-[9px] tracking-wider text-ink-faint uppercase">
				{m.var_speed()}
			</div>
			<Select
				type="single"
				value={current.speed}
				onValueChange={(v) => v && pick(current.tool, v)}
			>
				<SelectTrigger class="h-8 w-full border-line bg-panel-2 text-xs">{current.speed}</SelectTrigger>
				<SelectContent>
					{#each speeds as s (s)}
						<SelectItem value={s}>{s}</SelectItem>
					{/each}
				</SelectContent>
			</Select>
		</div>
	</div>
{:else if variants.length > 1}
	<Select
		type="single"
		value={String(idx)}
		onValueChange={(v) => v != null && onSelect(Number(v))}
	>
		<SelectTrigger class="h-8 w-full border-line bg-panel-2 text-xs">{current.name}</SelectTrigger>
		<SelectContent>
			{#each variants as v, i (i)}
				<SelectItem value={String(i)}>{v.name}</SelectItem>
			{/each}
		</SelectContent>
	</Select>
{/if}
