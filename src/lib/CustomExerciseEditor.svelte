<script lang="ts">
import { untrack } from 'svelte';
import { toast } from 'svelte-sonner';
import { Button } from '$lib/components/ui/button';
import { Input } from '$lib/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
import type { CustomExercise, Variant } from '$lib/content/types';
import { isValidExerciseId, sanitizeCustomExercise } from '$lib/customExercise';
import Modal from '$lib/Modal.svelte';
import * as m from '$lib/paraglide/messages';
import { appState } from '$lib/state.svelte';
import { showKg, showMm, toKg, toMm } from '$lib/units';

let { editId = null, onClose }: { editId?: string | null; onClose: () => void } = $props();

const COLORS = ['--flag', '--gold', '--teal', '--violet', '--ink-faint'];
const GRIPS = ['', 'half-crimp', 'open-hand', 'full-crimp', 'pinch', 'sloper', 'wrist', 'jug'];
const COSTS = ['', 'low', 'mod', 'high'];

// editId is fixed for this editor instance (remounted per open); capture once.
const existing = untrack(() => (editId ? appState.customExercises[editId] : undefined));
const v0: Variant | undefined = existing?.variants[0];
const num = (n: number | undefined): string => (n == null ? '' : String(n));

let id = $state(untrack(() => editId) ?? '');
let name = $state(existing?.name ?? '');
let cat = $state(existing?.cat ?? 'Custom');
let catVar = $state(existing?.catVar ?? '--violet');
let track = $state(existing?.track?.field ?? '');
let vName = $state(v0?.name ?? '');
let what = $state(v0?.what ?? '');
let sets = $state(num(v0?.sets?.min));
let reps = $state(num(v0?.reps?.min));
let work = $state(num(v0?.workSec?.min));
let rest = $state(num(v0?.restSec?.min));
let load = $state(v0?.loadKg ? String(showKg(v0.loadKg.min) ?? '') : '');
let edge = $state(v0?.edgeMm ? String(showMm(v0.edgeMm.min) ?? '') : '');
let rpe = $state(num(v0?.rpe?.min));
let grip = $state(v0?.grip ?? '');
let cnsCost = $state(v0?.cnsCost ?? '');

const numOr = (s: string): number | undefined => {
	const n = Number.parseFloat(s);
	return Number.isFinite(n) ? n : undefined;
};

function save() {
	if (!isValidExerciseId(id)) {
		toast.error(m.ce_bad_id());
		return;
	}
	if (!editId && appState.customExercises[id]) {
		toast.error(m.ce_id_taken());
		return;
	}
	const variant: Record<string, unknown> = { name: vName || name || 'Variant', what };
	const set = (k: string, val: number | undefined) => {
		if (val != null) variant[k] = val;
	};
	set('sets', numOr(sets));
	set('reps', numOr(reps));
	set('workSec', numOr(work));
	set('restSec', numOr(rest));
	set('rpe', numOr(rpe));
	const loadN = numOr(load);
	if (loadN != null) variant.loadKg = toKg(loadN);
	const edgeN = numOr(edge);
	if (edgeN != null) variant.edgeMm = Math.round(toMm(edgeN));
	if (grip) variant.grip = grip;
	if (cnsCost) variant.cnsCost = cnsCost;

	// Keep any extra variants an AI may have authored beyond the primary one.
	const rest2 = existing ? existing.variants.slice(1) : [];
	const draft = {
		name,
		cat,
		catVar,
		variants: [variant, ...rest2],
		...(track ? { track: { field: track } } : {}),
	};
	const clean = sanitizeCustomExercise(draft) as CustomExercise;
	appState.customExercises[id] = clean;
	toast.success(editId ? m.ce_saved() : m.ce_created());
	onClose();
}
</script>

