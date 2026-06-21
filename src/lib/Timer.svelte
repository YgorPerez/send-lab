<script lang="ts">
import PauseIcon from '@lucide/svelte/icons/pause';
import PlayIcon from '@lucide/svelte/icons/play';
import RotateCcwIcon from '@lucide/svelte/icons/rotate-ccw';
import { Button } from '$lib/components/ui/button';
import { Input } from '$lib/components/ui/input';
import * as m from '$lib/paraglide/messages';
import type { TimerSeed } from '$lib/plan';
import { cn } from '$lib/utils';

type Phase = 'idle' | 'work' | 'rest' | 'setRest' | 'done';

interface Props {
	/** When set, the timer loads this task's intervals (and shows its name). */
	seed?: TimerSeed | null;
}

let { seed = null }: Props = $props();

// Within-set cycle.
let work = $state(7);
let rest = $state(3);
let rounds = $state(6);
// Outer loop.
let sets = $state(1);
let setRest = $state(0);

let phase = $state<Phase>('idle');
let set = $state(0);
let round = $state(0);
let remaining = $state(0);
let running = $state(false);

let id: ReturnType<typeof setInterval> | undefined;

function beep(freq: number) {
	try {
		const ctx = new AudioContext();
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		osc.frequency.value = freq;
		osc.connect(gain);
		gain.connect(ctx.destination);
		gain.gain.setValueAtTime(0.12, ctx.currentTime);
		gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
		osc.start();
		osc.stop(ctx.currentTime + 0.2);
	} catch {
		// audio unavailable — silent timer is fine
	}
}

function stop() {
	if (id) clearInterval(id);
	id = undefined;
}

function finish() {
	stop();
	running = false;
	phase = 'done';
	remaining = 0;
	beep(880);
}

/** Advance past the end of a set (into the inter-set rest, next set, or done). */
function endOfSet() {
	if (set >= sets) return finish();
	if (setRest > 0) {
		phase = 'setRest';
		remaining = setRest;
		beep(330);
	} else {
		set += 1;
		round = 1;
		phase = 'work';
		remaining = Math.max(1, work);
		beep(660);
	}
}

function tick() {
	if (remaining > 1) {
		remaining -= 1;
		return;
	}
	if (phase === 'work') {
		if (round < rounds && rest > 0) {
			phase = 'rest';
			remaining = rest;
			beep(440);
		} else if (round < rounds) {
			round += 1;
			remaining = Math.max(1, work);
			beep(660);
		} else {
			endOfSet();
		}
	} else if (phase === 'rest') {
		round += 1;
		phase = 'work';
		remaining = Math.max(1, work);
		beep(660);
	} else if (phase === 'setRest') {
		set += 1;
		round = 1;
		phase = 'work';
		remaining = Math.max(1, work);
		beep(660);
	}
}

function start() {
	if (phase === 'idle' || phase === 'done') {
		set = 1;
		round = 1;
		phase = 'work';
		remaining = Math.max(1, work);
	}
	running = true;
	beep(660);
	stop();
	id = setInterval(tick, 1000);
}

function pause() {
	running = false;
	stop();
}

function reset() {
	stop();
	running = false;
	phase = 'idle';
	set = 0;
	round = 0;
	remaining = 0;
}

// Load the next task's intervals when it changes; manual edits persist until then.
let seededKey: string | undefined;
$effect(() => {
	const next = seed;
	if (next && next.key !== seededKey) {
		seededKey = next.key;
		work = next.work;
		rest = next.rest;
		rounds = next.rounds;
		sets = next.sets;
		setRest = next.setRest;
		reset();
	}
});

$effect(() => () => stop());

