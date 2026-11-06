// TIMER (#101).
//
// The clock outside a session: pick a protocol, run it. Nothing here is
// training — a run records no session, no set and no history — so the screen
// reads no prescription. What it does keep is the athlete's place in each
// protocol, as a draft on this device, under the same two rules as Train's
// (`timerSetup.ts`): it comes back paused, and only for the protocol it was left
// in.
//
// Two lists. The athlete's **saved protocols** (#103) come first, because they
// are theirs and there are few of them; under them the **presets**: every library
// variant that carries a protocol, read-only, computed by `resolveTimer` and never
// stored. The one row the clock is pointed at carries the actions — duplicate,
// and for a saved protocol edit and delete — so twenty-six rows do not each carry
// three buttons. A new one is made from scratch under the saved list (#104), in
// the same sheet that edits one.
//
// A Protocols | Stopwatch switch (#108) sits above the clock. Both tabs stay
// mounted and the one not shown is `hidden`, so a protocol left running keeps
// counting while the athlete looks at the stopwatch — and the rule that only one
// runs at a time is the press that starts one pausing the other, through each
// clock's `ClockHandle`, rather than a tab switch that pauses as a side effect.
// The screen always opens on Protocols, the common case (spec story 2).
//
// Same posture as Train, so the same two rules: the clock is sticky, because the
// list scrolls under it and Start must stay in reach; and every row is a 44px
// target, the clock's controls 48px.
import { createFileRoute } from '@tanstack/react-router';
import { ExternalLink, Plus } from 'lucide-react';
import { useCallback, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { getContent } from '$lib/content';
import { clock } from '$lib/format';
import { type ProtocolKey, savedProtocolKey } from '$lib/ids';
import * as m from '$lib/paraglide/messages';
import { getLocale } from '$lib/paraglide/runtime';
import { BLANK_PROTOCOL, PROTOCOL_FIELDS } from '$lib/protocol';
import {
	type PresetGroup,
	type PresetListing,
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
import { CueSettingsShortcut } from '../components/CueSettings';
import { type EditorTarget, ProtocolEditor } from '../components/ProtocolEditor';
import { Stopwatch } from '../components/Stopwatch';
import { type ClockHandle, Timer } from '../components/Timer';
import { AlertDialog } from '../components/ui/AlertDialog';
import { Empty, Pane, Section, StickyStrip } from '../components/ui/primitives';
import { Segmented } from '../components/ui/Segmented';
import { button, option } from '../components/ui/variants';

export const Route = createFileRoute('/timer')({ component: TimerScreen });

type Tab = 'protocols' | 'stopwatch';

function TimerScreen() {
	const locale = getLocale();
	const record = useTrainingRecord();
	const screen = useMemo(() => resolveTimer(getContent(locale), record, locale), [record, locale]);
	const { runnable } = screen;

	// WHICH PROTOCOL THE CLOCK IS RUNNING, held by identity.
	//
	// It opens on the one the athlete left the clock in, so coming back to this
	// screen finds the same clock, paused where it stopped. Read once, like the
	// draft itself; after that only a tap on a row changes it. Each protocol keeps
	// its own place (`ClockShelf` in `timerSetup.ts`), so a tap on another row and
	// back finds the first one where it was left.
	const last = useLastTimerProtocol();
	const [selected, setSelected] = useState<ProtocolKey | null>(
		() => runnable.find((r) => r.key === last)?.key ?? runnable[0]?.key ?? null,
	);
	// Owned here rather than by the Timer, for the reason Train gives: picking
	// another protocol remounts the clock, and the dialog should not close with it.
	const [clockOpen, setClockOpen] = useState(false);
	// A deleted saved protocol takes the selection with it; the clock moves to the
	// top of the list rather than vanishing.
	const current = runnable.find((r) => r.key === selected) ?? runnable[0] ?? null;
	// A preset cites the study its exercise rests on; its clock links it from the
	// ready state (#110). A saved protocol is the athlete's own and cites none.
	const group = screen.presets.find((g) => g.presets.some((p) => p.key === current?.key));
	const study = group?.study ?? null;
	const [tab, setTab] = useState<Tab>('protocols');
	const protocolClock = useRef<ClockHandle>(null);
	const stopwatch = useRef<ClockHandle>(null);

	// THE TAPPED ROW STAYS UNDER THE FINGER.
	//
	// The selected row carries its actions on a line of their own, so moving the
	// selection down the list takes that line away from above the row just tapped
	// and lifts it 48px out from under the thumb — and a quick second tap, chalky
	// and one-handed, lands on its neighbour. So the row's position is read at the
	// tap and the page scrolled by whatever the re-render moved it, before paint.
	const anchor = useRef<{ el: HTMLElement; top: number } | null>(null);
	const select = (key: ProtocolKey, el: HTMLElement) => {
		anchor.current = { el, top: el.getBoundingClientRect().top };
		setSelected(key);
	};
	const currentKey = current?.key;
	useLayoutEffect(() => {
		const held = anchor.current;
		anchor.current = null;
		if (!held || !currentKey) return;
		const moved = held.el.getBoundingClientRect().top - held.top;
		if (moved) window.scrollBy(0, moved);
	}, [currentKey]);
	// The selected row's name, which its actions are described by: "Delete" alone
	// does not say what goes.
	const nameId = useId();

	// A copy is made where the athlete is not looking — at the top of the list,
	// while they tapped a preset further down — so the new row is scrolled to.
	// Once: the ref is stable, so React calls it when the row first mounts and not
	// on every render after.
	const [made, setMade] = useState<ProtocolKey | null>(null);
	const reveal = useCallback((el: HTMLElement | null) => {
		el?.scrollIntoView({ block: 'center' });
	}, []);
	// A copy is selected and scrolled to the middle of the screen — where its own
	// Duplicate then sits, under a thumb that may still be coming down for a
	// second tap. One copy per tap, not two.
	const lastCopy = useRef(0);
	const duplicate = async (source: ProtocolListing) => {
		const now = Date.now();
		if (now - lastCopy.current < 700) return;
		lastCopy.current = now;
		const row = await createSavedProtocol(
			{ name: source.copyName, protocol: source.protocol },
			now,
		);
		const key = savedProtocolKey(row.id);
		setSelected(key);
		setMade(key);
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
		// A new one goes to the bottom of the saved list, which may be off the
		// screen: it is pointed at and scrolled to, as a copy is.
		const row = await createSavedProtocol(named);
		const key = savedProtocolKey(row.id);
		setSelected(key);
		setMade(key);
	};

	// The protocol the delete question is about, kept apart from whether the
	// question is open, so the title does not lose its name while it closes.
	const [doomed, setDoomed] = useState<SavedProtocolListing | null>(null);
	const [confirming, setConfirming] = useState(false);
	// A delete waits for the account to answer first (`store/savedProtocols.ts`),
	// which offline can take a while; the question stays up, its confirm spent,
	// until the row is gone, rather than closing on a row that is still listed.
	const [deleting, setDeleting] = useState(false);

	return (
		// Capped, like Train: one list and one clock, and a wider list says nothing
		// more about a protocol.
		<Pane className="gap-6">
			{/* Centred, not baseline-aligned like the other screens' headers: the
			    cue settings' 44px control would otherwise leave the title riding
			    high beside it. The title is one word in both locales. */}
			<header className="flex items-center justify-between gap-2 pt-1.5">
				<h1 className="h-screen-title min-w-0">{m.nav_timer()}</h1>
				<CueSettingsShortcut />
			</header>

			<Segmented<Tab>
				value={tab}
				options={[
					{ id: 'protocols', label: m.timer_tab_protocols() },
					{ id: 'stopwatch', label: m.timer_tab_stopwatch() },
				]}
				onChange={setTab}
				className="flex gap-1.5 *:text-center"
			/>

			<div hidden={tab !== 'protocols'} className="flex flex-col gap-6">
				{current ? (
					<StickyStrip>
						<Timer
							// Remounted when the protocol's numbers change, not only when
							// another one is picked: an edited saved protocol (#104) is a
							// different protocol, and its clock starts clean on it — the
							// draft's own rule for a protocol that is not the one it was
							// left in. A rename keeps the clock where it is.
							key={`${current.key}|${PROTOCOL_FIELDS.map((f) => current.protocol[f]).join(',')}`}
							ref={protocolClock}
							onStart={() => stopwatch.current?.pause()}
							home="timer"
							protocol={current.protocol}
							label={current.label}
							protocolKey={current.key}
							clockOpen={clockOpen}
							onClockOpenChange={setClockOpen}
							editable={false}
							openOnStart
							titled={false}
							study={study}
							title={current.name}
							subtitle={group?.name ?? null}
						/>
					</StickyStrip>
				) : null}

				<Section label={m.timer_saved()}>
					{screen.saved.length ? (
						<div className="flex flex-col gap-1">
							{screen.saved.map((s) => (
								<div
									key={s.key}
									ref={s.key === made ? reveal : undefined}
									className="flex scroll-my-40 flex-col gap-1"
								>
									<ProtocolButton
										row={s}
										on={s.key === current?.key}
										nameId={nameId}
										onSelect={(el) => select(s.key, el)}
									/>
									{s.key === current?.key ? (
										<RowActions
											describedBy={nameId}
											onDuplicate={() => void duplicate(s)}
											onEdit={() => openEditor(s)}
											onDelete={() => {
												setDoomed(s);
												setConfirming(true);
											}}
										/>
									) : null}
								</div>
							))}
							{/* Set apart from the row above, whose actions end on the same
							    line: these are the row's, this one is the list's. */}
							<div className="mt-2">
								<NewProtocol onClick={() => openEditor(null)} />
							</div>
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

				<Section label={m.timer_presets()}>
					<div className="flex flex-col gap-5">
						{screen.presets.map((g) => (
							<PresetList
								key={g.exercise}
								group={g}
								selected={current?.key ?? null}
								nameId={nameId}
								onSelect={select}
								onDuplicate={(p) => void duplicate(p)}
							/>
						))}
					</div>
				</Section>
			</div>

			<div hidden={tab !== 'stopwatch'}>
				<Stopwatch ref={stopwatch} onStart={() => protocolClock.current?.pause()} />
			</div>

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
					await deleteSavedProtocol(doomed.id);
					setDeleting(false);
					setConfirming(false);
				}}
			/>
		</Pane>
	);
}

/** One exercise's presets, under its name and the study the library cites. */
function PresetList({
	group,
	selected,
	nameId,
	onSelect,
	onDuplicate,
}: {
	group: PresetGroup;
	selected: ProtocolKey | null;
	nameId: string;
	onSelect: (key: ProtocolKey, el: HTMLElement) => void;
	onDuplicate: (preset: PresetListing) => void;
}) {
	return (
		<section className="flex flex-col gap-1.5">
			<header className="flex flex-wrap items-baseline justify-between gap-x-3">
				<h3 className="eyebrow">{group.name}</h3>
				{group.study ? (
					<a
						href={group.study.url}
						target="_blank"
						rel="noopener noreferrer"
						// 44px to the finger without 44px in the layout: the padding is
						// taken back by the margin, so a group with a study sits as close
						// to its rows as one without.
						className="-my-3.5 inline-flex items-center gap-1 py-3.5 text-[11px] text-ink-dim underline decoration-line underline-offset-2 hover:text-ink"
					>
						{group.study.title}
						<ExternalLink size={10} aria-hidden="true" />
					</a>
				) : null}
			</header>
			<div className="flex flex-col gap-1">
				{group.presets.map((p) => (
					<div key={p.key} className="flex flex-col gap-1">
						<ProtocolButton
							row={p}
							on={p.key === selected}
							nameId={nameId}
							onSelect={(el) => onSelect(p.key, el)}
						/>
						{/* A preset is the library's: the one thing to do with it besides
						    running it is to keep a copy that is the athlete's. */}
						{p.key === selected ? (
							<RowActions describedBy={nameId} onDuplicate={() => onDuplicate(p)} />
						) : null}
					</div>
				))}
			</div>
		</section>
	);
}

/**
 * One protocol: its name, its shape, how long it runs. Choosing it points the
 * clock at it; Start is the clock's, so a stray tap on the list never starts
 * anything.
 */
function ProtocolButton({
	row,
	on,
	nameId,
	onSelect,
}: {
	row: { name: string; shape: string; total: number };
	on: boolean;
	/** Given to the name only while selected — one row at a time carries it. */
	nameId: string;
	onSelect: (el: HTMLElement) => void;
}) {
	return (
		<button
			type="button"
			aria-pressed={on}
			onClick={(e) => onSelect(e.currentTarget)}
			className={option({ on, width: 'full', class: 'flex min-h-11 items-center gap-3' })}
		>
			<span className="flex min-w-0 flex-1 flex-col gap-0.5">
				<span id={on ? nameId : undefined}>{row.name}</span>
				<span className="num text-[11px] font-normal text-ink-dim">{row.shape}</span>
			</span>
			<span className="num shrink-0 text-[12px] font-normal text-ink-dim">{clock(row.total)}</span>
		</button>
	);
}

/** Make a saved protocol from scratch. Quiet, not primary: the screen's one
 *  primary is the clock's Start, and this is done once in a while. */
function NewProtocol({ onClick }: { onClick: () => void }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={button({ class: 'min-h-11 gap-1.5 self-start' })}
		>
			<Plus size={14} aria-hidden="true" />
			{m.timer_new()}
		</button>
	);
}

/**
 * What the selected row can do besides run: duplicate, and — for a saved
 * protocol, never a preset — edit and delete. Labelled buttons on their own line under
 * the row rather than icons on it, because an icon attached to a larger control
 * does not read as one (`component-vocabulary.md`, the measured rules).
 *
 * Tight to the row above and clear of the row below, so the line reads as the
 * selected row's and not as floating between two. Duplicate takes the right
 * edge, the easy reach for a right thumb, because it is the common one; Delete
 * is not coloured apart, since colour here reports state, and its question is
 * what guards it.
 */
function RowActions({
	describedBy,
	onDuplicate,
	onEdit,
	onDelete,
}: {
	describedBy: string;
	onDuplicate: () => void;
	onEdit?: () => void;
	onDelete?: () => void;
}) {
	return (
		<div className="mb-2 flex flex-wrap justify-end gap-2">
			{onDelete ? (
				<button
					type="button"
					aria-describedby={describedBy}
					onClick={onDelete}
					className={button({ class: 'min-h-11' })}
				>
					{m.btn_delete()}
				</button>
			) : null}
			{onEdit ? (
				<button
					type="button"
					aria-describedby={describedBy}
					onClick={onEdit}
					className={button({ class: 'min-h-11' })}
				>
					{m.timer_edit()}
				</button>
			) : null}
			<button
				type="button"
				aria-describedby={describedBy}
				onClick={onDuplicate}
				className={button({ class: 'min-h-11' })}
			>
				{m.timer_duplicate()}
			</button>
		</div>
	);
}
