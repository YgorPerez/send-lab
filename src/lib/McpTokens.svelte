<script lang="ts">
import CopyIcon from '@lucide/svelte/icons/copy';
import TrashIcon from '@lucide/svelte/icons/trash-2';
import { toast } from 'svelte-sonner';
import { browser } from '$app/environment';
import { Button } from '$lib/components/ui/button';
import { Card } from '$lib/components/ui/card';
import { Input } from '$lib/components/ui/input';
import { createToken, listTokens, revokeToken, type TokenRow } from '$lib/mcpClient';
import * as m from '$lib/paraglide/messages';

let tokens = $state<TokenRow[]>([]);
let name = $state('');
let creating = $state(false);
let freshToken = $state<string | null>(null);
const origin = $derived(browser ? location.origin : '');
const endpoint = $derived(`${origin}/mcp`);
const restEndpoint = $derived(`${origin}/api/v1`);

async function load() {
	tokens = await listTokens();
}
$effect(() => {
	load();
});

async function copy(text: string) {
	try {
		await navigator.clipboard.writeText(text);
		toast.success(m.mcp_copied());
	} catch {
		/* clipboard unavailable */
	}
}

async function create() {
	creating = true;
	try {
		const token = await createToken(name.trim());
		if (token) {
			freshToken = token;
			name = '';
			await load();
		}
	} finally {
		creating = false;
	}
}

async function revoke(id: string) {
	if (!confirm(m.mcp_revoke_confirm())) return;
	await revokeToken(id);
	await load();
}
</script>

<Card class="gap-3 p-[18px]">
	<div>
		<span class="font-bold">{m.mcp_title()}</span>
		<p class="mt-0.5 max-w-[58ch] text-xs text-ink-dim">{m.mcp_desc()}</p>
	</div>

	<div class="flex flex-col gap-1.5">
		<span class="font-mono text-[10px] tracking-wider text-ink-faint uppercase">{m.mcp_endpoint()}</span>
		<div class="flex items-center gap-2">
			<code class="min-w-0 flex-1 truncate rounded-md border border-line bg-panel-2 px-2.5 py-1.5 text-xs">
				{endpoint}
			</code>
			<Button variant="outline" size="sm" class="flex-none border-line text-xs" onclick={() => copy(endpoint)}>
				<CopyIcon class="size-3.5" />
			</Button>
		</div>
	</div>

	<div class="flex flex-col gap-1.5">
		<span class="font-mono text-[10px] tracking-wider text-ink-faint uppercase">{m.mcp_rest_endpoint()}</span>
		<div class="flex items-center gap-2">
			<code class="min-w-0 flex-1 truncate rounded-md border border-line bg-panel-2 px-2.5 py-1.5 text-xs">
				{restEndpoint}
			</code>
			<Button variant="outline" size="sm" class="flex-none border-line text-xs" onclick={() => copy(restEndpoint)}>
				<CopyIcon class="size-3.5" />
			</Button>
		</div>
	</div>

	{#if freshToken}
		<div class="flex flex-col gap-1.5 rounded-md border border-flag/40 bg-flag/10 p-2.5">
			<div class="flex items-center gap-2">
				<code class="min-w-0 flex-1 truncate font-mono text-xs text-flag">{freshToken}</code>
				<Button variant="outline" size="sm" class="flex-none border-line text-xs" onclick={() => copy(freshToken ?? '')}>
					{m.mcp_copy()}
				</Button>
			</div>
			<p class="text-[11px] text-ink-dim">{m.mcp_new_token_note()}</p>
		</div>
	{/if}

	<div class="flex items-center gap-2">
		<Input bind:value={name} placeholder={m.mcp_token_name_ph()} class="bg-panel-2 text-sm" />
		<Button
			size="sm"
			class="flex-none bg-flag text-xs text-white hover:bg-flag/90"
			disabled={creating}
			onclick={create}
		>
			{m.mcp_create()}
		</Button>
	</div>

	{#if tokens.length === 0}
		<p class="text-xs text-ink-faint">{m.mcp_no_tokens()}</p>
	{:else}
		<ul class="flex flex-col gap-1.5">
			{#each tokens as t (t.id)}
				<li class="flex items-center justify-between gap-2 rounded-md border border-line px-2.5 py-1.5">
					<span class="min-w-0 flex-1 truncate text-sm">{t.name}</span>
					<button
						type="button"
						aria-label={m.mcp_revoke()}
						class="flex-none text-ink-faint transition hover:text-flag"
						onclick={() => revoke(t.id)}
					>
						<TrashIcon class="size-3.5" />
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</Card>