function clock(s: number): string {
	const sec = Math.max(0, Math.round(s));
	return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

const phaseLabel = $derived(
	phase === 'work'
		? m.timer_work()
		: phase === 'rest'
			? m.timer_rest()
			: phase === 'setRest'
				? m.timer_setrest()
				: phase === 'done'
					? m.timer_done()
					: m.timer_ready(),
);
const display = $derived(phase === 'idle' ? work : remaining);
const accent = $derived(
	phase === 'work'
		? 'var(--flag)'
		: phase === 'rest'
			? 'var(--teal)'
			: phase === 'setRest'
				? 'var(--violet)'
				: 'var(--ink-faint)',
);

// Whole-exercise duration and how much is left.
const perSet = $derived(rounds * work + Math.max(0, rounds - 1) * Math.max(0, rest));
const totalSec = $derived(sets * perSet + Math.max(0, sets - 1) * Math.max(0, setRest));
const leftSec = $derived.by(() => {
	const r = Math.max(0, rest);
	const sr = Math.max(0, setRest);
	if (phase === 'idle') return totalSec;
	if (phase === 'done') return 0;
	if (phase === 'setRest') return remaining + perSet + Math.max(0, sets - set - 1) * (sr + perSet);
	const inSet =
		phase === 'work'
			? remaining + (rounds - round) * (work + r)
			: remaining + (rounds - round) * work + Math.max(0, rounds - round - 1) * r;
	return inSet + (sets - set) * (sr + perSet);
});
const doneFrac = $derived(totalSec > 0 ? (totalSec - leftSec) / totalSec : 0);
</script>

<div class="rounded-xl border border-line bg-panel-2 p-4">
	<div class="flex items-center justify-between gap-2">
		<span class="min-w-0 truncate font-mono text-[10px] tracking-wider text-ink-faint uppercase">
			{m.timer_title()}{#if seed}<span class="text-chalk"> · {seed.name}</span>{/if}
		</span>
		{#if phase !== 'idle'}
			<span class="font-mono text-[11px] tracking-wider uppercase" style:color={accent}>
				{phaseLabel} · {set}/{sets}{#if phase === 'work' || phase === 'rest'}
					· {round}/{rounds}{/if}
			</span>
		{/if}
	</div>

	<div class="mt-2 text-center font-mono text-[56px] leading-none font-bold" style:color={accent}>
		{display}<span class="text-2xl text-ink-faint">s</span>
	</div>

	<div class="mt-2 mb-1 flex items-center justify-between gap-3 font-mono text-[11px] text-ink-faint">
		<span>{m.timer_left()} <span class="text-chalk">{clock(leftSec)}</span></span>
		<span>{m.timer_total()} {clock(totalSec)}</span>
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
			class={cn('text-white', running ? 'bg-teal hover:bg-teal/90' : 'bg-flag hover:bg-flag/90')}
			onclick={running ? pause : start}
		>
			{#if running}<PauseIcon class="mr-1 size-4" />{m.btn_pause()}{:else}<PlayIcon
					class="mr-1 size-4"
				/>{m.btn_start()}{/if}
		</Button>
		<Button variant="outline" onclick={reset} aria-label={m.btn_reset()}>
			<RotateCcwIcon class="size-4" />
		</Button>
	</div>

	<div class="grid grid-cols-3 gap-2">
		<label class="flex flex-col gap-1 font-mono text-[10px] tracking-wider text-ink-faint uppercase">
			{m.timer_work_s()}
			<Input type="number" min="1" bind:value={work} class="h-8 bg-panel text-center text-sm" />
		</label>
		<label class="flex flex-col gap-1 font-mono text-[10px] tracking-wider text-ink-faint uppercase">
			{m.timer_rest_s()}
			<Input type="number" min="0" bind:value={rest} class="h-8 bg-panel text-center text-sm" />
		</label>
		<label class="flex flex-col gap-1 font-mono text-[10px] tracking-wider text-ink-faint uppercase">
			{m.timer_rounds()}
			<Input type="number" min="1" bind:value={rounds} class="h-8 bg-panel text-center text-sm" />
		</label>
		<label class="flex flex-col gap-1 font-mono text-[10px] tracking-wider text-ink-faint uppercase">
			{m.timer_sets()}
			<Input type="number" min="1" bind:value={sets} class="h-8 bg-panel text-center text-sm" />
		</label>
		<label class="flex flex-col gap-1 font-mono text-[10px] tracking-wider text-ink-faint uppercase">
			{m.timer_setrest_s()}
			<Input type="number" min="0" bind:value={setRest} class="h-8 bg-panel text-center text-sm" />
		</label>
	</div>
</div>
