// WEEK.
//
// The seven slots of the current training week: a grid of the whole week, and
// the selected slot in full underneath it.
//
// Composed against the prototype from [#60](https://github.com/YgorPerez/send-lab/issues/60),
// variant D, which the athlete chose after picking C's day and B's week out of
// four drawn options. The shape and the two findings below are that prototype's;
// this file is the rewrite against the store, not a promotion of it.
//
// WHY A GRID SELECTS AND A PANEL SHOWS
// ------------------------------------
// The two halves answer different questions and the prototype measured that they
// cannot be answered by the same control. A strip of seven 44px targets can say
// *how a day stands* and has nowhere to put *how much is left in it* — and the
// count is what the page gets opened for. A grid cell carries weekday, state and
// count in the 79px that 360px leaves after four gutters. So the week is the
// selector and the day is the content.
//
// THE TWO COLOUR RULES THIS PAGE IS THE HARDEST TEST OF
// ----------------------------------------------------
// 1. **State is colour, never opacity.** A grid of slots is exactly where
//    per-slot state wants to be dimmed, and `opacity-55` on a 9px label is the
//    measured 2.57:1 failure that twenty of twenty-four contrast failures came
//    from. Nothing here dims.
// 2. **The day type's accent and the slot's state cannot share one cell.** The
//    prototype put the accent in the dot and `Sat` (performance, `--flag`) came
//    out the same red as `Tue` (missed, also `--flag`) — the week could not tell
//    "still to come" from "you missed it". The dot reports state only. The day
//    type's colour appears once, on the panel below, attached to the day type's
//    own name where there is room for it to mean something.
//
// And the measured corollary: `--flag` at 10px on `--panel-2` is **4.34:1**,
// under the floor, while the same colour clears it on `--panel`. The surface
// decides, so the count is never `text-flag` — the state rides the dot, which is
// a mark and wants 3:1.
//
// ADR-0003 lives here more than anywhere else in the app: `WeekSlot` carries the
// `WeekdayKey` and the localized label as two fields, and only the key is ever
// matched on. **The check happens in pt-BR**, where `Seg` and `Mon` stop being
// the same string.
import { createFileRoute } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import type { VariantProps } from 'tailwind-variants';
import { getContent } from '$lib/content';
import type { WeekdayKey } from '$lib/ids';
import * as m from '$lib/paraglide/messages';
import { getLocale } from '$lib/paraglide/runtime';
import { resolveWeek, type SlotState, type WeekSlot } from '$lib/screens/week';
import { useTrainingRecord } from '$lib/store/record';
import { Bare, Empty, Panes, Section } from '../components/ui/primitives';
import { card, chip } from '../components/ui/variants';

/** `chip`'s own tone set, read off the recipe. */
type ChipTone = NonNullable<VariantProps<typeof chip>['tone']>;

export const Route = createFileRoute('/week')({ component: Week });

/**
 * The state mark, and the only place a slot's state becomes a colour.
 *
 * `ahead` and `rest` are separated structurally — a filled faint dot against a
 * hollow ring — rather than by brightness. Two greys a step apart is the dimming
 * mistake one axis over, and at this size there is no room between
 * de-emphasised and invisible.
 */
const STATE_DOT: Record<SlotState, { background: string; boxShadow?: string }> = {
	trained: { background: 'var(--ok)' },
	today: { background: 'var(--warn)' },
	missed: { background: 'var(--stop)' },
	ahead: { background: 'var(--ink-faint)' },
	rest: { background: 'transparent', boxShadow: 'inset 0 0 0 1.5px var(--line)' },
};

/** The chip tone for the day panel's load label, so the panel repeats the state
 *  the grid gave rather than restating the day type's accent a second time.
 *
 *  Typed off `chip` itself rather than re-listing its tones: a second copy of a
 *  closed set is a second thing to keep in step, and a tone dropped from the
 *  recipe should fail here rather than compile. */
const STATE_TONE: Record<SlotState, ChipTone> = {
	trained: 'ok',
	today: 'warn',
	missed: 'stop',
	ahead: 'neutral',
	rest: 'ghost',
};

