<script lang="ts">
import XIcon from '@lucide/svelte/icons/x';
import { Input } from '$lib/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
import * as m from '$lib/paraglide/messages';
import { GRIPS, gripLabel } from '$lib/plan';
import type { WorkoutSet } from '$lib/state.svelte';
import type { Col } from '$lib/trainColumns';
import { showKg, showMm, toKg, toMm } from '$lib/units';
import { cn } from '$lib/utils';

function parseNum(v: string): number | null {
	const n = Number.parseFloat(v);
	return Number.isNaN(n) ? null : n;
}

interface Props {
	rows: WorkoutSet[];
	cols: Col[];
	onRemove: (i: number) => void;
	/** Called when a set is newly marked done (to start the rest timer). */
	onDone?: () => void;
}

let { rows, cols, onRemove, onDone }: Props = $props();
</script>

{#if rows.length > 0}
	<div class="flex flex-col gap-2">
		{#each rows as set, i (i)}
			<div
				class={cn(
					'rounded-lg border border-line bg-panel-2/40 p-2 transition-opacity',
					set.done && 'opacity-45'
				)}
			>
				<div class="mb-1.5 flex items-center justify-between">
					<span class="font-mono text-[10px] tracking-wider text-ink-faint">#{i + 1}</span>
					<div class="flex items-center gap-3">
						<label
							class="flex items-center gap-1.5 font-mono text-[10px] tracking-wider text-ink-faint uppercase"
						>
							<input
								type="checkbox"
								checked={set.done}
								onchange={(e) => {
									set.done = e.currentTarget.checked;
									if (set.done) onDone?.();
								}}
								class="size-4 cursor-pointer accent-teal"
							/>
							{m.lbl_done()}
						</label>
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

				<div class="grid grid-cols-3 gap-2 sm:grid-cols-6">
					{#each cols as col (col.key)}
						<label
							class="flex min-w-0 flex-col gap-0.5 font-mono text-[9px] tracking-wider text-ink-faint uppercase"
						>
							<span class="truncate">{col.label()}</span>
							{#if col.key === 'grip'}
								<Select type="single" value={set.grip ?? ''} onValueChange={(v) => (set.grip = v || null)}>
									<SelectTrigger class="h-8 w-full bg-panel-2 px-2 text-xs normal-case">
										{set.grip ? gripLabel(set.grip) : '—'}
									</SelectTrigger>
									<SelectContent>
										{#each GRIPS as g (g)}
											<SelectItem value={g}>{gripLabel(g)}</SelectItem>
										{/each}
									</SelectContent>
								</Select>
							{:else if col.key === 'weight'}
								<Input
									type="number"
									step="any"
									value={showKg(set.weight)}
									oninput={(e) => (set.weight = parseNum(e.currentTarget.value) == null ? null : toKg(parseNum(e.currentTarget.value)!))}
									class="h-8 w-full bg-panel-2 text-sm"
								/>
							{:else if col.key === 'edge'}
								<Input
									type="number"
									step="any"
									value={showMm(set.edge)}
									oninput={(e) => (set.edge = parseNum(e.currentTarget.value) == null ? null : toMm(parseNum(e.currentTarget.value)!))}
									class="h-8 w-full bg-panel-2 text-sm"
								/>
							{:else}
								<Input type="number" step="any" bind:value={set[col.key]} class="h-8 w-full bg-panel-2 text-sm" />
							{/if}
						</label>
					{/each}
				</div>
			</div>
		{/each}
	</div>
{/if}
