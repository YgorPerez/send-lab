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
//    "still to come" from "you missed it". The mark reports state only. The day
//    type's colour appears once, on the day under the grid, attached to the day
//    type's own name where there is room for it to mean something.
//
// And the measured corollary: `--flag` at 10px on `--panel-2` is **4.34:1**,
// under the floor, while the same colour clears it on `--panel`. The surface
// decides, so the count is never `text-flag` — the state rides the mark, which
// wants 3:1. Since #121 the mark is a shape as well as a colour (`SLOT_MARK`),
// with a legend over the grid.
//
// ADR-0003 lives here more than anywhere else in the app: `WeekSlot` carries the
// `WeekdayKey` and the localized label as two fields, and only the key is ever
// matched on. **The check happens in pt-BR**, where `Seg` and `Mon` stop being
// the same string.
import { createFileRoute } from '@tanstack/react-router';
import { type ReactNode, useId, useMemo, useState } from 'react';
import { getContent } from '$lib/content';
import type { WeekdayKey } from '$lib/ids';
import * as m from '$lib/paraglide/messages';
import { getLocale } from '$lib/paraglide/runtime';
import { resolveWeek, type SlotState, type WeekSlot } from '$lib/screens/week';
import { useTrainingRecord } from '$lib/store/record';
import { Bare, Empty, Panes, ScreenHeader, Section } from '../components/ui/primitives';
import { card, chip } from '../components/ui/variants';

export const Route = createFileRoute('/week')({ component: Week });

/**
 * The state mark, and the only place a slot's state becomes a colour (#121).
 *
 * Each state has its own **shape** as well as its colour, so the five read
 * apart without the colour: a filled disc is trained, a cross missed, a ring
 * with a centre today, an empty ring to come, a dash rest. #63's 6px dots were
 * told apart by hue alone, teal and gold are the same luminance (1.00:1), and
 * rest was a `--line` ring at 1.56:1 on the cell: under the 3:1 a mark needs.
 * Every colour here clears 3:1 on both cell surfaces (`panel-2`, and `panel-3`
 * when selected); vermilion is the lowest at 3.86:1 on `panel-3`. The legend
 * draws these same marks, so a shape means one thing on the page.
 */
const SLOT_MARK: Record<SlotState, { tone: string; shape: ReactNode }> = {
	trained: { tone: 'text-ok', shape: <circle cx="6" cy="6" r="6" fill="currentColor" /> },
	missed: {
		tone: 'text-stop',
		shape: (
			<path
				d="M2 2l8 8M10 2l-8 8"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
			/>
		),
	},
	today: {
		tone: 'text-warn',
		shape: (
			<>
				<circle cx="6" cy="6" r="5" fill="none" stroke="currentColor" strokeWidth="2" />
				<circle cx="6" cy="6" r="2" fill="currentColor" />
			</>
		),
	},
	ahead: {
		tone: 'text-ink-faint',
		shape: <circle cx="6" cy="6" r="5" fill="none" stroke="currentColor" strokeWidth="1.5" />,
	},
	rest: {
		tone: 'text-ink-faint',
		shape: (
			<path d="M2 6h8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
		),
	},
};

/** Legend order: what happened, then where the athlete is, then what is left. */
const LEGEND: SlotState[] = ['trained', 'missed', 'today', 'ahead', 'rest'];

function SlotMark({ state }: { state: SlotState }) {
	const { tone, shape } = SLOT_MARK[state];
	return (
		<svg
			data-slot-mark=""
			data-state={state}
			aria-hidden="true"
			width="12"
			height="12"
			viewBox="0 0 12 12"
			className={`shrink-0 ${tone}`}
		>
			{shape}
		</svg>
	);
}

/**
 * The marks' key, over the grid rather than under it, so the selected day sits
 * directly under the grid on a phone (story 67). A list a screen reader can
 * read, and that `check:contrast` therefore measures; each cell also names its
 * state in words.
 */
