// PROTOTYPE — THE WEEK SLOT GRID (#60). THROWAWAY.
//
// Three radically different answers to "how should `week` look and behave",
// switchable at `?variant=A|B|C` from the bar pinned at the bottom. None of this
// is production code: no tests, no error handling, no persistence, and one
// fixture week held in memory. The build ticket (#63) composes the winner
// properly against the store; it does not promote this file.
//
// WHY A THROWAWAY ROUTE AND NOT AN EXISTING PAGE
// ----------------------------------------------
// The prototype skill prefers hanging variants off a page that already exists,
// because a route on its own is a vacuum where every variant looks fine. `week`
// is one of the nine top-level surfaces and has no page yet, so there is nothing
// to hang it off. The vacuum is answered instead by the two things that actually
// expose a dense grid: this route renders inside the real `AppShell` (real top
// strip, real tabs, real rail at `lg`, real locale switch), and it carries a
// **populated** fixture week rather than the empty account the deployed preview
// shows signed out. #52's closing note is the warning being heeded — 426 elements
// where #69 measured 1008, "partly green-because-empty".
//
// THE TRAP, WHICH IS THE POINT OF DRAWING THIS PAGE AT ALL
// -------------------------------------------------------
// `week` is where ADR-0003's bug class is most likely to come back, because the
// English weekday labels are byte-identical to the stable keys. Every variant
// here keys state on a `WeekdayKey` minted in `lib/ids.ts` and renders labels
// from `content.builtInWeek[].label`, which is display-only. The two never touch.
// **Check it in pt-BR** — the locale switch is in the top strip — where `Seg`
// against `Mon` makes a label that leaked into a key immediately visible, and
// where the copy runs 1.4–2× longer and breaks the layout first.
//
// ADR-0002 is made visible on purpose: Thursday runs `pinch-wrist` and Wednesday
// runs `rest` in the fixture program, neither of which is that weekday's built-in
// day type. A day type keeps its identity wherever it is scheduled; the weekday
// is only calendar position. If a variant reads right only when the two line up,
// it is the wrong variant.
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getContent } from '$lib/content';
import type { Content, DayType } from '$lib/content/types';
import {
	asWeekdayKey,
	asWeekId,
	type ExerciseId,
	type TaskKey,
	taskKey,
	type WeekdayKey,
	type WeekId,
} from '$lib/ids';
import { getLocale } from '$lib/paraglide/runtime';
import {
	isSlotTrained,
	type ResolverState,
	resolveDay,
	trainableExerciseIds,
	weekCompletion,
} from '$lib/prescription';
import type { Program } from '$lib/types';
import { Bare, Eyebrow, Pane, Panes, Section } from '../components/ui/primitives';
import { card, chip } from '../components/ui/variants';

export const Route = createFileRoute('/prototype/week')({
	component: WeekPrototype,
	validateSearch: (search: Record<string, unknown>) => ({
		variant: typeof search.variant === 'string' ? search.variant : 'A',
	}),
});

// ---------------------------------------------------------------- the fixture
//
// In memory, rebuilt on every render of the route. Persistence is the thing this
// prototype is checking against — a slot grid has to be legible while half a week
// is done — not something it should depend on, so nothing here touches the store
// or a collection.

/** The training week the fixture sits in. Week 5 of 8: far enough in that
 *  progression has moved the numbers, close enough that the block is not over. */
const WEEK: WeekId = asWeekId(5);

/** The weekday the fixture calls "today". Thursday, so the week has a real past
 *  and a real future either side of it — a grid that only reads well on Monday
 *  or Sunday is a grid that was drawn against one column. */
const TODAY: WeekdayKey = asWeekdayKey('Thu');

function fixtureProgram(): Program {
	const template: Program['template'] = {};
	// ADR-0002, visible. Thursday's built-in day type is `pull`; this athlete runs
	// pinch/wrist work on it. Wednesday's is `endurance`; this athlete rests.
	// Neither weekday's identity changed — only what is scheduled on it.
	template[asWeekdayKey('Thu')] = { dayType: 'pinch-wrist' };
	template[asWeekdayKey('Wed')] = { dayType: 'rest' };
	return {
		weeks: 8,
		template,
		overrides: {},
		phases: [{ name: 'Base', weeks: 8, intensity: 100, volume: 100, deload: false }],
		autoProgress: true,
	};
}

