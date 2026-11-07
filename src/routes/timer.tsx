// TIMER (#101, redesigned as a list by #111).
//
// The clock outside a session: pick a protocol, run it. Nothing here is
// training — a run records no session, no set and no history — so the screen
// reads no prescription. What it does keep is the athlete's place in each
// protocol, as a draft on this device, under the same two rules as Train's
// (`timerSetup.ts`): it comes back paused, and only for the protocol it was left
// in.
//
// THE SCREEN IS ONLY THE LIST (#111)
// ----------------------------------
// The sticky clock strip and the Protocols | Stopwatch tabs went: the strip
// carried eleven things and the same total three times, above a list it was
// competing with. A clock is now a screen of its own, opened from a row, and
// the list is four groups, top to bottom (#119 put Saved first):
//
//   1. **Saved**, the athlete's own protocols, always open, and New protocol:
//      the ones they made are where they look first.
//   2. **Stopwatch**, one row, opening the stopwatch's clock.
//   3. **Recent**, the last three run that Saved does not already show — a
//      draft on this device (`recentProtocols.ts`), not training record.
//   4. **Presets**, grouped by exercise in one `RowGroup`, today's exercises'
//      groups open and the rest closed, so twenty-four rows in eight groups are
//      eight lines and the ones the session needs. Each group ends on the study
//      it cites, worded as the clock's ready state words it (`StudyLink`).
//
// The protocol the clock is on is marked on its row the way the navigation marks
// the current destination (DESIGN.md › Navigation, one selection language):
// chalk, semibold, a raised panel. The cue settings are the screen's one action,
// in the top strip's slot (#119), as the header pattern has it.
//
// A row is its name (the strongest text on it), its shape and how long it runs,
// and a tap on it opens its clock's ready state (#110): the sequence, the total,
// the study a preset cites, one Start. Nothing on a row starts a clock. What a
// row can do besides run is behind its own ⋯ beside it (`RowMenu`) — a
// separate, bordered 44px control, because an icon attached to a larger control
// does not read as one (`component-vocabulary.md`, the measured rules).
//
// THE MINI BAR
// ------------
// Only one of the protocol clock and the stopwatch runs at a time (#108): the
// press that starts one pauses the other through its `ClockHandle`. Whichever
// was started last owns the bar at the bottom of the list while it has a run
// underway — the segment's colour, the segment, the number, pause — and a tap on
// it goes back to its clock. A tap on another row while a protocol runs opens
// that row's ready state and leaves the run going: the running clock stays
// mounted beside the one being looked at, and only a Start moves the bar.
// Leaving the screen unmounts every clock, which is today's rule: they pause,
// and come back paused.

import { createFileRoute } from '@tanstack/react-router';
import { ChevronRight, Plus, Timer as TimerIcon } from 'lucide-react';
import { type ReactNode, useCallback, useMemo, useRef, useState } from 'react';
import { useClockFront } from '$lib/clockFront';
import { getContent } from '$lib/content';
import { clock } from '$lib/format';
import { type ProtocolKey, savedProtocolKey } from '$lib/ids';
import * as m from '$lib/paraglide/messages';
import { getLocale } from '$lib/paraglide/runtime';
import { BLANK_PROTOCOL, PROTOCOL_FIELDS } from '$lib/protocol';
import { recentOf, useRecentProtocols } from '$lib/recentProtocols';
import {
	type PresetGroup,
	type ProtocolListing,
	resolveTimer,
	type SavedProtocolListing,
	todaysPresetGroups,
} from '$lib/screens/timer';
import { useTrainingRecord } from '$lib/store/record';
import {
	createSavedProtocol,
	deleteSavedProtocol,
	updateSavedProtocol,
} from '$lib/store/savedProtocols';
import { useLastTimerProtocol } from '$lib/timerSetup';
import type { NamedProtocol } from '$lib/types';
import { cn } from '$lib/utils';
import { CueSettingsShortcut } from '../components/CueSettings';
import { type EditorTarget, ProtocolEditor } from '../components/ProtocolEditor';
import { Stopwatch } from '../components/Stopwatch';
import { type ClockHandle, StudyLink, Timer } from '../components/Timer';
import { AlertDialog } from '../components/ui/AlertDialog';
import { type MenuAction, RowMenu } from '../components/ui/Menu';
import { Empty, Pane, ScreenHeader, Section } from '../components/ui/primitives';
import { Row, RowGroup } from '../components/ui/Rows';
import { button } from '../components/ui/variants';

