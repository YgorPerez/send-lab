<script lang="ts">
import { toast } from 'svelte-sonner';
import { Card } from '$lib/components/ui/card';
import { Progress } from '$lib/components/ui/progress';
import { type Day, getContent, phaseId } from '$lib/content';
import Prose from '$lib/Prose.svelte';
import * as m from '$lib/paraglide/messages';
import SectionHeading from '$lib/SectionHeading.svelte';
import { appState, today } from '$lib/state.svelte';
import { cn } from '$lib/utils';

const content = getContent();
const week = $derived(appState.currentWeek);
const phase = $derived(content.phases[phaseId(week)]);

/** Primary prescription label for a day, with any swaps applied. */
function resolvePrime(d: Day): string {
	const ex = content.exercises[d.ex[0]];
	if (!ex) return d.prime;
	const sw = appState.swaps[d.ex[0]];
	const base = sw != null && ex.swaps[sw] ? ex.swaps[sw] : ex.name;

	const ex2 = d.ex[1] ? content.exercises[d.ex[1]] : undefined;
	if (ex2 && ['Mon', 'Wed', 'Thu', 'Fri'].includes(d.k)) {
		const sw2 = appState.swaps[d.ex[1]];
		const b2 = sw2 != null && ex2.swaps[sw2] ? ex2.swaps[sw2] : ex2.name;
		return `${base} → ${b2}`;
	}
	return base;
}

function toggleDay(d: Day, checked: boolean) {
	const id = `w${week}-${d.k}`;
	if (checked) {
		appState.completed[id] = true;
		appState.log.unshift({
			date: today(),
			type: 'day',
			label: `W${week} ${d.label} · ${resolvePrime(d)}`,
			color: d.color,
			note: m.log_note_day({ load: d.load }),
		});
		toast.success(m.toast_day_logged({ day: d.label }));
	} else {
		delete appState.completed[id];
	}
}
</script>

<section class="animate-in fade-in duration-300">
	<SectionHeading title={m.sec_week()} />

	<Card class="mb-[22px] gap-3 p-[18px]">
		<div class="flex items-baseline justify-between">
			<span class="font-bold">{phase.name}</span>
			<span class="font-mono text-xs text-flag">{m.week_label({ n: week })}</span>
		</div>
		<Progress value={(week / 8) * 100} class="h-2.5 bg-panel-2" />
		<div class="flex flex-wrap gap-1.5">
			{#each Array.from({ length: 8 }, (_, i) => i + 1) as i (i)}
				<button
					type="button"
					onclick={() => (appState.currentWeek = i)}
					class={cn(
						'h-[30px] min-w-[34px] flex-1 rounded-md border font-mono text-[11px] transition',
						i === week
							? 'border-flag bg-flag font-bold text-white'
							: 'border-line bg-panel-2 text-ink-faint hover:text-ink',
						i === 8 && i !== week && 'border-teal text-teal'
					)}
				>
					{i}
				</button>
			{/each}
		</div>
		<div
			class="rounded-lg border-l-[3px] bg-panel-2 px-3 py-2.5 font-mono text-xs text-ink-dim"
			style:border-left-color="var({phase.cat})"
		>
			<Prose value={phase.banner} />
		</div>
	</Card>

	<p class="mb-[26px] max-w-[62ch] text-[15px] text-ink-dim">
		<Prose value={m.lede_week()} />
	</p>

	<div class="grid gap-3 md:grid-cols-7">
		{#each content.days as d (d.k)}
			{@const id = `w${week}-${d.k}`}
			{@const done = !!appState.completed[id]}
			<Card
				class={cn('relative gap-2 overflow-hidden p-3.5', done && 'opacity-55')}
			>
				<span class="absolute inset-x-0 top-0 h-[3px]" style:background={d.color}></span>
				<div class="font-mono text-[11px] tracking-wider text-ink-faint uppercase">{d.label}</div>
				<div class="font-mono text-[10px] font-bold tracking-wider uppercase" style:color={d.color}>
					{d.load}
				</div>
				<div class="text-sm leading-snug font-bold">{resolvePrime(d)}</div>
				<div class="text-xs leading-snug text-ink-dim"><Prose value={d.sec} /></div>
				<label
					class="mt-auto flex cursor-pointer items-center gap-1.5 border-t border-line pt-2 text-xs text-ink-faint"
				>
					<input
						type="checkbox"
						checked={done}
						onchange={(e) => toggleDay(d, e.currentTarget.checked)}
						class="size-[15px] cursor-pointer accent-teal"
					/>
					{done ? m.lbl_done() : m.btn_mark_done()}
				</label>
			</Card>
		{/each}
	</div>
</section>
