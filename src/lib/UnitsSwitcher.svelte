<script lang="ts">
import { appState } from '$lib/state.svelte';

function toggleWeight() {
	appState.prefs.weight = appState.prefs.weight === 'kg' ? 'lb' : 'kg';
}
function toggleLength() {
	appState.prefs.length = appState.prefs.length === 'mm' ? 'in' : 'mm';
}
</script>

<div class="flex items-center gap-1">
	<button
		type="button"
		title="kg / lb"
		onclick={toggleWeight}
		class="rounded-md border border-line px-1.5 py-1 font-mono text-[10px] tracking-wider text-ink-dim uppercase transition hover:text-ink"
	>
		{appState.prefs.weight}
	</button>
	<button
		type="button"
		title="mm / in"
		onclick={toggleLength}
		class="rounded-md border border-line px-1.5 py-1 font-mono text-[10px] tracking-wider text-ink-dim uppercase transition hover:text-ink"
	>
		{appState.prefs.length}
	</button>
</div>