export const Route = createFileRoute('/timer')({
	component: TimerScreen,
	// The screen's one action, in the top strip (#119): the header keeps readings
	// (DESIGN.md › The screen header), and the Timer has none to show.
	staticData: { screenAction: CueSettingsShortcut },
});

function TimerScreen() {
	const locale = getLocale();
	const record = useTrainingRecord();
	const content = getContent(locale);
	const screen = useMemo(() => resolveTimer(content, record, locale), [content, record, locale]);
	const { runnable } = screen;

	// WHICH PROTOCOL THE CLOCK IS ON, held by identity.
	//
	// It opens on the one the athlete left the clock in, so coming back to this
	// screen finds the same clock, paused where it stopped — and, if that was
	// mid-run, its bar at the bottom of the list. After that only a tap on a row
	// changes it. Each protocol keeps its own place (`ClockShelf` in
	// `timerSetup.ts`), so a tap on another row and back finds the first one
	// where it was left.
	//
	// `selected` is the athlete's: the row they last opened, or the one the clock
	// was left in. It is what the list marks (#119), so it is `null` until there
	// is one — a fresh visit marks nothing rather than whatever is listed first.
	const last = useLastTimerProtocol();
	const [selected, setSelected] = useState<ProtocolKey | null>(
		() => runnable.find((r) => r.key === last)?.key ?? null,
	);
	// The protocol the bar belongs to: the one started last, and at first the
	// one the clock was left in, so a place left mid-run is in the bar on return.
	// Kept apart from `selected` because a look at another row while one runs
	// must not stop it: the running clock stays mounted beside the one opened.
	const [running, setRunning] = useState(() => selected ?? runnable[0]?.key ?? null);
	// Which clock is up, owned here rather than by the Timer: a tap on a row
	// picks the protocol and opens its clock in one go.
	const [openKey, setOpenKey] = useState<ProtocolKey | null>(null);
	const [watchOpen, setWatchOpen] = useState(false);
	// Which clock has the bar: kept on the device (`clockFront.ts`), because both
	// come back paused from another screen and only this says which of the two
	// was started last — a stopwatch left mid-count comes back in the bar.
	const [front, setFront] = useClockFront();
	// A deleted saved protocol takes the selection with it; the clock moves to the
	// top of the list rather than vanishing, and the list marks nothing.
	const marked = runnable.find((r) => r.key === selected)?.key ?? null;
	const current = runnable.find((r) => r.key === marked) ?? runnable[0] ?? null;
	const behind = running === current?.key ? null : runnable.find((r) => r.key === running);
	const clocks = useRef(new Map<string, ClockHandle>());
	const stopwatch = useRef<ClockHandle>(null);
	/** Pause every protocol clock but `except`: only one clock runs at a time. */
	const pauseClocks = (except?: string) => {
		for (const [key, clock] of clocks.current) if (key !== except) clock.pause();
	};

	const [recentStored, recordRun] = useRecentProtocols();
	const savedKeys = useMemo(() => new Set<string>(screen.saved.map((s) => s.key)), [screen.saved]);
	const recent = recentOf(recentStored, runnable, savedKeys);

	const openClock = (key: ProtocolKey) => {
		setSelected(key);
		setOpenKey(key);
	};

	// WHICH PRESET GROUPS ARE OPEN: today's, at first (#119) — the exercises the
	// plan schedules today that carry presets — and after that whatever the
	// athlete opens. Read once, at mount: a group does not fold under the athlete
	// because the clock crossed midnight.
	//
	// Today's groups also lead the list, each head saying so: open and unlabelled
	// in the library's order, they sat under four closed heads and below the fold
	// at 360px, with nothing saying why those two were open (#119 critique).
	const [todays] = useState<ReadonlySet<string>>(
		() => new Set(todaysPresetGroups(screen, content, record, Date.now())),
	);
	const [openGroups, setOpenGroups] = useState<string[]>(() => [...todays]);
	const groups = useMemo(
		() => [
			...screen.presets.filter((g) => todays.has(g.exercise)),
			...screen.presets.filter((g) => !todays.has(g.exercise)),
		],
		[screen.presets, todays],
	);

	// THE TAPPED HEAD STAYS UNDER THE FINGER.
	//
	// Presets is the last thing on the page, so closing a group near the end
	// shortens the page under a scroll position that may no longer exist: the
	// browser clamps it, everything slides down, and a quick second tap, chalky
	// and one-handed, lands on a neighbour. So before the change renders, the
	// page is given back at its end whatever the closing panel takes that the
	// room below the screen cannot absorb, and an open hands back what is no
	// longer needed. Measured at the press rather than after it, because the
	// panel closes over 190ms (`.a-panel`) and nothing has moved yet when the
	// render lands.
	const tail = useRef<HTMLDivElement>(null);
	const toggleGroups = (next: string[], event: Event) => {
		const end = tail.current;
		if (end) {
			const head = event.target instanceof Element ? event.target.closest('[aria-controls]') : null;
			const stays = new Set(next);
			const closing = openGroups.some((g) => !stays.has(g));
			const panelId = closing ? head?.getAttribute('aria-controls') : null;
			const panel = panelId ? document.getElementById(panelId) : null;
			const shrink = panel?.getBoundingClientRect().height ?? 0;
			const room = document.documentElement.scrollHeight - window.innerHeight - window.scrollY;
			const held = Number.parseFloat(end.style.height) || 0;
			const keep = Math.max(0, held + shrink - room);
			end.style.height = keep ? `${keep}px` : '';
		}
		setOpenGroups(next);
	};

	// A copy or a new protocol lands at the end of Saved, which may be off the
	// screen — the athlete was looking at a preset further down — so the new row
	// is scrolled to. The nearest edge, not the centre, and clear of the app bar
	// and the mini bar: centring a row near the top slid the screen title under
	// the app bar (#111). Once: the ref is stable, so React calls it when the row
	// first mounts and not on every render after.
	const [made, setMade] = useState<ProtocolKey | null>(null);
	const reveal = useCallback((el: HTMLElement | null) => {
		el?.scrollIntoView({ block: 'nearest' });
	}, []);
	// One copy per tap. The 700ms guard that stood here (#103) was for a
	// Duplicate scrolled under a thumb still coming down for a second tap; since
	// #111 Duplicate is behind each row's ⋯, two taps from any thumb, so that tap
	// cannot land on it. What is left is the menu fading out under the finger,
	// which takes no taps while it does (`RowMenu`): no window to choose.
	const duplicate = async (source: ProtocolListing) => {
		const row = await createSavedProtocol({ name: source.copyName, protocol: source.protocol });
		setMade(savedProtocolKey(row.id));
	};

	// THE EDITOR (#104; its own screen since #112): one for a new protocol and an edited one. What it
	// is open on is kept apart from whether it is open, as the delete question's
	// is, so its title does not change while it slides away.
	const [editorOpen, setEditorOpen] = useState(false);
	const [editing, setEditing] = useState<{
		target: EditorTarget;
		row: SavedProtocolListing | null;
	} | null>(null);
	const openEditor = (row: SavedProtocolListing | null) => {
		setEditing({
			target: row
				? // An unnamed one opens with its name empty, not filled in with the
					// shape it is listed under (#112).
					{ kind: 'edit', name: row.named ? row.name : '', protocol: row.protocol }
				: { kind: 'new', protocol: BLANK_PROTOCOL },
			row,
		});
		setEditorOpen(true);
	};
	const save = async (named: NamedProtocol) => {
		if (editing?.row) {
			await updateSavedProtocol(editing.row.id, named);
			return;
		}
		const row = await createSavedProtocol(named);
		setMade(savedProtocolKey(row.id));
	};

	// The protocol the delete question is about, kept apart from whether the
	// question is open, so the title does not lose its name while it closes.
	const [doomed, setDoomed] = useState<SavedProtocolListing | null>(null);
	const [confirming, setConfirming] = useState(false);
	// A delete waits for the account to answer first (`store/savedProtocols.ts`),
	// which offline can take a while; the question stays up, its confirm spent,
	// until the row is gone, rather than closing on a row that is still listed.
	const [deleting, setDeleting] = useState(false);

	/**
	 * A protocol's ⋯: Edit, Duplicate and Delete for a saved protocol, Edit first
	 * because it is the common one, on its row and in its clock's ready state. A
	 * preset is the library's, so the one thing to do with it besides running it
	 * is to keep a copy that is the athlete's, and that is in its ready state's ⋯
	 * only: on the list it would be a menu of one item beside every preset, the
	 * loudest outline in the card and 50px off every name (#119 critique). Picked
	 * from the ready state, each leaves the clock first, for the list, the editor
	 * or the question it leads to. Delete is worded, not coloured; the question it
	 * opens is what guards it.
	 */
	const rowActions = (p: ProtocolListing, placement: 'row' | 'header') => {
		const own = screen.saved.find((s) => s.key === p.key);
		if (!own && placement === 'row') return null;
		const leave = () => setOpenKey(null);
		const copy: MenuAction = {
			label: m.timer_duplicate(),
			onSelect: () => {
				leave();
				void duplicate(p);
			},
		};
		const actions: MenuAction[] = own
			? [
					{
						label: m.timer_edit(),
						onSelect: () => {
							leave();
							openEditor(own);
						},
					},
					copy,
					{
						label: m.btn_delete(),
						onSelect: () => {
							leave();
							setDoomed(own);
							setConfirming(true);
						},
					},
				]
			: [copy];
		return (
			<RowMenu
				label={m.timer_row_actions({ name: p.name })}
				actions={actions}
				placement={placement}
			/>
		);
	};
	const row = (p: ProtocolListing, inGroup = false) => (
		<ProtocolRow
			key={p.key}
			row={p}
			current={p.key === marked}
			inGroup={inGroup}
			onOpen={() => openClock(p.key)}
			reveal={p.key === made ? reveal : undefined}
			actions={rowActions(p, 'row')}
		/>
	);

	return (
		// Capped, like Train: one list, picked one-handed, and a wider list says
		// nothing more about a protocol.
		<Pane className="gap-sections">
			<ScreenHeader title={m.nav_timer()} />

			<Section face="sans" label={m.timer_saved()}>
				{screen.saved.length ? (
					<div className="flex flex-col gap-row">
						{screen.saved.map((p) => row(p))}
						<NewProtocol onClick={() => openEditor(null)} />
					</div>
				) : (
					// The copy names both ways in; the one that is not a preset's
					// action is right under it.
					<Empty
						value={m.timer_saved_empty()}
						action={<NewProtocol onClick={() => openEditor(null)} />}
					/>
				)}
			</Section>

			{/* One row, not a section: a heading saying "Stopwatch" over a row saying
			    it again would be the same word twice. Its leading icon is what sets it
			    apart from the protocol rows above it. */}
			<button
				type="button"
				aria-haspopup="dialog"
				onClick={() => setWatchOpen(true)}
				className={cn(ROW, 'w-full')}
			>
				<TimerIcon
					size={20}
					strokeWidth={1.75}
					aria-hidden="true"
					className="shrink-0 text-ink-dim"
				/>
				<span className="min-w-0 flex-1 text-[16px] leading-tight font-semibold text-ink">
					{m.timer_stopwatch()}
				</span>
				<ChevronRight
					size={18}
					strokeWidth={2}
					aria-hidden="true"
					className="shrink-0 text-ink-faint"
				/>
			</button>

			<Section face="sans" label={m.timer_recent()}>
				{recent.length ? (
					<div className="flex flex-col gap-row">{recent.map((p) => row(p))}</div>
				) : (
					<Empty value={m.timer_recent_empty()} />
				)}
			</Section>

			<Section face="sans" label={m.timer_presets()}>
				<RowGroup multiple value={openGroups} onValueChange={toggleGroups}>
					{groups.map((g) => (
						<Row
							key={g.exercise}
							value={g.exercise}
							touch
							summary={<GroupHead group={g} today={todays.has(g.exercise)} />}
						>
							<div className="flex flex-col gap-row">{g.presets.map((p) => row(p, true))}</div>
							{/* Every group's citation in one place, its last line, on the
							    rows' left edge, worded as the ready state words it. A
							    group whose exercise cites no study has no line. */}
							{g.study ? <StudyLink study={g.study} className="mt-1 px-2.5" /> : null}
						</Row>
					))}
				</RowGroup>
			</Section>
			<div ref={tail} aria-hidden="true" data-tail="" className="-mt-sections" />

			{[behind, current].map((p) => {
				if (!p) return null;
				// A preset cites the study its exercise rests on; its clock links it
				// from the ready state (#110). A saved protocol cites none.
				const group = screen.presets.find((g) => g.presets.some((q) => q.key === p.key));
				return (
					<Timer
						// Remounted when the protocol's numbers change, not only when
						// another one is picked: an edited saved protocol (#104) is a
						// different protocol, and its clock starts clean on it — the
						// draft's own rule for a protocol that is not the one it was
						// left in. A rename keeps the clock where it is.
						key={`${p.key}|${PROTOCOL_FIELDS.map((f) => p.protocol[f]).join(',')}`}
						ref={(clock: ClockHandle | null) => {
							if (clock) clocks.current.set(p.key, clock);
							else clocks.current.delete(p.key);
						}}
						onStart={() => {
							pauseClocks(p.key);
							stopwatch.current?.pause();
							setRunning(p.key);
							setFront('protocol');
							recordRun(p.key);
						}}
						home="timer"
						protocol={p.protocol}
						label={p.label}
						protocolKey={p.key}
						clockOpen={openKey === p.key}
						onClockOpenChange={(open) => setOpenKey(open ? p.key : null)}
						editable={false}
						strip={front === 'protocol' && p.key === running ? 'bar' : 'none'}
						titleSpoken={false}
						study={group?.study ?? null}
						title={p.name}
						subtitle={group?.name ?? null}
						actions={rowActions(p, 'header')}
					/>
				);
			})}
			<Stopwatch
				ref={stopwatch}
				open={watchOpen}
				onOpenChange={setWatchOpen}
				bar={front === 'stopwatch'}
				onStart={() => {
					pauseClocks();
					setFront('stopwatch');
				}}
			/>

			<ProtocolEditor
				open={editorOpen}
				onOpenChange={setEditorOpen}
				target={editing?.target ?? null}
				onSave={save}
			/>

			<AlertDialog
				open={confirming}
				onOpenChange={setConfirming}
				title={m.timer_delete_title({ name: doomed?.name ?? '' })}
				description={m.timer_delete_body()}
				cancel={m.btn_cancel()}
				confirm={m.btn_delete()}
				busy={deleting}
				onConfirm={async () => {
					if (!doomed) return;
					setDeleting(true);
					try {
						await deleteSavedProtocol(doomed.id);
						setConfirming(false);
					} finally {
						setDeleting(false);
					}
				}}
			/>
		</Pane>
	);
}