function fixtureState(content: Content): ResolverState {
	const program = fixtureProgram();
	const taskDone: Record<string, boolean> = {};

	// A half-finished week, which is the only interesting one to draw — and one
	// that puts every state the design defines on screen at once, because a state
	// the fixture never reaches is a state nobody judges:
	//
	//   Mon  trained   ticked through
	//   Tue  missed    scheduled, in the past, untouched
	//   Wed  rest      not scheduled, so not missable
	//   Thu  today     part-way through
	//   Fri  ahead     scheduled, still to come
	//   Sat  ahead     ditto, and the shortest day — one task
	//   Sun  rest
	//
	// Tuesday is the load-bearing one. `missed` and `ahead` are both "scheduled
	// and not trained", and a week view that draws them the same way cannot answer
	// "did I miss anything", which is half of why the page is opened.
	const tickAll = (weekday: WeekdayKey) => {
		for (const id of trainableExerciseIds(content, bare(program), WEEK, weekday)) {
			taskDone[taskKey(WEEK, weekday, id)] = true;
		}
	};
	const tickFirst = (weekday: WeekdayKey) => {
		const [first] = trainableExerciseIds(content, bare(program), WEEK, weekday);
		if (first) taskDone[taskKey(WEEK, weekday, first)] = true;
	};

	tickAll(asWeekdayKey('Mon'));
	tickFirst(TODAY);

	return { ...bare(program), taskDone };
}

/** A resolver state with nothing ticked — needed while *building* the ticks,
 *  since `trainableExerciseIds` wants a state and the ticks are what we are
 *  computing. Cheap, and the alternative is threading a half-built object. */
function bare(program: Program): ResolverState {
	return {
		currentWeek: WEEK,
		program,
		swaps: {},
		slotDayType: {},
		slotExercises: {},
		taskSwaps: {},
		taskDone: {},
		sessions: [],
		baseline: null,
	};
}

// ------------------------------------------------------------------- the slots
//
// One shared resolver, because all three variants answer the same question about
// the same seven slots and only disagree about how to draw them. A shared *data*
// shape is fine; a shared layout would defeat the point of the exercise.

/** How a slot stands, as colour rather than as opacity. `--ok` / `--warn` /
 *  `--stop` are the semantic aliases; nothing here dims small text. */
type SlotState = 'trained' | 'today' | 'missed' | 'ahead' | 'rest';

interface Task {
	id: ExerciseId;
	/** `w5-Thu:pinch`. What completion is recorded against (ADR-0001). */
	key: TaskKey;
	/** Localized. Display only — never matched on. */
	name: string;
	done: boolean;
}

interface Slot {
	/** The identity. Minted in `lib/ids.ts`, never a label. */
	weekday: WeekdayKey;
	/** The label. Localized, display only — `Mon` in en-US and `Seg` in pt-BR,
	 *  which is the whole reason the two fields are not one field. */
	label: string;
	day: DayType;
	tasks: Task[];
	trained: boolean;
	state: SlotState;
}

function resolveSlots(content: Content, state: ResolverState): Slot[] {
	const order = content.builtInWeek.map((d) => d.k);
	return content.builtInWeek.map((entry) => {
		// The boundary where calendar position becomes an identity. `entry.k` is
		// plain `string` in the content layer by ADR-0013's rule about which way
		// imports may point; this is the one place it is vouched for.
		const weekday = asWeekdayKey(entry.k);
		const day = resolveDay(content, state, WEEK, weekday);
		const ids = trainableExerciseIds(content, state, WEEK, weekday);
		const trained = isSlotTrained(content, state, WEEK, weekday);
		const tasks = ids.map((id) => ({
			id,
			key: taskKey(WEEK, weekday, id),
			name: content.exercises[id]?.name ?? id,
			done: state.taskDone[taskKey(WEEK, weekday, id)] === true,
		}));

		let slotState: SlotState;
		if (ids.length === 0) slotState = 'rest';
		else if (weekday === TODAY) slotState = 'today';
		else if (trained) slotState = 'trained';
		// Past and untrained is a different fact from future and untrained, and a
		// week view that cannot tell them apart is a week view that cannot answer
		// "did I miss anything" — which is half of why the page is opened.
		else if (order.indexOf(entry.k) < order.indexOf(TODAY)) slotState = 'missed';
		else slotState = 'ahead';

		return { weekday, label: entry.label, day, tasks, trained, state: slotState };
	});
}

