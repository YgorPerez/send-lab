<script lang="ts">
import XIcon from '@lucide/svelte/icons/x';
import { Input } from '$lib/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
import * as m from '$lib/paraglide/messages';
import { GRIPS, gripLabel } from '$lib/plan';
import type { WorkoutSet } from '$lib/state.svelte';
import { cn } from '$lib/utils';

type ColKey = 'weight' | 'edge' | 'time' | 'reps' | 'rest' | 'rpe' | 'grip';
interface Col {
	key: ColKey;
	label: () => string;
}
interface Props {
	rows: WorkoutSet[];
	cols: Col[];
	onRemove: (i: number) => void;
}

let { rows, cols, onRemove }: Props = $props();

const grid = $derived(`grid-template-columns:repeat(${cols.length},minmax(54px,1fr)) auto`);
</script>

{#if rows.length > 0}
	<div class="flex flex-col gap-1.5 overflow-x-auto">
		<div class="grid gap-1.5 text-[10px] text-ink-faint" style={grid}>
			{#each cols as col (col.key)}
				<span class="truncate">{col.label()}</span>
			{/each}
			<span></span>
		</div>
		{#each rows as set, i (i)}
			<div
				class={cn('grid items-center gap-1.5 transition-opacity', set.done && 'opacity-45')}
				style={grid}
			>
				{#each cols as col (col.key)}
					{#if col.key === 'grip'}
						<Select type="single" value={set.grip ?? ''} onValueChange={(v) => (set.grip = v || null)}>
							<SelectTrigger class="h-8 bg-panel-2 px-2 text-xs">
								{set.grip ? gripLabel(set.grip) : '—'}
							</SelectTrigger>
							<SelectContent>
								{#each GRIPS as g (g)}
									<SelectItem value={g}>{gripLabel(g)}</SelectItem>
								{/each}
							</SelectContent>
						</Select>
					{:else}
						<Input
							type="number"
							step="any"
							bind:value={set[col.key]}
							class="h-8 bg-panel-2 text-sm"
						/>
					{/if}
				{/each}
				<div class="flex items-center gap-1.5">
					<input
						type="checkbox"
						bind:checked={set.done}
						class="size-4 cursor-pointer accent-teal"
						aria-label={m.lbl_done()}
						title={m.lbl_done()}
					/>
					<button
						type="button"
						class="text-ink-faint transition hover:text-flag"
						aria-label={m.btn_delete()}
						onclick={() => onRemove(i)}
					>
						<XIcon class="size-4" />
					</button>
				</div>
			</div>
		{/each}
	</div>
{/if}
