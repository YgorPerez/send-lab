<script lang="ts">
import CopyIcon from '@lucide/svelte/icons/copy';
import EyeIcon from '@lucide/svelte/icons/eye';
import EyeOffIcon from '@lucide/svelte/icons/eye-off';
import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
import { toast } from 'svelte-sonner';
import { browser } from '$app/environment';
import { Button } from '$lib/components/ui/button';
import { Card } from '$lib/components/ui/card';
import { getToken, regenerateToken } from '$lib/mcpClient';
import * as m from '$lib/paraglide/messages';

let token = $state<string | null>(null);
let revealed = $state(false);
let busy = $state(false);

const origin = $derived(browser ? location.origin : '');
const endpoint = $derived(`${origin}/mcp`);
const restEndpoint = $derived(`${origin}/api/v1`);

const masked = `sl_${'•'.repeat(12)}`;
const shownToken = $derived(revealed && token ? token : masked);

// Standard MCP client config — the `mcpServers` + url/headers shape that Claude,
// Cursor, VS Code, etc. all understand. Client-agnostic; no CLI assumed.
const configFor = (t: string) =>
	JSON.stringify(
		{
			mcpServers: {
				'send-lab': { type: 'http', url: endpoint, headers: { Authorization: `Bearer ${t}` } },
			},
		},
		null,
		2,
	);
const shownConfig = $derived(configFor(shownToken));

$effect(() => {
	getToken().then((t) => (token = t));
});

async function copy(text: string) {
	try {
		await navigator.clipboard.writeText(text);
		toast.success(m.mcp_copied());
	} catch {
		/* clipboard unavailable */
	}
}

async function regenerate() {
	if (!confirm(m.mcp_regenerate_confirm())) return;
	busy = true;
	try {
		const t = await regenerateToken();
		if (t) {
			token = t;
			revealed = true; // show the new one so it can be re-copied
		}
	} finally {
		busy = false;
	}
}
</script>

<Card class="gap-3 p-[18px]">
	<div>
		<span class="font-bold">{m.mcp_title()}</span>
		<p class="mt-0.5 max-w-[58ch] text-xs text-ink-dim">{m.mcp_desc()}</p>
	</div>

	<p class="text-xs text-ink-dim">{m.mcp_agnostic_note()}</p>

	<!-- Endpoint -->
	<div class="flex flex-col gap-1.5">
		<span class="font-mono text-[10px] tracking-wider text-ink-faint uppercase">{m.mcp_endpoint()}</span>
		<div class="flex items-center gap-2">
			<code class="min-w-0 flex-1 truncate rounded-md border border-line bg-panel-2 px-2.5 py-1.5 text-xs"
				>{endpoint}</code
			>
			<Button
				variant="outline"
				size="sm"
				class="flex-none border-line text-xs"
				aria-label={m.mcp_copy()}
				onclick={() => copy(endpoint)}
			>
				<CopyIcon class="size-3.5" />
			</Button>
		</div>
	</div>

	<!-- Token -->
	<div class="flex flex-col gap-1.5">
		<span class="font-mono text-[10px] tracking-wider text-ink-faint uppercase">{m.mcp_token_label()}</span>
		<div class="flex items-center gap-2">
			<code class="min-w-0 flex-1 truncate rounded-md border border-line bg-panel-2 px-2.5 py-1.5 text-xs"
				>{shownToken}</code
			>
			<Button
				variant="outline"
				size="sm"
				class="flex-none border-line text-xs"
				disabled={!token}
				aria-label={revealed ? m.mcp_hide() : m.mcp_reveal()}
				onclick={() => (revealed = !revealed)}
			>
				{#if revealed}<EyeOffIcon class="size-3.5" />{:else}<EyeIcon class="size-3.5" />{/if}
			</Button>
			<Button
				variant="outline"
				size="sm"
				class="flex-none border-line text-xs"
				disabled={!token}
				aria-label={m.mcp_copy()}
				onclick={() => token && copy(token)}
			>
				<CopyIcon class="size-3.5" />
			</Button>
		</div>
	</div>

	<!-- Generic JSON config -->
	<div class="flex flex-col gap-1.5">
		<div class="flex items-center justify-between gap-2">
			<span class="font-mono text-[10px] tracking-wider text-ink-faint uppercase">{m.mcp_config_note()}</span>
			<Button
				variant="outline"
				size="sm"
				class="flex-none border-line text-xs"
				disabled={!token}
				onclick={() => token && copy(configFor(token))}
			>
				<CopyIcon class="size-3.5" />
				{m.mcp_copy()}
			</Button>
		</div>
		<pre class="overflow-x-auto rounded-md border border-line bg-panel-2 px-2.5 py-2 font-mono text-[11px]">{shownConfig}</pre>
	</div>

	<div>
		<Button
			variant="outline"
			size="sm"
			class="border-line font-mono text-[11px] text-ink-faint hover:border-flag hover:text-flag"
			disabled={busy}
			onclick={regenerate}
		>
			<RefreshCwIcon class="size-3.5" />
			{m.mcp_regenerate()}
		</Button>
	</div>

	<p class="text-[11px] text-ink-faint">{m.mcp_rest_note({ url: restEndpoint })}</p>
</Card>