/**
 * Colour per state, on a border and on text — never a dimmed 9px label. The
 * 2.57:1 failure came from `opacity-55` on exactly this kind of grid.
 */
const STATE_TONE: Record<SlotState, 'ok' | 'warn' | 'stop' | 'neutral' | 'ghost'> = {
	trained: 'ok',
	today: 'warn',
	missed: 'stop',
	ahead: 'neutral',
	rest: 'ghost',
};

/**
 * The state dot, for the two variants whose cells are too small to carry a word.
 *
 * **This is state colour and never the day type's accent**, which is the finding
 * the first draft of this prototype produced: with the accent in the dot, `Sáb`
 * (performance, `--flag`) and `Ter` (scheduled and missed, also `--flag`) came
 * out the same red, and the strip could not tell "still to come" from "you missed
 * it" — the one question a week view exists to answer. The day type's own colour
 * survives only in variant A, where it is a bar attached to the day type's *name*
 * and the state has a chip of its own; at 44px there is room for one system.
 *
 * `ahead` and `rest` are separated structurally rather than by brightness: a
 * filled faint dot against a hollow ring. Two greys a step apart is the same
 * mistake as dimming, one axis over.
 */
const STATE_DOT: Record<SlotState, { background: string; boxShadow?: string }> = {
	trained: { background: 'var(--ok)' },
	today: { background: 'var(--warn)' },
	missed: { background: 'var(--stop)' },
	ahead: { background: 'var(--ink-faint)' },
	rest: { background: 'transparent', boxShadow: 'inset 0 0 0 1.5px var(--line)' },
};

// ------------------------------------------------------------------ variant A
//
// A WEEK IS A LIST. Seven full-width rows, scanned vertically, each one the same
// three-part line so the eye only moves down. This is Log's answer transplanted:
// the idiom the repo already has, and the one that costs pt-BR nothing because a
// full-width row grows downward rather than sideways.
//
// Primary affordance: open a row in place to see its tasks.

function VariantA({ slots }: { slots: Slot[] }) {
	const [open, setOpen] = useState<WeekdayKey | null>(TODAY);
	return (
		<Section label="Week 5" meta={<span className="num">7</span>}>
			{/* `card` earns itself here on the one rule it is allowed to: it holds a
			    list whose rows need a shared edge. Individual rows do not get one. */}
			<div className={card({ pad: 'none' })}>
				{slots.map((slot, i) => {
					const isOpen = open === slot.weekday;
					return (
						<div key={slot.weekday} className={i > 0 ? 'border-t border-line-soft' : ''}>
							<button
								type="button"
								onClick={() => setOpen(isOpen ? null : slot.weekday)}
								// 44px: this is touched mid-week, and a row that is only as
								// tall as its text is a row that gets mis-tapped.
								className="flex min-h-11 w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-panel-2"
							>
								{/* The weekday. A fixed column so the day types align down the
								    page, and wide enough for `Sáb` — pt-BR's longest. */}
								<span className="microlabel w-[30px] shrink-0 text-ink-dim">{slot.label}</span>
								<span
									aria-hidden
									className="h-7 w-[3px] shrink-0 rounded-full"
									style={{ background: slot.day.color }}
								/>
								<span className="min-w-0 flex-1">
									{/* Rank 2 and rank 3, differing on size, weight and colour at
									    once. One rank doing both jobs is what made Today read as
									    one long list. */}
									<span className="block truncate text-[13px] font-semibold text-chalk">
										{slot.day.type}
									</span>
									<span className="block truncate text-[11.5px] text-ink-dim">
										{slot.day.headline}
									</span>
								</span>
								<span className={chip({ tone: STATE_TONE[slot.state] })}>
									{slot.tasks.length === 0
										? slot.day.load
										: `${slot.tasks.filter((t) => t.done).length}/${slot.tasks.length}`}
								</span>
							</button>
							{isOpen && slot.tasks.length > 0 ? (
								<ul className="flex flex-col gap-1.5 px-3 pb-3">
									{slot.tasks.map((task) => (
										<li key={task.key} className="flex items-baseline gap-2">
											<span
												className={`num text-[10px] ${task.done ? 'text-teal' : 'text-ink-faint'}`}
											>
												{task.done ? '✓' : '·'}
											</span>
											<span className="flex-1 text-[12.5px] text-ink">{task.name}</span>
											{/* The key, on screen. A prototype's job is to surface the
											    state it is being judged on, and this is the string
											    ADR-0001 makes the source of truth. */}
											<span className="num text-[9px] text-ink-faint">{task.key}</span>
										</li>
									))}
								</ul>
							) : null}
						</div>
					);
				})}
			</div>
		</Section>
	);
}

