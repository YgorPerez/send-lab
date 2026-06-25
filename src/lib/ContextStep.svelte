<script lang="ts">
import { Input } from '$lib/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
import { BOULDER_SCALE, ROUTE_SCALE } from '$lib/grades';
import PainCheck from '$lib/PainCheck.svelte';
import * as m from '$lib/paraglide/messages';
import type { Equipment } from '$lib/state.svelte';
import { cn } from '$lib/utils';

// Step 2 of the assessment: gear, grades, birth date, session length, pain check.
let {
	equipment = $bindable(),
	boulderGrade = $bindable(),
	routeGrade = $bindable(),
	birthDate = $bindable(),
	sessionMinutes = $bindable(),
	niggle = $bindable(),
	synovitis = $bindable(),
}: {
	equipment: Equipment[];
	boulderGrade: string;
	routeGrade: string;
	birthDate: string | null;
	sessionMinutes: number | null;
	niggle: boolean;
	synovitis: boolean;
} = $props();

const EQUIPMENT: Equipment[] = ['hangboard', 'board', 'rings', 'weights'];
const equipLabel: Record<Equipment, () => string> = {
	hangboard: m.equip_hangboard,
	board: m.equip_board,
	rings: m.equip_rings,
	weights: m.equip_weights,
};
function toggleEquip(e: Equipment) {
	equipment = equipment.includes(e) ? equipment.filter((x) => x !== e) : [...equipment, e];
}
</script>

<p class="text-xs text-ink-faint">{m.welcome_context_help()}</p>
<div class="flex flex-col gap-1.5">
	<span class="text-xs text-ink-dim">{m.field_equipment()}</span>
	<div class="flex flex-wrap gap-1.5">
		{#each EQUIPMENT as eq (eq)}
			<button
				type="button"
				onclick={() => toggleEquip(eq)}
				aria-pressed={equipment.includes(eq)}
				class={cn(
					'rounded-md border px-2.5 py-1 text-xs transition',
					equipment.includes(eq)
						? 'border-flag bg-flag/15 text-flag'
						: 'border-line text-ink-faint hover:text-ink'
				)}
			>
				{equipLabel[eq]()}
			</button>
		{/each}
	</div>
</div>
<div class="grid grid-cols-2 gap-3">
	<label class="flex flex-col gap-1.5 text-xs text-ink-dim">
		{m.field_boulder_grade()}
		<Select type="single" value={boulderGrade} onValueChange={(v) => (boulderGrade = v ?? '')}>
			<SelectTrigger class="bg-panel-2">{boulderGrade || '—'}</SelectTrigger>
			<SelectContent>
				{#each BOULDER_SCALE as g (g)}<SelectItem value={g}>{g}</SelectItem>{/each}
			</SelectContent>
		</Select>
	</label>
	<label class="flex flex-col gap-1.5 text-xs text-ink-dim">
		{m.field_route_grade()}
		<Select type="single" value={routeGrade} onValueChange={(v) => (routeGrade = v ?? '')}>
			<SelectTrigger class="bg-panel-2">{routeGrade || '—'}</SelectTrigger>
			<SelectContent>
				{#each ROUTE_SCALE as g (g)}<SelectItem value={g}>{g}</SelectItem>{/each}
			</SelectContent>
		</Select>
	</label>
	<label class="flex flex-col gap-1.5 text-xs text-ink-dim">
		{m.field_birthdate()}
		<Input type="date" bind:value={birthDate} class="bg-panel-2" />
	</label>
	<label class="flex flex-col gap-1.5 text-xs text-ink-dim">
		{m.field_session()}
		<Input type="number" min="0" bind:value={sessionMinutes} class="bg-panel-2" />
	</label>
</div>
<PainCheck bind:niggle={niggle} bind:synovitis={synovitis} />
