<script lang="ts">
import { toast } from 'svelte-sonner';
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from '$lib/components/ui/accordion';
import { getContent } from '$lib/content';
import Prose from '$lib/Prose.svelte';
import * as m from '$lib/paraglide/messages';
import { variantOf } from '$lib/plan';
import SectionHeading from '$lib/SectionHeading.svelte';
import { appState } from '$lib/state.svelte';
import { cn } from '$lib/utils';

const content = getContent();
const entries = Object.entries(content.exercises);

const ALL = '__all__';
const cats = [ALL, ...new Set(entries.map(([, e]) => e.cat))];

let filter = $state(ALL);
let open = $state<string[]>([]);

const visible = $derived(filter === ALL ? entries : entries.filter(([, e]) => e.cat === filter));

function setSwap(id: string, i: number, label: string) {
	if (i === 0) delete appState.swaps[id];
	else appState.swaps[id] = i;
	toast.success(i === 0 ? m.toast_reset_default() : m.toast_swapped({ name: label }));
}
</script>

<section class="animate-in fade-in duration-300">
	<SectionHeading title={m.sec_exercises()} />
	<p class="mb-[18px] max-w-[62ch] text-[15px] text-ink-dim">
		<Prose value={m.lede_exercises()} />
	</p>

	<div class="mb-[18px] flex flex-wrap gap-[7px]">
		{#each cats as c (c)}
			<button
				type="button"
				onclick={() => (filter = c)}
				class={cn(
					'rounded-full border px-3 py-[7px] font-mono text-[11px] tracking-wide uppercase transition',
					c === filter
						? 'border-chalk bg-chalk font-bold text-bg'
						: 'border-line bg-panel text-ink-dim hover:text-ink'
				)}
			>
				{c === ALL ? m.filter_all() : c}
			</button>
		{/each}
	</div>

	<Accordion type="multiple" bind:value={open} class="flex flex-col gap-3">
		{#each visible as [id, e] (id)}
			{@const sw = appState.swaps[id]}
			{@const active = variantOf(e, sw ?? 0)}
			{@const cat = `var(${e.catVar})`}
			<AccordionItem
				value={id}
				class="overflow-hidden rounded-xl border border-line bg-panel last:border-b"
			>
				<AccordionTrigger class="items-center gap-3.5 px-[18px] py-4 hover:no-underline">
					<span class="h-[38px] w-2 flex-none rounded" style:background={cat}></span>
					<div class="flex-1 text-left">
						<div class="text-[15.5px] font-bold">
							{active.name}{#if sw != null && sw !== 0}<span
									class="font-mono text-[10px]"
									style:color={cat}> {m.swapped_tag()}</span
								>{/if}
						</div>
						<div class="font-mono text-[12.5px] text-ink-dim">{active.what}</div>
					</div>
					<span
						class="mr-1 font-mono text-[10px] font-bold tracking-wider whitespace-nowrap uppercase"
						style:color={cat}
					>
						{e.cat}
					</span>
				</AccordionTrigger>
				<AccordionContent class="px-[18px] pb-[18px]">
					<div
						class="my-3.5 rounded-lg border border-line bg-panel-2 px-3.5 py-3 font-mono text-[13px] leading-relaxed text-chalk"
					>
						<Prose value={active.spec} />
					</div>
					{#each active.why as w (w)}
						<p class="mb-2 text-[13.5px] text-ink-dim"><Prose value={w} /></p>
					{/each}
					<div class="mt-3.5 border-t border-dashed border-line pt-3.5">
						<div class="mb-2 font-mono text-[10px] tracking-wider text-ink-faint uppercase">
							{m.swap_label()}
						</div>
						<div class="flex flex-wrap gap-2">
							{#each e.variants as v, i (v.name)}
								{@const isActive = (sw == null && i === 0) || sw === i}
								<button
									type="button"
									onclick={() => setSwap(id, i, v.name)}
									class={cn(
										'rounded-lg border px-3 py-2 text-[12.5px] transition',
										isActive
											? 'font-semibold text-chalk'
											: 'border-line bg-panel-2 text-ink-dim hover:text-ink'
									)}
									style={isActive
										? `border-color:${cat};background:color-mix(in srgb, ${cat} 14%, transparent)`
										: undefined}
								>
									{v.name}
								</button>
							{/each}
						</div>
					</div>
				</AccordionContent>
			</AccordionItem>
		{/each}
	</Accordion>
</section>