/**
 * The count's colour, per state — the fourth thing keyed by `SlotState` and the
 * one that was a ternary cascade. Three `Record`s and one `? :` chain is the same
 * dispatch written two ways, and the cascade is the one that silently keeps
 * compiling when a state is added.
 *
 * Never `text-flag` for `missed`: the signature vermilion at 10px on `--panel-2`
 * measures **4.34:1**, under the floor, though it clears it on `--panel`. The
 * surface decides, so `missed` rides the dot and the number stays chalk.
 */
const STATE_COUNT_CLASS: Record<SlotState, string> = {
	trained: 'text-teal',
	today: 'text-chalk',
	missed: 'text-chalk',
	ahead: 'text-chalk',
	rest: 'text-ink-faint',
};

/** State as a word, for the cell's accessible name. The visual rule is "mark
 *  state with colour"; colour alone is not a name, so the button says it. */
const STATE_LABEL: Record<SlotState, () => string> = {
	trained: m.wk_state_trained,
	today: m.wk_state_today,
	missed: m.wk_state_missed,
	ahead: m.wk_state_ahead,
	rest: m.wk_state_rest,
};

function Week() {
	// Pinned once, like Today's. A resolver that re-reads the clock on every
	// render makes "today" move under a page the athlete is still looking at.
	const now = useMemo(() => Date.now(), []);
	// The store, live: a task ticked on Train appears here without this screen
	// knowing anything about how it got stored.
	const record = useTrainingRecord();
	const locale = getLocale();
	const content = useMemo(() => getContent(locale), [locale]);
	const w = useMemo(() => resolveWeek(content, record, now), [content, record, now]);

	// The selected slot, held by **identity**. A label here is the ADR-0003 bug
	// this page exists to not have: `'Seg' === selected` is false against a key
	// stored as `'Mon'`, and the selection would silently reset on a locale
	// switch. Defaulted to today, which is the slot the athlete is standing in.
	const [selected, setSelected] = useState<WeekdayKey>(w.today);
	const slot = w.slots.find((s) => s.weekday === selected) ?? w.slots[0];

	return (
		// The page's frame, not a pane: at `lg` this is two panes, so the frame is
		// the full width the shell hands over and the header spans both.
		<div className="flex flex-col gap-7">
			<header className="flex items-baseline justify-between gap-2 pt-1.5">
				<div className="min-w-0">
					<h1 className="h-screen-title">{m.nav_week()}</h1>
					<p className="mt-1 truncate text-[11.5px] text-ink-faint">{w.phase.name}</p>
				</div>
				<span className="num shrink-0 text-[11px] text-ink-faint">
					{m.week_label({ n: w.weekNumber })}
				</span>
			</header>

			{/* THE CUT (#52).
			    `week` was recorded as "two columns, expected" before it was built, and
			    it is: a grid and the day it selects are two halves, and the cut is
			    already the phone order — grid, then day. So `Panes` costs the phone
			    screen nothing, and a wide screen stops making the athlete scroll past
			    the week to read the day it selected. */}
			<Panes
				primary={
					<Section
						label={m.sec_week()}
						meta={
							<span className="num">
								{w.trainedSlots}/{w.scheduledSlots}
							</span>
						}
					>
						{/* Four columns is what 360px allows after the gutters; seven is
						    what the shape wants, and a wide screen has room for it. One
						    `lg:` utility, per ADR 0018 — no second layout. */}
						<div className="grid grid-cols-4 gap-1.5 lg:grid-cols-7">
							{w.slots.map((s) => (
								<SlotCell
									key={s.weekday}
									slot={s}
									on={s.weekday === selected}
									onSelect={() => setSelected(s.weekday)}
								/>
							))}
						</div>

						{/* #61: an empty group is copy, not furniture. The grid is never
						    empty — a week always has seven slots — so what is missing here
						    is the *work*, and saying so is more use than a box drawn round
						    seven rest days. No action on it yet: `program` is what fills a
						    week and it is unbuilt (#65), and an affordance that goes
						    nowhere is worse than none. */}
						{w.scheduledSlots === 0 ? <Empty value={m.wk_nothing_scheduled()} /> : null}
					</Section>
				}
				secondary={slot ? <DayPanel slot={slot} /> : null}
			/>
		</div>
	);
}

