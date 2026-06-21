<script lang="ts">
import PauseIcon from '@lucide/svelte/icons/pause';
import PlayIcon from '@lucide/svelte/icons/play';
import RotateCcwIcon from '@lucide/svelte/icons/rotate-ccw';
import XIcon from '@lucide/svelte/icons/x';
import * as m from '$lib/paraglide/messages';
import {
	dismissTimer,
	pauseTimer,
	phaseColor,
	resetTimer,
	startTimer,
	timer,
	timerClock,
	timerLeft,
} from '$lib/timerStore.svelte';
import { cn } from '$lib/utils';

const phaseLabel = $derived(
	timer.phase === 'prepare'
		? m.timer_prepare()
		: timer.phase === 'work'
			? m.timer_work()
			: timer.phase === 'rest'
				? m.timer_rest()
				: timer.phase === 'setRest'
					? m.timer_setrest()
					: timer.phase === 'done'
						? m.timer_done()
						: m.timer_ready(),
);
const accent = $derived(phaseColor(timer.phase));
const display = $derived(timer.phase === 'idle' ? timer.work : timer.remaining);
</script>

<div
	class="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-panel/95 backdrop-blur-lg"
	role="region"
	aria-label={m.timer_title()}
>
	<div class="mx-auto flex max-w-[1080px] items-center gap-3 px-4 py-2.5">
		<span class="h-9 w-1.5 flex-none rounded" style:background={accent}></span>

		<div class="min-w-0 flex-1">
			<div class="truncate font-mono text-[10px] tracking-wider text-ink-faint uppercase">
				{phaseLabel} · {timer.set}/{timer.sets}{#if timer.phase === 'work' || timer.phase === 'rest'}
					· {timer.round}/{timer.rounds}{/if}
			</div>
			<div class="truncate text-[13px] font-semibold text-chalk">{timer.name || m.timer_title()}</div>
		</div>

		<div class="text-right leading-none">
			<div class="font-mono text-[26px] font-bold" style:color={accent}>
				{display}<span class="text-sm text-ink-faint">s</span>
			</div>
			<div class="font-mono text-[10px] text-ink-faint">{m.timer_left()} {timerClock(timerLeft())}</div>
		</div>

		<button
			type="button"
			class={cn(
				'flex size-9 items-center justify-center rounded-md text-white',
				timer.running ? 'bg-teal hover:bg-teal/90' : 'bg-flag hover:bg-flag/90'
			)}
			aria-label={timer.running ? m.btn_pause() : m.btn_start()}
			onclick={() => (timer.running ? pauseTimer() : startTimer())}
		>
			{#if timer.running}<PauseIcon class="size-4" />{:else}<PlayIcon class="size-4" />{/if}
		</button>
		<button
			type="button"
			class="flex size-9 items-center justify-center rounded-md border border-line text-ink-dim transition hover:text-ink"
			aria-label={m.btn_reset()}
			onclick={resetTimer}
		>
			<RotateCcwIcon class="size-4" />
		</button>
		<button
			type="button"
			class="flex size-9 items-center justify-center rounded-md text-ink-faint transition hover:text-flag"
			aria-label={m.btn_close()}
			onclick={dismissTimer}
		>
			<XIcon class="size-4" />
		</button>
	</div>
</div>