/**
 * The surface every row on the list shares — the stopwatch's, a protocol's —
 * so their left edges, their height and their padding are one rule.
 */
const ROW =
	'flex min-h-14 min-w-0 items-center gap-3 rounded-xl border border-transparent bg-panel px-3.5 py-2.5 text-left transition-colors hover:bg-panel-2';

/**
 * One protocol: its name, its shape, how long it runs; and beside it, not in
 * it, what else it can do. A tap opens its clock's ready state, which is where
 * Start is, so a stray tap on the list never starts anything.
 *
 * In Saved and Recent a row is its own surface. Inside a preset group it is a
 * line in the group's card with no surface of its own, because a card is never
 * inside another card (DESIGN.md › The group pattern).
 *
 * The protocol the clock is on is marked as the navigation marks the current
 * destination (#119): a raised panel, and chalk on every line, with the shape
 * line in semibold — the name is semibold on every row, so the weight that
 * changes is the line under it. And a chalk edge, as Train's clock button and a
 * picked option carry: the bar's mark starts from faint ink on the ground, a
 * row's from ink on a panel, and there the surface step (1.27:1) and chalk
 * against ink (1.11:1) alone did not show which protocol the mini bar runs
 * (#119 critique). The edge is non-text contrast, well over 3:1.
 *
 * Inside a group a name is set in the head's 15px rather than the rows' 16px:
 * a 16px child outranked its 15px head, and the head leads by its place, its
 * rule and its chevron.
 */
