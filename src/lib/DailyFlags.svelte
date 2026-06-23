<script lang="ts">
import { Badge } from '$lib/components/ui/badge';
import { Button } from '$lib/components/ui/button';
import type { DailyFlag, FlagArea } from '$lib/content';
import type { Content } from '$lib/content/types';
import Prose from '$lib/Prose.svelte';
import * as m from '$lib/paraglide/messages';
import { cn } from '$lib/utils';

let {
	flags,
	content,
	onRehab,
	onPlan,
	onDeep,
}: {
	flags: DailyFlag[];
	content: Content;
	onRehab: (area: FlagArea) => void;
	onPlan: () => void;
	onDeep: (area: FlagArea) => void;
} = $props();

const STYLE: Record<DailyFlag['severity'], string> = {
	stop: 'border-flag/50 bg-flag/10',
	warn: 'border-gold/40 bg-gold/10',
	info: 'border-line bg-panel-2',
};
</script>

{#if flags.length}
	<div class="mt-[22px] flex flex-col gap-2.5">
		<div class="font-mono text-[10px] tracking-wider text-ink-faint uppercase">
			{m.flags_heading()}
		</div>
		{#each flags as flag (flag.id)}
			{@const fc = content.flags[flag.id]}
			{#if fc}
				<div class={cn('rounded-xl border px-4 py-3', STYLE[flag.severity])}>
					<div class="text-[14.5px] font-semibold">{fc.title}</div>
					<p class="mt-1 text-[13.5px] text-ink-dim"><Prose value={fc.text} /></p>
					<div class="mt-2.5 flex flex-wrap gap-2">
						{#each fc.focus as f (f)}
							<Badge
								variant="outline"
								class="border-line font-mono text-[11px] font-normal text-ink-dim"
							>
								<Prose value={f} />
							</Badge>
						{/each}
					</div>
					{#if flag.area}
						<div class="mt-3 flex flex-wrap gap-2">
							<Button
								size="sm"
								variant="outline"
								class="border-line text-xs"
								onclick={() => flag.area && onDeep(flag.area)}
							>
								{m.flag_deep()}
							</Button>
							<Button
								size="sm"
								variant="outline"
								class="border-line text-xs"
								onclick={() => flag.area && onRehab(flag.area)}
							>
								{m.flag_rehab_today()}
							</Button>
							<Button size="sm" variant="ghost" class="text-xs" onclick={onPlan}>
								{m.flag_rehab_plan()}
							</Button>
						</div>
					{/if}
				</div>
			{/if}
		{/each}
	</div>
{/if}
