<script lang="ts">
import BellIcon from '@lucide/svelte/icons/bell';
import BellOffIcon from '@lucide/svelte/icons/bell-off';
import * as m from '$lib/paraglide/messages';
import { appState } from '$lib/state.svelte';
import { cn } from '$lib/utils';

function toggleWeight() {
	appState.prefs.weight = appState.prefs.weight === 'kg' ? 'lb' : 'kg';
}
function toggleLength() {
	appState.prefs.length = appState.prefs.length === 'mm' ? 'in' : 'mm';
}
async function toggleNotify() {
	if (appState.prefs.notify) {
		appState.prefs.notify = false;
		return;
	}
	if (typeof Notification === 'undefined') return;
	const granted =
		Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
	appState.prefs.notify = granted === 'granted';
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
	<button
		type="button"
		title={m.notify_toggle()}
		aria-label={m.notify_toggle()}
		aria-pressed={appState.prefs.notify}
		onclick={toggleNotify}
		class={cn(
			'flex size-[26px] items-center justify-center rounded-md border border-line transition',
			appState.prefs.notify ? 'text-flag' : 'text-ink-faint hover:text-ink'
		)}
	>
		{#if appState.prefs.notify}<BellIcon class="size-3.5" />{:else}<BellOffIcon class="size-3.5" />{/if}
	</button>
</div>