/**
 * One slot in the grid.
 *
 * `min-h-[64px]` rather than a fixed height, and no `whitespace-nowrap`: pt-BR
 * runs 1.4–2× longer and a cell that cannot grow is horizontal overflow at the
 * width this page is measured against. The weekday label is the longest thing in
 * it (`Sáb`), which is why the count sits on its own line rather than beside it.
 */
function SlotCell({ slot, on, onSelect }: { slot: WeekSlot; on: boolean; onSelect: () => void }) {
	const done = slot.tasks.filter((t) => t.done).length;

	return (
		<button
			type="button"
			onClick={onSelect}
			aria-pressed={on}
			// The name a screen reader gets. `aria-label` REPLACES the button's
			// content rather than adding to it, so everything visible has to be in
			// here: the first version named the weekday, the day type and the state
			// and silently dropped the count — the one reading this file's own header
			// calls "what the page gets opened for". The dot's colour is the only
			// other thing that would go unsaid, which is why the state is a word.
			aria-label={`${slot.weekdayLabel} · ${slot.day.type} · ${
				slot.isRestDay ? STATE_LABEL.rest() : `${done}/${slot.tasks.length}`
			} · ${STATE_LABEL[slot.state]()}`}
			className={`flex min-h-[64px] flex-col justify-between rounded-md border p-1.5 text-left transition-colors ${
				on ? 'border-chalk/60 bg-panel-3' : 'border-line bg-panel-2 hover:border-chalk/40'
			}`}
		>
			<span className="flex items-center justify-between gap-1">
				<span className={`microlabel ${on ? 'text-chalk' : 'text-ink-dim'}`}>
					{slot.weekdayLabel}
				</span>
				<span
					aria-hidden
					className="size-1.5 shrink-0 rounded-full"
					style={STATE_DOT[slot.state]}
				/>
			</span>
			<span className={`num text-[10px] ${STATE_COUNT_CLASS[slot.state]}`}>
				{slot.isRestDay ? '—' : `${done}/${slot.tasks.length}`}
			</span>
		</button>
	);
}

/**
 * The selected slot, in full.
 *
 * The day type is the section's heading rather than a line inside it — it is what
 * this half of the page is *about*, and the three ranks of type only read as
 * three when the top one is used for the thing at the top.
 */
function DayPanel({ slot }: { slot: WeekSlot }) {
	return (
		<Section
			label={slot.day.type}
			meta={<span className={chip({ tone: STATE_TONE[slot.state] })}>{slot.day.load}</span>}
		>
			<Bare className="flex flex-col gap-1.5">
				{/* The one place the day type's own accent appears, attached to its own
				    name. In the grid it would collide with the state colour. */}
				<span className="flex items-start gap-2">
					<span
						aria-hidden
						className="mt-1 h-4 w-[3px] shrink-0 rounded-full"
						style={{ background: slot.day.color }}
					/>
					<span className="text-[13px] text-ink">{slot.day.headline}</span>
				</span>
				<span className="text-[12px] text-ink-dim">{slot.day.subhead}</span>
			</Bare>

			{slot.tasks.length > 0 ? (
				// `card` earning itself on the one rule it is allowed to: it holds a
				// list whose rows need a shared edge. The rows themselves get none.
				<div className={card({ pad: 'none' })}>
					{slot.tasks.map((task, i) => (
						<div
							key={task.key}
							className={`flex min-h-11 items-center gap-2.5 px-3 py-2 ${
								i > 0 ? 'border-t border-line-soft' : ''
							}`}
						>
							<span
								aria-hidden
								className={`num text-[11px] ${task.done ? 'text-teal' : 'text-ink-faint'}`}
							>
								{task.done ? '✓' : '·'}
							</span>
							<span className="flex-1 text-[13px] text-ink">{task.exName}</span>
						</div>
					))}
				</div>
			) : null}
		</Section>
	);
}
