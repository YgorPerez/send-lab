<script lang="ts">
import DownloadIcon from '@lucide/svelte/icons/download';
import { Button } from '$lib/components/ui/button';
import { Card } from '$lib/components/ui/card';
import * as m from '$lib/paraglide/messages';

// `beforeinstallprompt` isn't in the standard DOM lib types.
interface BeforeInstallPromptEvent extends Event {
	prompt: () => Promise<void>;
	userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred = $state<BeforeInstallPromptEvent | null>(null);
let installed = $state(false);

$effect(() => {
	// Hide the card entirely when already running as an installed app.
	installed = window.matchMedia('(display-mode: standalone)').matches;

	// Chromium fires this when the app is installable; stash it so a button can
	// trigger the native prompt on tap. Brave/Firefox may never fire it — then we
	// fall back to manual instructions.
	const onPrompt = (e: Event) => {
		e.preventDefault();
		deferred = e as BeforeInstallPromptEvent;
	};
	const onInstalled = () => {
		installed = true;
		deferred = null;
	};
	window.addEventListener('beforeinstallprompt', onPrompt);
	window.addEventListener('appinstalled', onInstalled);
	return () => {
		window.removeEventListener('beforeinstallprompt', onPrompt);
		window.removeEventListener('appinstalled', onInstalled);
	};
});

async function install() {
	if (!deferred) return;
	await deferred.prompt();
	deferred = null;
}
</script>

{#if !installed}
	<Card class="flex-row items-center justify-between gap-4 p-[18px]">
		<div>
			<span class="font-bold">{m.install_title()}</span>
			<p class="mt-0.5 max-w-[52ch] text-xs text-ink-dim">
				{deferred ? m.install_desc() : m.install_manual()}
			</p>
		</div>
		{#if deferred}
			<Button
				size="sm"
				class="flex-none bg-flag text-xs text-white hover:bg-flag/90"
				onclick={install}
			>
				<DownloadIcon class="size-3.5" />
				{m.install_btn()}
			</Button>
		{/if}
	</Card>
{/if}