function Legend() {
	return (
		<ul
			data-slot-legend=""
			aria-label={m.wk_legend()}
			className="flex flex-wrap gap-x-3.5 gap-y-1 text-[11px] text-ink-dim"
		>
			{LEGEND.map((state) => (
				<li key={state} className="inline-flex items-center gap-1.5">
					<SlotMark state={state} />
					{STATE_LABEL[state]()}
				</li>
			))}
		</ul>
	);
}

/**
 * The count's colour: teal once any of the slot's work is ticked, chalk until
 * then. Today's slot keeps its today mark when it is trained (`slotState`), so
 * the count is where "1 of 6 trained" finds its slot (#121's critique). Never
 * `text-flag` for `missed`: the signature vermilion at 10px on `--panel-2`
 * measured **4.34:1**, under the floor. The surface decides, so `missed` rides
 * the mark and the number stays chalk. A rest slot has no count: its mark says
 * rest, and #63's faint "—" measured 4.27:1 on the selected surface.
 */
const countClass = (slot: WeekSlot) => (slot.trained ? 'text-teal' : 'text-chalk');

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
	// What every cell changes, so a screen reader can say where the day went.
	const dayId = useId();

	return (
		// The page's frame, not a pane: at `lg` this is two panes, so the frame is
		// the full width the shell hands over and the header spans both.
		<div className="flex flex-col gap-sections">
			{/* The title is the bar's word, as on every screen. The week's number is
			    the grid's own head, in the glossary's words, so the header does not
			    say "Week" twice ("Week" over "Week 5 / 8", #121). */}
			<ScreenHeader title={m.nav_week()} meta={w.phase.name} />

			{/* THE CUT (#52).
			    `week` was recorded as "two columns, expected" before it was built, and
			    it is: a grid and the day it selects are two halves, and the cut is
			    already the phone order — grid, then day. So `Panes` costs the phone
			    screen nothing, and a wide screen stops making the athlete scroll past
			    the week to read the day it selected. */}
			<Panes
				primary={
					<Section
						face="sans"
						label={m.wk_training_week({ n: w.weekNumber, total: w.weekCount })}
						meta={
							// A phrase, so Inter at the meta size, not the eyebrow's mono.
							<span className="font-sans text-[11px] tracking-normal">
								{m.wk_adherence({ trained: w.trainedSlots, scheduled: w.scheduledSlots })}
							</span>
						}
					>
						<Legend />
						{/* Four columns is what 360px allows after the gutters; seven is
						    what the shape wants, and a wide screen has room for it. One
						    `lg:` utility, per ADR 0018 — no second layout. */}
						<div data-week-grid="" className="grid grid-cols-4 gap-1.5 lg:grid-cols-7">
							{w.slots.map((s) => (
								<SlotCell
									key={s.weekday}
									slot={s}
									on={s.weekday === selected}
									controls={dayId}
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
				secondary={slot ? <DayPanel id={dayId} slot={slot} /> : null}
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
function SlotCell({
	slot,
	on,
	controls,
	onSelect,
}: {
	slot: WeekSlot;
	on: boolean;
	/** The day's id: the region a tap on this cell changes. */
	controls: string;
	onSelect: () => void;
}) {
	const done = slot.tasks.filter((t) => t.done).length;

	return (
		<button
			type="button"
			onClick={onSelect}
			aria-pressed={on}
			aria-controls={controls}
			// The name a screen reader gets. `aria-label` REPLACES the button's
			// content rather than adding to it, so everything visible has to be in
			// here: the first version named the weekday, the day type and the state
			// and silently dropped the count — the one reading this file's own header
			// calls "what the page gets opened for". The mark is the only other
			// thing that would go unsaid, which is why the state is a word. A rest
			// slot has no count, and its day type and state are often the same word
			// ("Sun · Rest", not "Sun · Rest · Rest · Rest").
			aria-label={[
				slot.weekdayLabel,
				slot.day.type,
				slot.isRestDay ? null : `${done}/${slot.tasks.length}`,
				STATE_LABEL[slot.state](),
			]
				.filter((part): part is string => part !== null)
				.filter((part, i, parts) => part !== parts[i - 1])
				.join(' · ')}
			className={`flex min-h-[64px] flex-col justify-between rounded-md border p-1.5 text-left transition-colors ${
				on ? 'border-chalk/60 bg-panel-3' : 'border-line bg-panel-2 hover:border-chalk/40'
			}`}
		>
			<span className="flex items-center justify-between gap-1">
				{/* Selected: the selection language with its chalk edge (DESIGN.md ›
				    Navigation), so chalk and semibold on the label. */}
				<span className={`microlabel ${on ? 'font-semibold text-chalk' : 'text-ink-dim'}`}>
					{slot.weekdayLabel}
				</span>
				<SlotMark state={slot.state} />
			</span>
			{slot.state === 'rest' ? null : (
				<span className={`num text-[11px] ${countClass(slot)}`}>
					{done}/{slot.tasks.length}
				</span>
			)}
		</button>
	);
}

/**
 * The selected slot, in full, directly under the grid (#121, story 67).
 *
 * Headed with the weekday and the day type ("Thu · Pull"), so the head says which
 * cell it answers to; the cell itself carries the selection mark. The state is
 * on the right as the legend draws it, mark and word, and the load stays a
 * neutral chip: #63 tinted the load by the slot's state, which painted a missed
 * day's "HIGH" vermilion, as if the load were the alarm.
 */
function DayPanel({ id, slot }: { id: string; slot: WeekSlot }) {
	return (
		<div id={id} data-slot-day="">
			<Section
				face="sans"
				label={`${slot.weekdayLabel} · ${slot.day.type}`}
				meta={
					// Inter at the meta size, as Today's trend says its words.
					<span className="inline-flex items-center gap-2 font-sans text-[11px] tracking-normal text-ink-dim">
						{/* A rest day's head already says rest ("Sun · Rest"). */}
						{slot.isRestDay ? null : (
							<span className="inline-flex items-center gap-1.5">
								<SlotMark state={slot.state} />
								{STATE_LABEL[slot.state]()}
							</span>
						)}
						{/* A rest day's load is "OFF", the glossary's avoided "off day";
						    the head says rest. */}
						{slot.isRestDay ? null : <span className={chip()}>{slot.day.load}</span>}
					</span>
				}
			>
				<Bare className="flex flex-col gap-1.5">
					{/* The one place the day type's own accent appears, attached to its
					    own name. In the grid it would collide with the state colour. */}
					<span className="flex items-start gap-2">
						<span
							aria-hidden
							className="mt-1 h-4 w-[3px] shrink-0 rounded-full"
							style={{ background: slot.day.color }}
						/>
						{/* Today's plan card's recipe for the same two lines, so a day reads
						    at one rank on both screens. */}
						<span className="text-[13px] leading-snug font-medium text-ink">
							{slot.day.headline}
						</span>
					</span>
					<span className="text-[11px] leading-snug text-ink-dim">{slot.day.subhead}</span>
				</Bare>

				{slot.tasks.length > 0 ? (
					// `card` earning itself on the one rule it is allowed to: it holds a
					// list whose rows need a shared edge. The rows themselves get none.
					<ul className={card({ pad: 'none' })}>
						{slot.tasks.map((task, i) => (
							<li
								key={task.key}
								className={`flex min-h-11 items-center gap-2.5 px-3 py-2 ${
									i > 0 ? 'border-t border-line-soft' : ''
								}`}
							>
								<span
									aria-hidden
									className={`num w-3 text-[11px] ${task.done ? 'text-teal' : 'text-ink-faint'}`}
								>
									{task.done ? '✓' : '·'}
								</span>
								<span className="flex-1 text-[13px] text-ink">
									{task.exName}
									{task.done ? <span className="sr-only"> · {m.lbl_done()}</span> : null}
								</span>
							</li>
						))}
					</ul>
				) : null}
			</Section>
		</div>
	);
}
