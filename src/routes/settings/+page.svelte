<script lang="ts">
import BellIcon from '@lucide/svelte/icons/bell';
import BellOffIcon from '@lucide/svelte/icons/bell-off';
import { toast } from 'svelte-sonner';
import { goto } from '$app/navigation';
import AccountSettings from '$lib/AccountSettings.svelte';
import { authClient } from '$lib/auth-client';
import { exportBackup, exportWorkoutsCsv, importBackup } from '$lib/backup';
import { Button } from '$lib/components/ui/button';
import { Card } from '$lib/components/ui/card';
import * as m from '$lib/paraglide/messages';
import SectionHeading from '$lib/SectionHeading.svelte';
import { appMode, appState, resetAll } from '$lib/state.svelte';
import { cn } from '$lib/utils';

const session = authClient.useSession();
const email = $derived($session.data?.user?.email ?? '');

const weightUnits = ['kg', 'lb'] as const;
const lengthUnits = ['mm', 'in'] as const;

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

let fileInput = $state<HTMLInputElement>();

async function onImport(e: Event) {
	const file = (e.currentTarget as HTMLInputElement).files?.[0];
	if (!file) return;
	if (confirm(m.import_confirm())) {
		try {
			await importBackup(file);
			toast.success(m.toast_imported());
		} catch {
			toast.error(m.toast_import_failed());
		}
	}
	if (fileInput) fileInput.value = '';
}

function reset() {
	if (confirm(m.reset_confirm())) {
		resetAll();
		toast.success(m.toast_all_reset());
	}
}

const seg =
	'px-3 py-1 font-mono text-[11px] tracking-wider uppercase transition first:rounded-l-md last:rounded-r-md';
</script>

<section class="animate-in fade-in flex flex-col gap-[22px] duration-300">
	<div>
		<SectionHeading title={m.sec_settings()} />
		<p class="max-w-[62ch] text-[15px] text-ink-dim">{m.lede_settings()}</p>
	</div>

	<!-- Units & display -->
	<Card class="gap-4 p-[18px]">
		<div>
			<span class="font-bold">{m.set_units()}</span>
			<p class="mt-0.5 text-xs text-ink-dim">{m.set_units_desc()}</p>
		</div>
		<div class="flex items-center justify-between">
			<span class="text-sm text-ink">{m.field_weight()}</span>
			<div class="inline-flex rounded-md border border-line">
				{#each weightUnits as u (u)}
					<button
						type="button"
						class={cn(seg, appState.prefs.weight === u ? 'bg-chalk text-bg' : 'text-ink-dim hover:text-ink')}
						onclick={() => (appState.prefs.weight = u)}
					>
						{u}
					</button>
				{/each}
			</div>
		</div>
		<div class="flex items-center justify-between">
			<span class="text-sm text-ink">{m.set_length()}</span>
			<div class="inline-flex rounded-md border border-line">
				{#each lengthUnits as u (u)}
					<button
						type="button"
						class={cn(seg, appState.prefs.length === u ? 'bg-chalk text-bg' : 'text-ink-dim hover:text-ink')}
						onclick={() => (appState.prefs.length = u)}
					>
						{u}
					</button>
				{/each}
			</div>
		</div>
	</Card>

	<!-- Notifications -->
	<Card class="flex-row items-center justify-between gap-4 p-[18px]">
		<div>
			<span class="font-bold">{m.notify_toggle()}</span>
			<p class="mt-0.5 max-w-[52ch] text-xs text-ink-dim">{m.set_notify_desc()}</p>
		</div>
		<button
			type="button"
			aria-pressed={appState.prefs.notify}
			onclick={toggleNotify}
			class={cn(
				'flex size-9 flex-none items-center justify-center rounded-md border border-line transition',
				appState.prefs.notify ? 'text-flag' : 'text-ink-faint hover:text-ink'
			)}
		>
			{#if appState.prefs.notify}<BellIcon class="size-4" />{:else}<BellOffIcon class="size-4" />{/if}
		</button>
	</Card>

	<!-- Program -->
	<Card class="flex-row items-center justify-between gap-4 p-[18px]">
		<div>
			<span class="font-bold">{m.nav_program()}</span>
			<p class="mt-0.5 text-xs text-ink-dim">{m.set_program_desc()}</p>
		</div>
		<Button
			variant="outline"
			size="sm"
			class="flex-none border-line text-xs"
			onclick={() => goto('/program')}
		>
			{m.set_open_program()}
		</Button>
	</Card>

	<!-- Assessment -->
	<Card class="flex-row items-center justify-between gap-4 p-[18px]">
		<div>
			<span class="font-bold">{m.welcome_title()}</span>
			<p class="mt-0.5 max-w-[52ch] text-xs text-ink-dim">{m.set_assessment_desc()}</p>
		</div>
		<Button
			variant="outline"
			size="sm"
			class="flex-none border-line text-xs"
			onclick={() => goto('/welcome')}
		>
			{m.set_redo_assessment()}
		</Button>
	</Card>

	<!-- Data -->
	<Card class="gap-3 p-[18px]">
		<span class="font-bold">{m.data_section()}</span>
		<div class="flex flex-wrap gap-2">
			<Button variant="outline" size="sm" class="border-line text-xs" onclick={exportBackup}>
				{m.data_export_json()}
			</Button>
			<Button variant="outline" size="sm" class="border-line text-xs" onclick={exportWorkoutsCsv}>
				{m.data_export_csv()}
			</Button>
			<Button variant="outline" size="sm" class="border-line text-xs" onclick={() => fileInput?.click()}>
				{m.data_import()}
			</Button>
			<input
				bind:this={fileInput}
				type="file"
				accept="application/json"
				class="hidden"
				onchange={onImport}
			/>
			<Button
				variant="outline"
				size="sm"
				onclick={reset}
				class="border-line font-mono text-[11px] text-ink-faint hover:border-flag hover:text-flag"
			>
				{m.btn_reset_all()}
			</Button>
		</div>
	</Card>

	<!-- Account -->
	<Card class="gap-4 p-[18px]">
		<span class="font-bold">{m.set_account()}</span>
		{#if appMode.guest}
			<div class="flex flex-col items-start gap-2.5">
				<p class="max-w-[52ch] text-xs text-ink-dim">{m.guest_account_note()}</p>
				<Button variant="outline" size="sm" class="border-line text-xs" onclick={() => goto('/login')}>
					{m.guest_upgrade()}
				</Button>
			</div>
		{:else}
			<AccountSettings {email} />
		{/if}
	</Card>
</section>