<Modal open={true} title={editId ? m.ce_edit() : m.ce_new()} onClose={onClose}>
	<div class="flex flex-col gap-3">
		<div class="grid grid-cols-2 gap-3">
			<label class="flex flex-col gap-1 text-xs text-ink-dim">
				{m.ce_id()}
				<Input bind:value={id} disabled={!!editId} placeholder="my-exercise" class="bg-panel-2" />
			</label>
			<label class="flex flex-col gap-1 text-xs text-ink-dim">
				{m.ce_name()}
				<Input bind:value={name} class="bg-panel-2" />
			</label>
			<label class="flex flex-col gap-1 text-xs text-ink-dim">
				{m.ce_category()}
				<Input bind:value={cat} class="bg-panel-2" />
			</label>
			<label class="flex flex-col gap-1 text-xs text-ink-dim">
				{m.ce_color()}
				<Select type="single" value={catVar} onValueChange={(v) => v && (catVar = v)}>
					<SelectTrigger class="bg-panel-2">
						<span class="inline-flex items-center gap-2">
							<span class="size-3 rounded-full" style:background="var({catVar})"></span>{catVar}
						</span>
					</SelectTrigger>
					<SelectContent>
						{#each COLORS as c (c)}<SelectItem value={c}>{c}</SelectItem>{/each}
					</SelectContent>
				</Select>
			</label>
		</div>

		<div class="border-t border-line pt-3">
			<div class="mb-2 font-mono text-[10px] tracking-wider text-ink-faint uppercase">
				{m.ce_variant()}
			</div>
			<div class="grid grid-cols-2 gap-3">
				<label class="col-span-2 flex flex-col gap-1 text-xs text-ink-dim">
					{m.ce_variant_name()}
					<Input bind:value={vName} placeholder={name} class="bg-panel-2" />
				</label>
				<label class="col-span-2 flex flex-col gap-1 text-xs text-ink-dim">
					{m.ce_what()}
					<Input bind:value={what} class="bg-panel-2" />
				</label>
				<label class="flex flex-col gap-1 text-xs text-ink-dim">
					{m.ce_sets()}<Input type="number" step="any" bind:value={sets} class="bg-panel-2" />
				</label>
				<label class="flex flex-col gap-1 text-xs text-ink-dim">
					{m.ce_reps()}<Input type="number" step="any" bind:value={reps} class="bg-panel-2" />
				</label>
				<label class="flex flex-col gap-1 text-xs text-ink-dim">
					{m.ce_work()}<Input type="number" step="any" bind:value={work} class="bg-panel-2" />
				</label>
				<label class="flex flex-col gap-1 text-xs text-ink-dim">
					{m.ce_rest()}<Input type="number" step="any" bind:value={rest} class="bg-panel-2" />
				</label>
				<label class="flex flex-col gap-1 text-xs text-ink-dim">
					{m.ce_load()} ({appState.prefs.weight})
					<Input type="number" step="any" bind:value={load} class="bg-panel-2" />
				</label>
				<label class="flex flex-col gap-1 text-xs text-ink-dim">
					{m.ce_edge()} ({appState.prefs.length})
					<Input type="number" step="any" bind:value={edge} class="bg-panel-2" />
				</label>
				<label class="flex flex-col gap-1 text-xs text-ink-dim">
					{m.ce_rpe()}<Input type="number" step="any" bind:value={rpe} class="bg-panel-2" />
				</label>
				<label class="flex flex-col gap-1 text-xs text-ink-dim">
					{m.ce_grip()}
					<Select type="single" value={grip} onValueChange={(v) => (grip = v ?? '')}>
						<SelectTrigger class="bg-panel-2">{grip || '—'}</SelectTrigger>
						<SelectContent>
							{#each GRIPS as g (g)}<SelectItem value={g}>{g || '—'}</SelectItem>{/each}
						</SelectContent>
					</Select>
				</label>
				<label class="flex flex-col gap-1 text-xs text-ink-dim">
					{m.ce_cns()}
					<Select type="single" value={cnsCost} onValueChange={(v) => (cnsCost = v ?? '')}>
						<SelectTrigger class="bg-panel-2">{cnsCost || '—'}</SelectTrigger>
						<SelectContent>
							{#each COSTS as c (c)}<SelectItem value={c}>{c || '—'}</SelectItem>{/each}
						</SelectContent>
					</Select>
				</label>
			</div>
		</div>

		<label class="flex flex-col gap-1 border-t border-line pt-3 text-xs text-ink-dim">
			{m.ce_track()}
			<Select type="single" value={track} onValueChange={(v) => (track = v ?? '')}>
				<SelectTrigger class="bg-panel-2">
					{track === 'weight' ? m.ce_track_weight() : track === 'time' ? m.ce_track_time() : m.ce_track_none()}
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="">{m.ce_track_none()}</SelectItem>
					<SelectItem value="weight">{m.ce_track_weight()}</SelectItem>
					<SelectItem value="time">{m.ce_track_time()}</SelectItem>
				</SelectContent>
			</Select>
			<span class="text-[10px] leading-snug text-ink-faint">{m.ce_track_help()}</span>
		</label>

		<Button class="mt-1 w-full bg-flag text-white hover:bg-flag/90" onclick={save}>
			{m.btn_save()}
		</Button>
	</div>
</Modal>