function ProtocolRow({
	row,
	current,
	inGroup,
	onOpen,
	actions,
	reveal,
}: {
	row: { name: string; shape: string; total: number; named: boolean };
	current: boolean;
	inGroup: boolean;
	onOpen: () => void;
	/** Its ⋯, or nothing: a preset's one action is in its ready state. */
	actions: ReactNode;
	/** Scrolls a row just made into view. */
	reveal?: (el: HTMLElement | null) => void;
}) {
	return (
		// Clear of the app bar above and the mini bar below when it is scrolled to.
		<div ref={reveal} className="flex scroll-mt-16 scroll-mb-24 items-stretch gap-1.5">
			<button
				type="button"
				aria-haspopup="dialog"
				aria-current={current ? 'true' : undefined}
				onClick={onOpen}
				className={cn(
					ROW,
					'flex-1',
					inGroup && 'rounded-lg bg-transparent px-2.5',
					current && 'border-chalk/60 bg-panel-3 hover:bg-panel-3',
				)}
			>
				{/* The separators are spoken only: without them a screen reader runs the
				    name, the shape and the length into one word. */}
				<span className="flex min-w-0 flex-1 flex-col gap-0.5">
					<span
						className={cn(
							'line-clamp-2 leading-tight font-semibold',
							inGroup ? 'text-[15px]' : 'text-[16px]',
							current ? 'text-chalk' : 'text-ink',
						)}
					>
						{row.name}
						<span className="sr-only">. </span>
					</span>
					{/* An unnamed saved protocol is listed under its shape (#112), so the
					    line under it says it has no name rather than the shape twice. */}
					<span
						className={cn(
							'text-[13px] leading-snug',
							current ? 'font-semibold text-chalk' : 'font-medium text-ink-dim',
						)}
					>
						{row.named ? row.shape : m.timer_unnamed()}
						<span className="sr-only">. {m.timer_total()}: </span>
					</span>
				</span>
				<span
					className={cn(
						'display shrink-0 text-[22px] leading-none font-semibold',
						current ? 'text-chalk' : 'text-ink',
					)}
				>
					{clock(row.total)}
				</span>
			</button>
			{actions}
		</div>
	);
}

