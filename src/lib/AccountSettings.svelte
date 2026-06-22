<script lang="ts">
import { goto } from '$app/navigation';
import { authClient } from '$lib/auth-client';
import { Button } from '$lib/components/ui/button';
import { Input } from '$lib/components/ui/input';
import * as m from '$lib/paraglide/messages';
import { clearLocal } from '$lib/state.svelte';

let { email }: { email: string } = $props();

let currentPw = $state('');
let newPw = $state('');
let pwMsg = $state('');
let pwErr = $state(false);
let pwBusy = $state(false);

async function changePassword(e: Event) {
	e.preventDefault();
	pwBusy = true;
	pwMsg = '';
	const res = await authClient.changePassword({
		currentPassword: currentPw,
		newPassword: newPw,
		revokeOtherSessions: true,
	});
	pwBusy = false;
	if (res.error) {
		pwErr = true;
		pwMsg = m.set_pw_error();
	} else {
		pwErr = false;
		pwMsg = m.set_pw_changed();
		currentPw = '';
		newPw = '';
	}
}

let delPw = $state('');
let delBusy = $state(false);
let delErr = $state('');

async function deleteAccount(e: Event) {
	e.preventDefault();
	if (!confirm(m.set_delete_confirm())) return;
	delBusy = true;
	delErr = '';
	const res = await authClient.deleteUser({ password: delPw });
	if (res.error) {
		delBusy = false;
		delErr = m.set_delete_error();
		return;
	}
	clearLocal();
	await goto('/login');
}
</script>

<div class="flex flex-col gap-5">
	<p class="font-mono text-xs text-ink-faint">{email}</p>

	<form class="flex flex-col gap-2.5" onsubmit={changePassword}>
		<span class="text-[13px] font-semibold text-chalk">{m.set_change_pw()}</span>
		<label class="flex flex-col gap-1 text-xs text-ink-dim">
			{m.field_current_pw()}
			<Input type="password" bind:value={currentPw} autocomplete="current-password" required />
		</label>
		<label class="flex flex-col gap-1 text-xs text-ink-dim">
			{m.field_new_pw()}
			<Input type="password" bind:value={newPw} autocomplete="new-password" required />
		</label>
		{#if pwMsg}
			<p class={pwErr ? 'text-xs text-flag' : 'text-xs text-teal'}>{pwMsg}</p>
		{/if}
		<Button type="submit" size="sm" disabled={pwBusy} class="self-start border-line text-xs" variant="outline">
			{m.set_change_pw()}
		</Button>
	</form>

	<form class="flex flex-col gap-2.5 border-t border-line pt-5" onsubmit={deleteAccount}>
		<span class="text-[13px] font-semibold text-flag">{m.set_danger()}</span>
		<p class="max-w-[52ch] text-xs text-ink-dim">{m.set_delete_desc()}</p>
		<label class="flex flex-col gap-1 text-xs text-ink-dim">
			{m.field_password()}
			<Input type="password" bind:value={delPw} autocomplete="current-password" required />
		</label>
		{#if delErr}<p class="text-xs text-flag">{delErr}</p>{/if}
		<Button
			type="submit"
			size="sm"
			disabled={delBusy}
			variant="outline"
			class="self-start border-flag/40 text-xs text-flag hover:bg-flag hover:text-white"
		>
			{m.set_delete()}
		</Button>
	</form>
</div>
