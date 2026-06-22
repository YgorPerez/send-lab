<script lang="ts">
import DownloadIcon from '@lucide/svelte/icons/download';
import XIcon from '@lucide/svelte/icons/x';
import { toast } from 'svelte-sonner';
import { browser } from '$app/environment';
import { Button } from '$lib/components/ui/button';
import { Card } from '$lib/components/ui/card';
import { Input } from '$lib/components/ui/input';
import * as m from '$lib/paraglide/messages';
import { deleteSavedProgram, loadSavedProgram, saveCurrentProgram, setProgram } from '$lib/plan';
import { appState } from '$lib/state.svelte';

let name = $state('');
let fileInput = $state<HTMLInputElement>();

function save() {
	saveCurrentProgram(name);
	name = '';
	toast.success(m.prog_program_saved());
}

function load(i: number) {
	loadSavedProgram(i);
	toast.success(m.prog_loaded());
}

function exportProgram(i: number) {
	if (!browser) return;
	const saved = appState.savedPrograms[i];
	const payload = { app: 'sendlab-program', version: 1, data: saved.program };
	const url = URL.createObjectURL(
		new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
	);
	const a = document.createElement('a');
	a.href = url;
	a.download = `sendlab-program-${saved.name.replace(/\s+/g, '-').toLowerCase()}.json`;
	a.click();
	URL.revokeObjectURL(url);
}

async function onImport(e: Event) {
	const file = (e.currentTarget as HTMLInputElement).files?.[0];
	if (!file) return;
	try {
		const parsed = JSON.parse(await file.text());
		setProgram(parsed?.app === 'sendlab-program' ? parsed.data : parsed);
		toast.success(m.prog_loaded());
	} catch {
		toast.error(m.toast_import_failed());
	}
	if (fileInput) fileInput.value = '';
}
</script>

<Card class="gap-3 p-[18px]">
	<span class="font-bold">{m.prog_saved()}</span>

	<div class="flex gap-2">
		<Input bind:value={name} placeholder={m.prog_save_ph()} class="h-9 flex-1 bg-panel-2 text-sm" />
		<Button variant="outline" size="sm" class="border-line text-xs" onclick={save}>
			{m.prog_save_current()}
		</Button>
	</div>

	{#if appState.savedPrograms.length === 0}
		<p class="text-xs text-ink-faint">{m.prog_no_saved()}</p>
	{:else}
		<div class="flex flex-col gap-1.5">
			{#each appState.savedPrograms as p, i (i)}
				<div class="flex items-center gap-2 rounded-lg border border-line bg-panel-2 px-3 py-2">
					<span class="flex-1 truncate text-[13px] text-chalk">{p.name}</span>
					<button
						type="button"
						onclick={() => load(i)}
						class="font-mono text-[10px] tracking-wider text-flag uppercase transition hover:text-flag/80"
					>
						{m.prog_load()}
					</button>
					<button
						type="button"
						onclick={() => exportProgram(i)}
						aria-label={m.prog_export()}
						class="text-ink-faint transition hover:text-ink"
					>
						<DownloadIcon class="size-3.5" />
					</button>
					<button
						type="button"
						onclick={() => deleteSavedProgram(i)}
						aria-label={m.btn_delete()}
						class="text-ink-faint transition hover:text-flag"
					>
						<XIcon class="size-3.5" />
					</button>
				</div>
			{/each}
		</div>
	{/if}

	<Button
		variant="outline"
		size="sm"
		class="self-start border-dashed border-line text-xs"
		onclick={() => fileInput?.click()}
	>
		{m.prog_import()}
	</Button>
	<input
		bind:this={fileInput}
		type="file"
		accept="application/json"
		class="hidden"
		onchange={onImport}
	/>
</Card>