// ------------------------------------------------------------------ variant B
//
// A WEEK IS A GRID. Four columns by two rows — the literal slot grid, and the
// densest thing in the app. Tapping a cell selects it; the selected slot's detail
// renders underneath on a phone and beside it from `lg`.
//
// This is the variant most likely to fail, and it is here to find out where. Four
// columns at 360px leaves ~79px a cell after the shell's padding and the gutters,
// which is under what `.microlabel` was measured against for a four-column grid.
// Day type names are the risk: "Limit / Power" fits and "Limite / Potência" does
// not, so the cell carries the load label — `HIGH` / `ALTO`, short in both — and
// the name is left to the detail below.

function VariantB({ slots }: { slots: Slot[] }) {
	const [selected, setSelected] = useState<WeekdayKey>(TODAY);
	const slot = slots.find((s) => s.weekday === selected) ?? slots[0];
	return (
		<Panes
			primary={
				<Section label="Week 5">
					<div className="grid grid-cols-4 gap-1.5">
						{slots.map((s) => {
							const on = s.weekday === selected;
							return (
								<button
									key={s.weekday}
									type="button"
									onClick={() => setSelected(s.weekday)}
									// State is the border and the text colour. Never opacity: a
									// dimmed 9px label in a grid this tight is the exact 2.57:1
									// failure twenty of twenty-four measurements came from.
									className={`flex min-h-[64px] flex-col justify-between rounded-md border p-1.5 text-left transition-colors ${
										on
											? 'border-chalk/60 bg-panel-3'
											: 'border-line bg-panel-2 hover:border-chalk/40'
									}`}
								>
									<span className="flex items-center justify-between gap-1">
										<span className="microlabel text-ink-dim">{s.label}</span>
										<span
											aria-hidden
											className="size-1.5 shrink-0 rounded-full"
											style={STATE_DOT[s.state]}
										/>
									</span>
									{/* MEASURED, and the reason this is not `text-flag` for `missed`.
									    The signature vermilion at 10px on `--panel-2` is **4.34:1**
									    — under the 4.5:1 floor, and `check:contrast` failed the
									    variant the moment the fixture grew a missed slot. `--flag`
									    is a fine *mark* colour on this panel (non-text wants 3:1)
									    and a failing *text* colour at this size, which is the whole
									    reason the dot above exists: at 10px the state has to be
									    carried by something that is not the number. */}
									<span
										className={`num text-[10px] ${
											s.state === 'trained'
												? 'text-teal'
												: s.state === 'rest'
													? 'text-ink-faint'
													: 'text-chalk'
										}`}
									>
										{s.tasks.length === 0
											? '—'
											: `${s.tasks.filter((t) => t.done).length}/${s.tasks.length}`}
									</span>
								</button>
							);
						})}
					</div>
				</Section>
			}
			secondary={
				slot ? (
					<Section label={slot.label} meta={<span className="num">{slot.day.load}</span>}>
						<Bare className="flex flex-col gap-1">
							<span className="text-[13px] font-semibold text-chalk">{slot.day.type}</span>
							<span className="text-[12px] text-ink-dim">{slot.day.headline}</span>
							<span className="text-[11.5px] text-ink-faint">{slot.day.subhead}</span>
						</Bare>
						{slot.tasks.length > 0 ? (
							<ul className="flex flex-col gap-1.5 pt-1">
								{slot.tasks.map((task) => (
									<li key={task.key} className="flex items-baseline gap-2">
										<span
											className={`num text-[10px] ${task.done ? 'text-teal' : 'text-ink-faint'}`}
										>
											{task.done ? '✓' : '·'}
										</span>
										<span className="flex-1 text-[12.5px] text-ink">{task.name}</span>
									</li>
								))}
							</ul>
						) : null}
						<span className="num pt-1 text-[9px] text-ink-faint">
							slot {WEEK}-{slot.weekday}
						</span>
					</Section>
				) : null
			}
		/>
	);
}

