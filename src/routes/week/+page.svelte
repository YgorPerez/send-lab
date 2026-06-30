<script lang="ts">
import PlusIcon from '@lucide/svelte/icons/plus';
import Settings2Icon from '@lucide/svelte/icons/settings-2';
import XIcon from '@lucide/svelte/icons/x';
import { toast } from 'svelte-sonner';
import { Card } from '$lib/components/ui/card';
import { Progress } from '$lib/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
import { type Day, getContent, phaseId } from '$lib/content';
import type { VerdictId } from '$lib/content/types';
import Modal from '$lib/Modal.svelte';
import Prose from '$lib/Prose.svelte';
import * as m from '$lib/paraglide/messages';
import {
	addDayExercise,
	exerciseLabel,
	isDayCustomized,
	programWeeks,
	removeDayExercise,
	resetDay,
	resolveDay,
	resolveExerciseIds,
	resolveSwapIndex,
	setDayPlan,
	setDaySwap,
	slotKey,
} from '$lib/plan';
import SectionHeading from '$lib/SectionHeading.svelte';
import { appState, today } from '$lib/state.svelte';
import { cn } from '$lib/utils';
import VariantPicker from '$lib/VariantPicker.svelte';

const content = getContent();
// Today's logged readiness check, surfaced on today's card so the week reflects
// the recommendation from the Today tab.
const todayRd = $derived(appState.readinessLog.find((e) => e.date === today()));
// Which day's customize dialog is open (slot key), or null.
let editing = $state<string | null>(null);

// The week you're *viewing* is independent of the week you're actually *in*
// (appState.currentWeek). It defaults to the current week and follows it until
// you browse elsewhere with the selector — browsing never changes your progress.
let week = $state(appState.currentWeek);
let browsed = false;
$effect(() => {
	if (!browsed) week = appState.currentWeek;
});
const isCurrent = $derived(week === appState.currentWeek);
const weeks = $derived(programWeeks());
const phase = $derived(content.phases[phaseId(week, weeks)]);

const COMPOUND = ['Mon', 'Wed', 'Thu', 'Fri'];
const todayKey = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date().getDay()];

function viewWeek(i: number) {
	browsed = true;
	week = i;
}
function setCurrentWeek() {
	appState.currentWeek = week;
	toast.success(m.wk_now_in({ n: week }));
}

