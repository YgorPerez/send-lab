<script lang="ts">
import Settings2Icon from '@lucide/svelte/icons/settings-2';
import { toast } from 'svelte-sonner';
import { Card } from '$lib/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '$lib/components/ui/popover';
import { Progress } from '$lib/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
import { type Day, getContent, phaseId } from '$lib/content';
import Prose from '$lib/Prose.svelte';
import * as m from '$lib/paraglide/messages';
import {
	exerciseLabel,
	resolveDay,
	resolveSwapIndex,
	setDayPlan,
	setDaySwap,
	slotKey,
} from '$lib/plan';
import SectionHeading from '$lib/SectionHeading.svelte';
import { appState, today } from '$lib/state.svelte';
import { cn } from '$lib/utils';

const content = getContent();
const week = $derived(appState.currentWeek);
const phase = $derived(content.phases[phaseId(week)]);

const COMPOUND = ['Mon', 'Wed', 'Thu', 'Fri'];

/** Primary prescription label for a resolved day, with per-day swaps applied. */
function dayPrime(slot: string, day: Day): string {
	const ex = content.exercises[day.ex[0]];
	if (!ex) return day.prime;
	const base = exerciseLabel(ex, resolveSwapIndex(week, slot, day.ex[0]));
	const ex2 = day.ex[1] ? content.exercises[day.ex[1]] : undefined;
	if (ex2 && COMPOUND.includes(day.k)) {
		return `${base} → ${exerciseLabel(ex2, resolveSwapIndex(week, slot, day.ex[1]))}`;
	}
	return base;
}

function toggleDay(slot: string, label: string, day: Day, checked: boolean) {
	const id = slotKey(week, slot);
	if (checked) {
		appState.completed[id] = true;
		appState.log.unshift({
			date: today(),
			type: 'day',
			label: `W${week} ${label} · ${dayPrime(slot, day)}`,
			color: day.color,
			note: m.log_note_day({ load: day.load }),
		});
		toast.success(m.toast_day_logged({ day: label }));
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
		{#each content.days as slot (slot.k)}
			{@const resolved = resolveDay(content, week, slot.k)}
			{@const customized = resolved.k !== slot.k}
			{@const done = !!appState.completed[slotKey(week, slot.k)]}
			<Card class={cn('relative gap-2 overflow-hidden p-3.5', done && 'opacity-55')}>
				<span class="absolute inset-x-0 top-0 h-[3px]" style:background={resolved.color}></span>

				<div class="flex items-center justify-between">
					<span class="font-mono text-[11px] tracking-wider text-ink-faint uppercase">
						{slot.label}
					</span>
					<Popover>
						<PopoverTrigger
							class="text-ink-faint transition hover:text-ink"
							aria-label={m.wk_customize()}
						>
							<Settings2Icon class="size-3.5" />
						</PopoverTrigger>
						<PopoverContent class="w-72 border-line bg-panel">
							<div class="mb-1 font-mono text-[10px] tracking-wider text-ink-faint uppercase">
								{m.wk_protocol()}
							</div>
							<Select
								type="single"
								value={resolved.k}
								onValueChange={(v) => v && setDayPlan(week, slot.k, v)}
							>
								<SelectTrigger class="mb-3 h-9 w-full border-line bg-panel-2 text-xs">
									{resolved.label} · {resolved.load}
								</SelectTrigger>
								<SelectContent>
									{#each content.days as opt (opt.k)}
										<SelectItem value={opt.k}>{opt.label} · {opt.prime}</SelectItem>
									{/each}
								</SelectContent>
							</Select>

							{#each resolved.ex as exId (exId)}
								{@const ex = content.exercises[exId]}
								{#if ex}
									{@const idx = resolveSwapIndex(week, slot.k, exId)}
									<div class="mb-1 text-[11px] font-semibold text-ink-dim">{ex.name}</div>
									<Select
										type="single"
										value={String(idx)}
										onValueChange={(v) => v != null && setDaySwap(week, slot.k, exId, Number(v))}
									>
										<SelectTrigger class="mb-2.5 h-9 w-full border-line bg-panel-2 text-xs">
											{exerciseLabel(ex, idx)}
										</SelectTrigger>
										<SelectContent>
											{#each ex.swaps as sw, i (sw)}
												<SelectItem value={String(i)}>
													{i === 0 ? `${ex.name} · ${m.wk_default()}` : sw}
												</SelectItem>
											{/each}
										</SelectContent>
									</Select>
								{/if}
							{/each}
						</PopoverContent>
					</Popover>
				</div>

				<div
					class="font-mono text-[10px] font-bold tracking-wider uppercase"
					style:color={resolved.color}
				>
					{resolved.load}{#if customized}<span class="text-ink-faint"> · →{resolved.label}</span>{/if}
				</div>
				<div class="text-sm leading-snug font-bold">{dayPrime(slot.k, resolved)}</div>
				<div class="text-xs leading-snug text-ink-dim"><Prose value={resolved.sec} /></div>
				<label
					class="mt-auto flex cursor-pointer items-center gap-1.5 border-t border-line pt-2 text-xs text-ink-faint"
				>
					<input
						type="checkbox"
						checked={done}
						onchange={(e) => toggleDay(slot.k, slot.label, resolved, e.currentTarget.checked)}
						class="size-[15px] cursor-pointer accent-teal"
					/>
					{done ? m.lbl_done() : m.btn_mark_done()}
				</label>
			</Card>
		{/each}
	</div>
</section>