// ------------------------------------------------------------------ variant C
//
// A WEEK IS NAVIGATION; A DAY IS THE CONTENT. Seven 44px targets in one strip
// across the top, carrying nothing but the weekday and its state colour, and the
// selected day rendered in full underneath.
//
// The bet: the athlete opens `week` to answer "what am I doing today, and did I
// miss anything", which is one day plus a glance. Trading the grid's at-a-glance
// week for a legible day is the trade this variant is asking about — and it is
// the only one of the three whose density does not change between locales, since
// the strip carries no prose at all.

function VariantC({ slots, completion }: { slots: Slot[]; completion: string }) {
	const [selected, setSelected] = useState<WeekdayKey>(TODAY);
	const slot = slots.find((s) => s.weekday === selected) ?? slots[0];
	return (
		<Pane>
			<Section label="Week 5" meta={<span className="num">{completion}</span>}>
				{/* One row of seven. `min-w-0` on the children plus `flex-1` is what
				    keeps this from overflowing at 360px: seven equal cells of ~44px,
				    and no text long enough to push them. */}
				<div className="flex gap-1">
					{slots.map((s) => {
						const on = s.weekday === selected;
						return (
							<button
								key={s.weekday}
								type="button"
								onClick={() => setSelected(s.weekday)}
								className={`flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-md border transition-colors ${
									on ? 'border-chalk/60 bg-panel-3' : 'border-line bg-panel-2 hover:border-chalk/40'
								}`}
							>
								<span className={`microlabel ${on ? 'text-chalk' : 'text-ink-dim'}`}>
									{s.label}
								</span>
								<span aria-hidden className="size-1.5 rounded-full" style={STATE_DOT[s.state]} />
							</button>
						);
					})}
				</div>
			</Section>

			{slot ? (
				<Section
					label={slot.day.type}
					meta={<span className={chip({ tone: STATE_TONE[slot.state] })}>{slot.day.load}</span>}
				>
					<Bare className="flex flex-col gap-1.5">
						<span className="text-[13px] text-ink">{slot.day.headline}</span>
						<span className="text-[12px] text-ink-dim">{slot.day.subhead}</span>
					</Bare>
					{slot.tasks.length > 0 ? (
						<div className={card({ pad: 'none' })}>
							{slot.tasks.map((task, i) => (
								<div
									key={task.key}
									className={`flex min-h-11 items-center gap-2.5 px-3 ${
										i > 0 ? 'border-t border-line-soft' : ''
									}`}
								>
									<span className={`num text-[11px] ${task.done ? 'text-teal' : 'text-ink-faint'}`}>
										{task.done ? '✓' : '·'}
									</span>
									<span className="flex-1 text-[13px] text-ink">{task.name}</span>
									<span className="num text-[9px] text-ink-faint">{task.key}</span>
								</div>
							))}
						</div>
					) : (
						<Bare>
							<p className="text-[13px] text-ink-dim">{slot.day.subhead}</p>
						</Bare>
					)}
				</Section>
			) : null}
		</Pane>
	);
}

