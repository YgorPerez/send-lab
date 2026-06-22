<script lang="ts">
import PlusIcon from '@lucide/svelte/icons/plus';
import TimerIcon from '@lucide/svelte/icons/timer';
import XIcon from '@lucide/svelte/icons/x';
import { Button } from '$lib/components/ui/button';
import { Card } from '$lib/components/ui/card';
import type { Exercise, Variant } from '$lib/content/types';
import PrescriptionView from '$lib/PrescriptionView.svelte';
import * as m from '$lib/paraglide/messages';
import SetRows from '$lib/SetRows.svelte';
import type { WorkoutSet } from '$lib/state.svelte';
import type { Col } from '$lib/trainColumns';
import { cn } from '$lib/utils';
import VariantPicker from '$lib/VariantPicker.svelte';

interface Item {
	exId: string;
	exName: string;
	idx: number;
	spec: Variant;
	cols: Col[];
	timed: boolean;
}
interface Props {
	it: Item;
	ex: Exercise | undefined;
	sets: WorkoutSet[];
	isActive: boolean;
	onUseTimer: () => void;
	onSelectVariant: (i: number) => void;
	onRemoveItem: () => void;
	onRemoveSet: (i: number) => void;
	onDone: () => void;
	onAddSet: () => void;
}
let {
	it,
	ex,
	sets,
	isActive,
	onUseTimer,
	onSelectVariant,
	onRemoveItem,
	onRemoveSet,
	onDone,
	onAddSet,
}: Props = $props();
</script>

<Card class={cn('gap-2.5 p-4', isActive && 'ring-1 ring-flag/60')}>
	<div class="flex items-start justify-between gap-2">
		<div class="font-bold">{it.exName}</div>
		<div class="flex items-center gap-2">
			{#if it.timed}
				<button
					type="button"
					class={cn('transition', isActive ? 'text-flag' : 'text-ink-faint hover:text-ink')}
					aria-label={m.timer_use()}
					title={m.timer_use()}
					onclick={onUseTimer}
				>
					<TimerIcon class="size-4" />
				</button>
			{/if}
			<button
				type="button"
				class="text-ink-faint transition hover:text-flag"
				aria-label={m.btn_delete()}
				onclick={onRemoveItem}
			>
				<XIcon class="size-4" />
			</button>
		</div>
	</div>
	{#if ex}
		<VariantPicker exercise={ex} idx={it.idx} onSelect={onSelectVariant} />
	{/if}
	<div class="rounded-lg border border-line bg-panel-2 px-3 py-2.5" aria-label={m.train_target()}>
		<PrescriptionView spec={it.spec} />
	</div>

	<SetRows rows={sets} cols={it.cols} onRemove={onRemoveSet} {onDone} />

	<Button variant="outline" size="sm" class="mt-1 self-start border-line text-xs" onclick={onAddSet}>
		<PlusIcon class="mr-1 size-3.5" />{m.train_add_set()}
	</Button>
</Card>