/** A preset group's head: the exercise, "Today" when the plan schedules it
 *  today, and how many presets it holds — a count to the eye, the words to a
 *  screen reader. */
function GroupHead({ group, today }: { group: PresetGroup; today: boolean }) {
	const n = group.presets.length;
	return (
		<span className="flex items-baseline gap-2.5">
			<span className="min-w-0 flex-1">
				{group.name}
				{today ? (
					<>
						<span className="sr-only">, </span>
						<span className="ml-2 text-[13px] font-medium text-ink-dim">{m.nav_today()}</span>
					</>
				) : null}
			</span>
			<span aria-hidden="true" className="shrink-0 text-[13px] font-medium text-ink-dim">
				{n}
			</span>
			<span className="sr-only">{m.timer_group_count({ n })}</span>
		</span>
	);
}

/** Make a saved protocol from scratch. Quiet, not primary: the list is picked
 *  from, not finished, so it has no primary, and the clock's Start is a clock
 *  control (#118). This is done once in a while. Left-aligned
 *  under the rows, as everything on the list is. */
function NewProtocol({ onClick }: { onClick: () => void }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={button({ size: 'lg', class: 'mt-1 gap-1.5 self-start' })}
		>
			<Plus size={16} aria-hidden="true" />
			{m.timer_new()}
		</button>
	);
}