// ------------------------------------------------------------------ variant D
//
// THE MASH-UP, and the one the athlete asked for: **B's grid selecting C's day**.
//
// C won on the day and B won on the week, which is the split the two variants
// were actually testing. C's strip is seven 44px targets carrying a single dot,
// so it can say *how a day stands* and never *how much is left in it* — the
// count is the thing a week view is asked for and the strip has nowhere to put
// it. B's cell already carries weekday, state and count in 79px and is measured
// clean. So the selector is B's cell and the panel below is C's, unchanged: a day
// type promoted to the section heading, its load as a chip, and the tasks as 44px
// rows with their `TaskKey`s on them.
//
// It also settles the one thing C could not. #52 recorded `week` as **two
// columns, expected** — and C is a `Pane`, capped at 560px, spending none of the
// width the desktop layout was built to hand it. Going through `Panes` puts the
// grid beside the day rather than above it, and the cut is contiguous in the
// phone order (grid, then day), so `display: contents` below `lg` leaves the
// phone screen untouched. The wide screen earns *more visible at once*, which is
// the answer #52's second question wanted from this page.
//
// One `lg:` utility on top of that: the grid goes four columns to **seven** on a
// wide screen. A week is a row of seven days and always was; four columns is what
// 360px forces, not what the shape wants.

function VariantD({ slots, completion }: { slots: Slot[]; completion: string }) {
	const [selected, setSelected] = useState<WeekdayKey>(TODAY);
	const slot = slots.find((s) => s.weekday === selected) ?? slots[0];
	return (
		<Panes
			primary={
				<Section label="Week 5" meta={<span className="num">{completion}</span>}>
					<div className="grid grid-cols-4 gap-1.5 lg:grid-cols-7">
						{slots.map((s) => {
							const on = s.weekday === selected;
							return (
								<button
									key={s.weekday}
									type="button"
									onClick={() => setSelected(s.weekday)}
									className={`flex min-h-[64px] flex-col justify-between rounded-md border p-1.5 text-left transition-colors ${
										on
											? 'border-chalk/60 bg-panel-3'
											: 'border-line bg-panel-2 hover:border-chalk/40'
									}`}
								>
									<span className="flex items-center justify-between gap-1">
										<span className={`microlabel ${on ? 'text-chalk' : 'text-ink-dim'}`}>
											{s.label}
										</span>
										<span
											aria-hidden
											className="size-1.5 shrink-0 rounded-full"
											style={STATE_DOT[s.state]}
										/>
									</span>
									{/* Never `text-flag` here — 4.34:1 on `--panel-2` at 10px. The
									    dot carries `missed`; see the note in variant B. */}
									<span
										className={`num text-[10px] ${
											s.state === 'trained'
												? 'text-teal'
												: s.state === 'rest'
													? 'text-ink-faint'
													: 'text-chalk'
										}`}
									>
										{s.tasks.length === 0
											? '—'
											: `${s.tasks.filter((t) => t.done).length}/${s.tasks.length}`}
									</span>
								</button>
							);
						})}
					</div>
				</Section>
			}
			secondary={
				slot ? (
					<Section
						label={slot.day.type}
						meta={<span className={chip({ tone: STATE_TONE[slot.state] })}>{slot.day.load}</span>}
					>
						<Bare className="flex flex-col gap-1.5">
							<span className="text-[13px] text-ink">{slot.day.headline}</span>
							<span className="text-[12px] text-ink-dim">{slot.day.subhead}</span>
						</Bare>
						{slot.tasks.length > 0 ? (
							<div className={card({ pad: 'none' })}>
								{slot.tasks.map((task, i) => (
									<div
										key={task.key}
										className={`flex min-h-11 items-center gap-2.5 px-3 ${
											i > 0 ? 'border-t border-line-soft' : ''
										}`}
									>
										<span
											className={`num text-[11px] ${task.done ? 'text-teal' : 'text-ink-faint'}`}
										>
											{task.done ? '✓' : '·'}
										</span>
										<span className="flex-1 text-[13px] text-ink">{task.name}</span>
										<span className="num text-[9px] text-ink-faint">{task.key}</span>
									</div>
								))}
							</div>
						) : (
							<Bare>
								<p className="text-[13px] text-ink-dim">{slot.day.subhead}</p>
							</Bare>
						)}
					</Section>
				) : null
			}
		/>
	);
}

