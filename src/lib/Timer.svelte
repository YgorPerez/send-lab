<script lang="ts">
import PauseIcon from '@lucide/svelte/icons/pause';
import PlayIcon from '@lucide/svelte/icons/play';
import RotateCcwIcon from '@lucide/svelte/icons/rotate-ccw';
import { Button } from '$lib/components/ui/button';
import { Input } from '$lib/components/ui/input';
import * as m from '$lib/paraglide/messages';
import {
	pauseTimer,
	phaseColor,
	resetTimer,
	startTimer,
	timer,
	timerClock,
	timerLeft,
	timerTotal,
} from '$lib/timerStore.svelte';
import { cn } from '$lib/utils';

const phaseLabel = $derived(
	timer.phase === 'work'
		? m.timer_work()
		: timer.phase === 'rest'
			? m.timer_rest()
			: timer.phase === 'setRest'
				? m.timer_setrest()
				: timer.phase === 'done'
					? m.timer_done()
					: m.timer_ready(),
);
const display = $derived(timer.phase === 'idle' ? timer.work : timer.remaining);
const accent = $derived(phaseColor(timer.phase));
const total = $derived(timerTotal());
const left = $derived(timerLeft());
const doneFrac = $derived(total > 0 ? (total - left) / total : 0);
</script>

<div class="rounded-xl border border-line bg-panel-2 p-4">
	<div class="flex items-center justify-between gap-2">
		<span class="min-w-0 truncate font-mono text-[10px] tracking-wider text-ink-faint uppercase">
			{m.timer_title()}{#if timer.name}<span class="text-chalk"> · {timer.name}</span>{/if}
		</span>
		{#if timer.phase !== 'idle'}
			<span class="font-mono text-[11px] tracking-wider uppercase" style:color={accent}>
				{phaseLabel} · {timer.set}/{timer.sets}{#if timer.phase === 'work' || timer.phase === 'rest'}
					· {timer.round}/{timer.rounds}{/if}
			</span>
		{/if}
	</div>

	<div class="mt-2 text-center font-mono text-[56px] leading-none font-bold" style:color={accent}>
		{display}<span class="text-2xl text-ink-faint">s</span>
	</div>

	<div class="mt-2 mb-1 flex items-center justify-between gap-3 font-mono text-[11px] text-ink-faint">
		<span>{m.timer_left()} <span class="text-chalk">{timerClock(left)}</span></span>
		<span>{m.timer_total()} {timerClock(total)}</span>
	</div>
	<div class="mb-3 h-1 overflow-hidden rounded bg-panel">
		<div
			class="h-full rounded transition-[width] duration-500"
			style:width="{doneFrac * 100}%"
			style:background={accent}
		></div>
	</div>

	<div class="mb-3 flex justify-center gap-2.5">
		<Button
			class={cn(
				'text-white',
				timer.running ? 'bg-teal hover:bg-teal/90' : 'bg-flag hover:bg-flag/90'
			)}
			onclick={timer.running ? pauseTimer : startTimer}
		>
			{#if timer.running}<PauseIcon class="mr-1 size-4" />{m.btn_pause()}{:else}<PlayIcon
					class="mr-1 size-4"
				/>{m.btn_start()}{/if}
		</Button>
		<Button variant="outline" onclick={resetTimer} aria-label={m.btn_reset()}>
			<RotateCcwIcon class="size-4" />
		</Button>
	</div>

	<div class="grid grid-cols-3 gap-2">
		<label class="flex flex-col gap-1 font-mono text-[10px] tracking-wider text-ink-faint uppercase">
			{m.timer_work_s()}
			<Input type="number" min="1" bind:value={timer.work} class="h-8 bg-panel text-center text-sm" />
		</label>
		<label class="flex flex-col gap-1 font-mono text-[10px] tracking-wider text-ink-faint uppercase">
			{m.timer_rest_s()}
			<Input type="number" min="0" bind:value={timer.rest} class="h-8 bg-panel text-center text-sm" />
		</label>
		<label class="flex flex-col gap-1 font-mono text-[10px] tracking-wider text-ink-faint uppercase">
			{m.timer_rounds()}
			<Input
				type="number"
				min="1"
				bind:value={timer.rounds}
				class="h-8 bg-panel text-center text-sm"
			/>
		</label>
		<label class="flex flex-col gap-1 font-mono text-[10px] tracking-wider text-ink-faint uppercase">
			{m.timer_sets()}
			<Input type="number" min="1" bind:value={timer.sets} class="h-8 bg-panel text-center text-sm" />
		</label>
		<label class="flex flex-col gap-1 font-mono text-[10px] tracking-wider text-ink-faint uppercase">
			{m.timer_setrest_s()}
			<Input
				type="number"
				min="0"
				bind:value={timer.setRest}
				class="h-8 bg-panel text-center text-sm"
			/>
		</label>
	</div>
</div>
