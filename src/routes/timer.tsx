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
// the list is four groups, top to bottom:
//
//   1. **Stopwatch**, one row, opening the stopwatch's clock.
//   2. **Saved**, the athlete's own protocols, always open, and New protocol.
//   3. **Recent**, the last three run that Saved does not already show — a
//      draft on this device (`recentProtocols.ts`), not training record.
//   4. **Presets**, grouped by exercise and closed until a group is opened, so
//      twenty-odd rows in nine groups are nine lines until one is wanted.
//
// A row is its name (the strongest text on it), its shape and how long it runs,
// and a tap on it opens its clock's ready state (#110): the sequence, the total,
// the study a preset cites, one Start. Nothing on a row starts a clock. What a
// row can do besides run is behind its own ⋯ beside it — a separate, bordered
// 44px control, because an icon attached to a larger control does not read as
// one (`component-vocabulary.md`, the measured rules).
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

import { Menu } from '@base-ui/react/menu';
import { createFileRoute } from '@tanstack/react-router';
import { ChevronRight, Ellipsis, Plus, Timer as TimerIcon } from 'lucide-react';
import {
	type ReactNode,
	useCallback,
	useId,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
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
import { type ClockHandle, Timer } from '../components/Timer';
import { AlertDialog } from '../components/ui/AlertDialog';
import { Empty, Pane } from '../components/ui/primitives';
import { button } from '../components/ui/variants';

export const Route = createFileRoute('/timer')({ component: TimerScreen });

function TimerScreen() {
	const locale = getLocale();
	const record = useTrainingRecord();
	const screen = useMemo(() => resolveTimer(getContent(locale), record, locale), [record, locale]);
	const { runnable } = screen;

	// WHICH PROTOCOL THE CLOCK IS ON, held by identity.
	//
	// It opens on the one the athlete left the clock in, so coming back to this
	// screen finds the same clock, paused where it stopped — and, if that was
	// mid-run, its bar at the bottom of the list. After that only a tap on a row
	// changes it. Each protocol keeps its own place (`ClockShelf` in
	// `timerSetup.ts`), so a tap on another row and back finds the first one
	// where it was left.
	const last = useLastTimerProtocol();
	const [selected, setSelected] = useState<ProtocolKey | null>(
		() => runnable.find((r) => r.key === last)?.key ?? runnable[0]?.key ?? null,
	);
	// The protocol the bar belongs to: the one started last, and at first the
	// one the clock was left in, so a place left mid-run is in the bar on return.
	// Kept apart from `selected` because a look at another row while one runs
	// must not stop it: the running clock stays mounted beside the one opened.
	const [running, setRunning] = useState(selected);
	// Which clock is up, owned here rather than by the Timer: a tap on a row
	// picks the protocol and opens its clock in one go.
	const [openKey, setOpenKey] = useState<ProtocolKey | null>(null);
	const [watchOpen, setWatchOpen] = useState(false);
	// Which clock has the bar: kept on the device (`clockFront.ts`), because both
	// come back paused from another screen and only this says which of the two
	// was started last — a stopwatch left mid-count comes back in the bar.
	const [front, setFront] = useClockFront();
	// A deleted saved protocol takes the selection with it; the clock moves to the
	// top of the list rather than vanishing.
	const current = runnable.find((r) => r.key === selected) ?? runnable[0] ?? null;
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

	// THE TAPPED ROW STAYS UNDER THE FINGER.
	//
	// Opening a group pushes everything under it down, and closing one near the
	// end of the page shortens the page under a scroll position that may no
	// longer exist — and a quick second tap, chalky and one-handed, lands on a
	// neighbour. So the tapped head's position is read at the tap and the page is
	// scrolled by whatever the re-render moved it, before paint. Where the page
	// has become too short to scroll that far, it is given the height back at
	// its end until the next toggle.
	const [openGroups, setOpenGroups] = useState<ReadonlySet<string>>(() => new Set());
	const anchor = useRef<{ el: HTMLElement; top: number } | null>(null);
	const tail = useRef<HTMLDivElement>(null);
	const toggleGroup = (exercise: string, el: HTMLElement) => {
		if (tail.current) tail.current.style.height = '';
		anchor.current = { el, top: el.getBoundingClientRect().top };
		setOpenGroups((open) => {
			const next = new Set(open);
			if (!next.delete(exercise)) next.add(exercise);
			return next;
		});
	};
	// biome-ignore lint/correctness/useExhaustiveDependencies: `openGroups` is read by no line of the effect on purpose; the toggle changing it is the re-render to measure.
	useLayoutEffect(() => {
		const held = anchor.current;
		anchor.current = null;
		if (!held) return;
		const moved = held.el.getBoundingClientRect().top - held.top;
		if (!moved) return;
		// Closing a group at the end of the page clamps the scroll, which pushes
		// the head down; there is then no page left below to scroll into.
		const room = Math.max(
			0,
			document.documentElement.scrollHeight - window.innerHeight - window.scrollY,
		);
		if (moved > room && tail.current) tail.current.style.height = `${moved - room}px`;
		window.scrollBy(0, moved);
	}, [openGroups]);

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
	// which takes no taps while it does (`RowActions`): no window to choose.
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
	 * A protocol's ⋯, on its row and in its clock's ready state: Duplicate, and
	 * for a saved protocol Edit and Delete. A preset is the library's, so the one
	 * thing to do with it besides running it is to keep a copy that is the
	 * athlete's. Picked from the ready state, each leaves the clock first, for
	 * the list, the editor or the question it leads to.
	 */
	const rowActions = (p: ProtocolListing, placement: 'row' | 'header') => {
		const own = screen.saved.find((s) => s.key === p.key);
		const leave = () => setOpenKey(null);
		return (
			<RowActions
				name={p.name}
				placement={placement}
				onDuplicate={() => {
					leave();
					void duplicate(p);
				}}
				onEdit={
					own
						? () => {
								leave();
								openEditor(own);
							}
						: undefined
				}
				onDelete={
					own
						? () => {
								leave();
								setDoomed(own);
								setConfirming(true);
							}
						: undefined
				}
			/>
		);
	};
	const row = (p: ProtocolListing) => (
		<ProtocolRow
			key={p.key}
			row={p}
			onOpen={() => openClock(p.key)}
			reveal={p.key === made ? reveal : undefined}
			actions={rowActions(p, 'row')}
		/>
	);

	return (
		// Capped, like Train: one list, picked one-handed, and a wider list says
		// nothing more about a protocol.
		<Pane className="gap-6">
			{/* Centred, not baseline-aligned like the other screens' headers: the
			    cue settings' 44px control would otherwise leave the title riding
			    high beside it. The title is one word in both locales. */}
			<header className="flex items-center justify-between gap-2 pt-1.5">
				<h1 className="h-screen-title min-w-0">{m.nav_timer()}</h1>
				<CueSettingsShortcut />
			</header>

			<button
				type="button"
				aria-haspopup="dialog"
				onClick={() => setWatchOpen(true)}
				className={cn(ROW, 'w-full')}
			>
				<TimerIcon size={20} aria-hidden="true" className="shrink-0 text-ink-dim" />
				<span className="min-w-0 flex-1 text-[16px] leading-tight font-semibold text-ink">
					{m.timer_stopwatch()}
				</span>
				<ChevronRight size={18} aria-hidden="true" className="shrink-0 text-ink-faint" />
			</button>

			<ListSection label={m.timer_saved()}>
				{screen.saved.length ? (
					<div className="flex flex-col gap-1.5">
						{screen.saved.map(row)}
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
			</ListSection>

			<ListSection label={m.timer_recent()}>
				{recent.length ? (
					<div className="flex flex-col gap-1.5">{recent.map(row)}</div>
				) : (
					<Empty value={m.timer_recent_empty()} />
				)}
			</ListSection>

			<ListSection label={m.timer_presets()}>
				<div className="flex flex-col">
					{screen.presets.map((g) => (
						<PresetGroupList
							key={g.exercise}
							group={g}
							open={openGroups.has(g.exercise)}
							onToggle={(el) => toggleGroup(g.exercise, el)}
						>
							{g.presets.map(row)}
						</PresetGroupList>
					))}
				</div>
			</ListSection>
			<div ref={tail} aria-hidden="true" className="-mt-6" />

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
 * One of the list's four groups, under the section rank in Inter
 * (`.h-section-sans`), as the approved mockup draws it: #110 took the mono caps
 * out of the Timer screens' headings, and the list's heads are words, not
 * furniture.
 */
function ListSection({ label, children }: { label: string; children: ReactNode }) {
	return (
		<section className="flex flex-col gap-2.5">
			<h2 className="h-section-sans px-1">{label}</h2>
			{children}
		</section>
	);
}

/**
 * The surface every row on the list shares — the stopwatch's, a protocol's —
 * so their left edges, their height and their padding are one rule.
 */
const ROW =
	'flex min-h-14 min-w-0 items-center gap-3 rounded-xl bg-panel px-3.5 py-2.5 text-left transition-colors hover:bg-panel-2';

/**
 * One protocol: its name, its shape, how long it runs; and beside it, not in
 * it, what else it can do. A tap opens its clock's ready state, which is where
 * Start is, so a stray tap on the list never starts anything.
 */
function ProtocolRow({
	row,
	onOpen,
	actions,
	reveal,
}: {
	row: { name: string; shape: string; total: number; named: boolean };
	onOpen: () => void;
	actions: ReactNode;
	/** Scrolls a row just made into view. */
	reveal?: (el: HTMLElement | null) => void;
}) {
	return (
		// Clear of the app bar above and the mini bar below when it is scrolled to.
		<div ref={reveal} className="flex scroll-mt-16 scroll-mb-24 items-stretch gap-1.5">
			<button type="button" aria-haspopup="dialog" onClick={onOpen} className={cn(ROW, 'flex-1')}>
				{/* The separators are spoken only: without them a screen reader runs the
				    name, the shape and the length into one word. */}
				<span className="flex min-w-0 flex-1 flex-col gap-0.5">
					<span className="line-clamp-2 text-[16px] leading-tight font-semibold text-ink">
						{row.name}
						<span className="sr-only">. </span>
					</span>
					{/* An unnamed saved protocol is listed under its shape (#112), so the
					    line under it says it has no name rather than the shape twice. */}
					<span className="text-[13px] leading-snug font-medium text-ink-dim">
						{row.named ? row.shape : m.timer_unnamed()}
						<span className="sr-only">. {m.timer_total()}: </span>
					</span>
				</span>
				<span className="display shrink-0 text-[22px] leading-none font-semibold text-ink">
					{clock(row.total)}
				</span>
			</button>
			{actions}
		</div>
	);
}

/**
 * A row's ⋯: its own 44px control, bordered, beside the row (#111), labelled
 * with the protocol it acts on — "Delete" alone does not say what goes. Its
 * menu: Duplicate, and for a saved protocol Edit and Delete. Delete is not
 * coloured apart, since colour here reports state; its question is what guards
 * it.
 */
function RowActions({
	name,
	placement,
	onDuplicate,
	onEdit,
	onDelete,
}: {
	name: string;
	/** Beside a row, the row's height; in the ready state's header, the 48px
	 *  square of the Close beside it. */
	placement: 'row' | 'header';
	onDuplicate: () => void;
	onEdit?: () => void;
	onDelete?: () => void;
}) {
	const item =
		'flex min-h-11 cursor-default items-center rounded-md px-3 text-[15px] text-ink outline-none select-none data-[highlighted]:bg-panel-3';
	return (
		<Menu.Root>
			<Menu.Trigger
				aria-label={m.timer_row_actions({ name })}
				className={cn(
					'flex shrink-0 items-center justify-center border border-line text-ink-dim transition-colors hover:bg-panel-2 hover:text-ink data-[popup-open]:bg-panel-3 data-[popup-open]:text-ink',
					placement === 'row'
						? 'min-h-11 w-11 self-stretch rounded-xl'
						: 'size-12 self-start rounded-md bg-panel-2',
				)}
			>
				<Ellipsis size={20} aria-hidden="true" />
			</Menu.Trigger>
			<Menu.Portal>
				<Menu.Positioner sideOffset={6} align="end" className="z-50">
					{/* Closing, it takes no taps: an item tapped again as the menu fades
					    would run twice. */}
					<Menu.Popup className="min-w-[180px] rounded-lg border border-line bg-panel p-1 shadow-lg transition-[opacity,transform] duration-150 data-[ending-style]:pointer-events-none data-[ending-style]:scale-[0.98] data-[ending-style]:opacity-0 data-[starting-style]:scale-[0.98] data-[starting-style]:opacity-0">
						<Menu.Item className={item} onClick={onDuplicate}>
							{m.timer_duplicate()}
						</Menu.Item>
						{onEdit ? (
							<Menu.Item className={item} onClick={onEdit}>
								{m.timer_edit()}
							</Menu.Item>
						) : null}
						{onDelete ? (
							<Menu.Item className={item} onClick={onDelete}>
								{m.btn_delete()}
							</Menu.Item>
						) : null}
					</Menu.Popup>
				</Menu.Positioner>
			</Menu.Portal>
		</Menu.Root>
	);
}

/**
 * One exercise's presets, closed until its head is tapped: the name and how
 * many presets it holds. The study it cites is on each preset's ready state.
 */
function PresetGroupList({
	group,
	open,
	onToggle,
	children,
}: {
	group: PresetGroup;
	open: boolean;
	onToggle: (el: HTMLElement) => void;
	children: ReactNode;
}) {
	const id = useId();
	const n = group.presets.length;
	return (
		<section className="flex flex-col">
			<h3>
				<button
					type="button"
					aria-expanded={open}
					aria-controls={open ? id : undefined}
					onClick={(e) => onToggle(e.currentTarget)}
					className="flex min-h-12 w-full items-center gap-2.5 border-b border-line-soft px-1 text-left text-[15px] font-semibold text-ink transition-colors hover:text-chalk"
				>
					<ChevronRight
						size={16}
						aria-hidden="true"
						className={cn('shrink-0 text-ink-dim transition-transform', open && 'rotate-90')}
					/>
					<span className="min-w-0 flex-1">{group.name}</span>
					<span aria-hidden="true" className="shrink-0 text-[13px] font-medium text-ink-dim">
						{n}
					</span>
					<span className="sr-only">{m.timer_group_count({ n })}</span>
				</button>
			</h3>
			{open ? (
				<div id={id} className="flex flex-col gap-1.5 pt-2 pb-3">
					{children}
				</div>
			) : null}
		</section>
	);
}

/** Make a saved protocol from scratch. Quiet, not primary: the screen's one
 *  primary is the clock's Start, and this is done once in a while. Left-aligned
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