/** Primary prescription label for a slot, from its (possibly customized) list. */
function dayPrime(slot: string): string {
	const ids = resolveExerciseIds(content, week, slot);
	const first = ids[0] ? content.exercises[ids[0]] : undefined;
	if (!first) return resolveDay(content, week, slot).prime;
	const base = exerciseLabel(first, resolveSwapIndex(week, slot, ids[0]));
	const second = ids[1] ? content.exercises[ids[1]] : undefined;
	if (second && COMPOUND.includes(resolveDay(content, week, slot).k)) {
		return `${base} → ${exerciseLabel(second, resolveSwapIndex(week, slot, ids[1]))}`;
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
			label: `W${week} ${label} · ${dayPrime(slot)}`,
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
		<Progress value={(week / weeks) * 100} class="h-2.5 bg-panel-2" />
		<div class="flex flex-wrap gap-1.5">
			{#each Array.from({ length: weeks }, (_, i) => i + 1) as i (i)}
				<button
					type="button"
					onclick={() => viewWeek(i)}
					aria-current={i === appState.currentWeek ? 'true' : undefined}
					class={cn(
						'h-[30px] min-w-[34px] flex-1 rounded-md border font-mono text-[11px] transition',
						i === week
							? 'border-flag bg-flag font-bold text-white'
							: 'border-line bg-panel-2 text-ink-faint hover:text-ink',
						i === weeks && i !== week && 'border-teal text-teal',
						i === appState.currentWeek && 'ring-1 ring-chalk'
					)}
				>
					{i}
				</button>
			{/each}
		</div>
		<div class="flex items-center justify-between gap-2">
			<span class="font-mono text-[11px] text-ink-faint">
				{m.wk_current_week()} · {appState.currentWeek}/{weeks}
			</span>
			{#if !isCurrent}
				<button
					type="button"
					onclick={setCurrentWeek}
					class="rounded-md border border-line px-2.5 py-1 font-mono text-[10px] tracking-wider text-ink-dim uppercase transition hover:border-flag hover:text-flag"
				>
					{m.wk_set_current()}
				</button>
			{/if}
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
			{@const customized = isDayCustomized(week, slot.k)}
			{@const done = !!appState.completed[slotKey(week, slot.k)]}
			{@const exIds = resolveExerciseIds(content, week, slot.k)}
			{@const isToday = slot.k === todayKey && isCurrent}
			{@const avail = Object.entries(content.exercises).filter(
				([id]) => id !== 'rest' && !exIds.includes(id)
			)}
			<Card
				role="button"
				tabindex={0}
				aria-label={`${slot.label} · ${m.wk_customize()}`}
				onclick={(e) => {
					// Ignore clicks on inner controls (done toggle, glossary terms).
					if (editing === null && !(e.target as HTMLElement).closest('button, a, input, label')) {
						editing = slot.k;
					}
				}}
				onkeydown={(e) => {
					if ((e.key === 'Enter' || e.key === ' ') && editing === null) {
						e.preventDefault();
						editing = slot.k;
					}
				}}
				class={cn(
					'relative cursor-pointer gap-2 overflow-hidden p-3.5 transition hover:ring-1 hover:ring-line',
					done && 'opacity-55',
					isToday && 'opacity-100 ring-1 ring-flag/70'
				)}
			>
				<span class="absolute inset-x-0 top-0 h-[3px]" style:background={resolved.color}></span>

				<div class="flex items-center justify-between">
					<span
						class={cn(
							'font-mono text-[11px] tracking-wider uppercase',
							isToday ? 'font-bold text-flag' : 'text-ink-faint'
						)}
					>
						{slot.label}{#if isToday} · {m.td_today_label()}{/if}
					</span>
					<Settings2Icon class="size-3.5 text-ink-faint" />
				</div>

				<div
					class="font-mono text-[10px] font-bold tracking-wider uppercase"
					style:color={resolved.color}
				>
					{resolved.type} · {resolved.load}{#if customized}<span
							class="text-ink-faint"
							title={m.wk_customize()}> ✎</span
						>{/if}
				</div>
				{#if isToday && todayRd}
					{@const v = content.verdicts[todayRd.verdict as VerdictId]}
					<div
						class="font-mono text-[10px] leading-tight font-bold tracking-wider uppercase"
						style:color={v?.color}
					>
						↳ {m.rd_score()} {todayRd.score} · {v?.tag ?? todayRd.verdict}
					</div>
				{/if}
				<div class="text-sm leading-snug font-bold">{dayPrime(slot.k)}</div>
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

			{#if editing === slot.k}
				<Modal open title={`${slot.label} · ${m.wk_customize()}`} onClose={() => (editing = null)}>
					<div class="mb-1 font-mono text-[10px] tracking-wider text-ink-faint uppercase">
						{m.wk_protocol()}
					</div>
					<Select type="single" value={resolved.k} onValueChange={(v) => v && setDayPlan(week, slot.k, v)}>
						<SelectTrigger class="mb-3 h-9 w-full border-line bg-panel-2 text-xs">
							{resolved.type} · {resolved.load}
						</SelectTrigger>
						<SelectContent>
							{#each content.days as opt (opt.k)}
								<SelectItem value={opt.k}>{opt.type} · {opt.load}</SelectItem>
							{/each}
						</SelectContent>
					</Select>

					{#each exIds as exId (exId)}
						{@const ex = content.exercises[exId]}
						{#if ex}
							<div class="mb-1 flex items-center justify-between gap-2">
								<span class="text-[11px] font-semibold text-ink-dim">{ex.name}</span>
								<button
									type="button"
									class="text-ink-faint transition hover:text-flag"
									aria-label={m.btn_delete()}
									onclick={() => removeDayExercise(content, week, slot.k, exId)}
								>
									<XIcon class="size-3.5" />
								</button>
							</div>
							<div class="mb-2.5">
								<VariantPicker
									exercise={ex}
									idx={resolveSwapIndex(week, slot.k, exId)}
									onSelect={(i) => setDaySwap(week, slot.k, exId, i)}
								/>
							</div>
						{/if}
					{/each}

					{#if avail.length}
						<Select
							type="single"
							value=""
							onValueChange={(v) => v && addDayExercise(content, week, slot.k, v)}
						>
							<SelectTrigger class="h-9 w-full border-dashed border-line bg-panel-2 text-xs text-ink-dim">
								<PlusIcon class="mr-1 size-3.5" />{m.wk_add_ex()}
							</SelectTrigger>
							<SelectContent>
								{#each avail as [id, ex] (id)}
									<SelectItem value={id}>{ex.name}</SelectItem>
								{/each}
							</SelectContent>
						</Select>
					{/if}

					{#if customized}
						<button
							type="button"
							onclick={() => resetDay(week, slot.k)}
							class="mt-3 w-full rounded-md border border-line py-1.5 font-mono text-[10px] tracking-wider text-ink-faint uppercase transition hover:border-flag hover:text-flag"
						>
							{m.wk_reset_day()}
						</button>
					{/if}
				</Modal>
			{/if}
		{/each}
	</div>
</section>
