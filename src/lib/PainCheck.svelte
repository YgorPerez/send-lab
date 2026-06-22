<script lang="ts">
import * as m from '$lib/paraglide/messages';

let { niggle = $bindable(), synovitis = $bindable() }: { niggle: boolean; synovitis: boolean } =
	$props();
</script>

<div class="flex flex-col gap-2 rounded-lg border border-line bg-panel-2 p-2.5">
	<span class="font-mono text-[10px] tracking-wider text-ink-faint uppercase">
		{m.assess_pain_title()}
	</span>
	<p class="text-[11px] leading-snug text-ink-dim">{m.assess_synovitis_help()}</p>
	<label class="flex items-center gap-2 text-xs text-ink-dim">
		<input type="checkbox" bind:checked={synovitis} class="size-4 accent-flag" />
		{m.field_synovitis()}
	</label>
	<label class="flex items-center gap-2 text-xs text-ink-dim">
		<input type="checkbox" bind:checked={niggle} class="size-4 accent-flag" />
		{m.field_niggle()}
	</label>
</div>