// ------------------------------------------------------------------ the route

const VARIANTS = ['D', 'A', 'B', 'C'] as const;
const VARIANT_NAME: Record<string, string> = {
	D: 'Grid and day — the mash-up',
	A: 'Seven rows',
	B: 'Four-column grid',
	C: 'Strip and day',
};

function WeekPrototype() {
	const locale = getLocale();
	const content = useMemo(() => getContent(locale), [locale]);
	const state = useMemo(() => fixtureState(content), [content]);
	const slots = useMemo(() => resolveSlots(content, state), [content, state]);
	const { trained, scheduled } = useMemo(
		() => weekCompletion(content, state, WEEK),
		[content, state],
	);

	const { variant } = Route.useSearch();
	const current = VARIANTS.includes(variant as (typeof VARIANTS)[number]) ? variant : 'D';

	return (
		<div className="flex flex-col gap-7">
			<header className="flex items-baseline justify-between gap-2 pt-1.5">
				<h1 className="h-screen-title">Week</h1>
				<Eyebrow>prototype · {locale}</Eyebrow>
			</header>

			{current === 'A' ? <VariantA slots={slots} /> : null}
			{current === 'B' ? <VariantB slots={slots} /> : null}
			{current === 'C' ? <VariantC slots={slots} completion={`${trained}/${scheduled}`} /> : null}
			{current === 'D' ? <VariantD slots={slots} completion={`${trained}/${scheduled}`} /> : null}

			<PrototypeSwitcher current={current} />
		</div>
	);
}

/**
 * The variant bar. Deliberately ugly and deliberately not from the vocabulary —
 * it must not read as part of the design being judged.
 *
 * Kept in this file rather than in `components/ui/`: it is throwaway, and a
 * switcher sitting in the vocabulary is the thing the skill warns rots fastest.
 *
 * NOT gated on `import.meta.env.PROD`, which is a deliberate departure from the
 * skill's default. The gate exists so a stray merge cannot ship the bar to an
 * athlete — but what would ship here is the whole route, not the bar, and the
 * route lives only on a throwaway branch that is never merged. Against that, #52
 * established that this app is judged **against the deployed preview** and not a
 * local build, and a bar that disappears in the production bundle is a bar the
 * athlete cannot use on the only build they will look at. `?variant=B` in the
 * address bar still works either way; this just means they do not have to type it.
 */
function PrototypeSwitcher({ current }: { current: string }) {
	const navigate = useNavigate({ from: '/prototype/week' });
	const go = useCallback(
		(step: number) => {
			const i = VARIANTS.indexOf(current as (typeof VARIANTS)[number]);
			const next = VARIANTS[(i + step + VARIANTS.length) % VARIANTS.length];
			navigate({ search: { variant: next }, replace: true });
		},
		[current, navigate],
	);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			const el = document.activeElement;
			// Don't steal the arrows from a field the athlete is typing in.
			if (
				el instanceof HTMLInputElement ||
				el instanceof HTMLTextAreaElement ||
				(el instanceof HTMLElement && el.isContentEditable)
			) {
				return;
			}
			if (e.key === 'ArrowLeft') go(-1);
			if (e.key === 'ArrowRight') go(1);
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [go]);

	return (
		<div className="fixed inset-x-0 bottom-20 z-30 flex justify-center lg:bottom-6">
			<div className="flex items-center gap-1 rounded-full border-2 border-chalk bg-bg px-1 py-1 shadow-lg">
				<button
					type="button"
					onClick={() => go(-1)}
					aria-label="Previous variant"
					className="flex size-8 items-center justify-center rounded-full text-chalk hover:bg-panel-3"
				>
					←
				</button>
				<span className="num px-1 text-[11px] whitespace-nowrap text-chalk">
					{current} · {VARIANT_NAME[current]}
				</span>
				<button
					type="button"
					onClick={() => go(1)}
					aria-label="Next variant"
					className="flex size-8 items-center justify-center rounded-full text-chalk hover:bg-panel-3"
				>
					→
				</button>
			</div>
		</div>
	);
}
