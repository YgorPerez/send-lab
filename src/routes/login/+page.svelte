<script lang="ts">
import { goto } from '$app/navigation';
import { authClient } from '$lib/auth-client';
import { Button } from '$lib/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
import { Input } from '$lib/components/ui/input';
import LanguageSwitcher from '$lib/LanguageSwitcher.svelte';
import PasswordInput from '$lib/PasswordInput.svelte';
import * as m from '$lib/paraglide/messages';
import { appMode, enterGuest, leaveGuest, uploadCurrentToServer } from '$lib/state.svelte';

let mode = $state<'login' | 'signup'>('login');
let name = $state('');
let email = $state('');
let password = $state('');
let error = $state('');
let busy = $state(false);

async function submit(e: Event) {
	e.preventDefault();
	busy = true;
	error = '';
	// A guest signing up carries their local data into the new account.
	const carryGuestData = mode === 'signup' && appMode.guest;
	try {
		const res =
			mode === 'signup'
				? await authClient.signUp.email({ name: name || email, email, password })
				: await authClient.signIn.email({ email, password });
		if (res.error) {
			error = res.error.message ?? m.auth_error();
		} else {
			if (carryGuestData) await uploadCurrentToServer();
			leaveGuest();
			// Full navigation so the app reloads with the new session cookie already
			// present — avoids a race where the redirect guard bounces back to /login
			// before the client session store has refreshed.
			window.location.href = '/';
		}
	} catch {
		error = m.auth_error();
	} finally {
		busy = false;
	}
}

function continueAsGuest() {
	enterGuest();
	void goto('/');
}
</script>

<div class="flex min-h-screen flex-col items-center justify-center gap-6 px-5">
	<div class="absolute top-5 right-5"><LanguageSwitcher /></div>

	<h1 class="flex items-center gap-2.5 text-2xl font-black tracking-tight">
		<span class="inline-block h-6 w-3 -skew-x-12 bg-flag shadow-[3px_0_0_var(--flag-deep)]"></span>
		SEND&nbsp;LAB
	</h1>

	<Card class="w-full max-w-sm">
		<CardHeader>
			<CardTitle class="text-xl">
				{mode === 'signup' ? m.signup_title() : m.login_title()}
			</CardTitle>
			<p class="text-sm text-ink-dim">
				{mode === 'signup' ? m.signup_subtitle() : m.login_subtitle()}
			</p>
		</CardHeader>
		<CardContent>
			<form class="flex flex-col gap-3" onsubmit={submit}>
				{#if mode === 'signup'}
					<label class="flex flex-col gap-1.5 text-xs text-ink-dim">
						{m.field_name()}
						<Input bind:value={name} autocomplete="name" />
					</label>
				{/if}
				<label class="flex flex-col gap-1.5 text-xs text-ink-dim">
					{m.field_email()}
					<Input type="email" bind:value={email} autocomplete="email" required />
				</label>
				<label class="flex flex-col gap-1.5 text-xs text-ink-dim">
					{m.field_password()}
					<PasswordInput
						bind:value={password}
						autocomplete={mode === 'signup' ? 'new-password' : 'current-password'}
						required
					/>
				</label>

				{#if error}
					<p class="text-sm text-flag">{error}</p>
				{/if}

				<Button type="submit" disabled={busy} class="mt-1 bg-flag text-white hover:bg-flag/90">
					{mode === 'signup' ? m.btn_sign_up() : m.btn_sign_in()}
				</Button>
			</form>

			<button
				type="button"
				class="mt-4 w-full text-center text-xs text-ink-dim underline decoration-dotted underline-offset-2 hover:text-ink"
				onclick={() => {
					mode = mode === 'signup' ? 'login' : 'signup';
					error = '';
				}}
			>
				{mode === 'signup' ? m.auth_to_login() : m.auth_to_signup()}
			</button>

			<div class="mt-4 border-t border-line pt-4">
				<Button variant="outline" class="w-full border-line text-sm" onclick={continueAsGuest}>
					{m.guest_continue()}
				</Button>
			</div>
		</CardContent>
	</Card>
</div>
