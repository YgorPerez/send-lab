// TIMER (#101).
//
// The clock outside a session: pick a protocol, run it. Nothing here is
// training — a run records no session, no set and no history — so the screen
// reads no prescription. What it does keep is the athlete's place in the
// protocol, as a draft on this device, under the same two rules as Train's
// (`timerSetup.ts`): it comes back paused, and only for the protocol it was left
// in.
//
// Two lists. The athlete's **saved protocols** (#103) come first, because they
// are theirs and there are few of them; under them the **presets**: every library
// variant that carries a protocol, read-only, computed by `resolveTimer` and never
// stored. The one row the clock is pointed at carries the actions — duplicate,
// and for a saved protocol delete — so twenty-six rows do not each carry two
// buttons. Creating and editing one is #104's, and goes beside them; the
// Protocols | Stopwatch switch (#108) goes above both.
//
// Same posture as Train, so the same two rules: the clock is sticky, because the
// list scrolls under it and Start must stay in reach; and every row is a 44px
// target, the clock's controls 48px.
import { createFileRoute } from '@tanstack/react-router';
import { ExternalLink } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { getContent } from '$lib/content';
import { clock } from '$lib/format';
import { type ProtocolKey, savedProtocolKey } from '$lib/ids';
import * as m from '$lib/paraglide/messages';
import { getLocale } from '$lib/paraglide/runtime';
import type { Protocol } from '$lib/protocol';
import { type PresetGroup, resolveTimer, type SavedRow } from '$lib/screens/timer';
import { useTrainingRecord } from '$lib/store/record';
import { deleteSavedProtocol, duplicateProtocol } from '$lib/store/savedProtocols';
import { useTimerSetup } from '$lib/timerSetup';
import { Timer } from '../components/Timer';
import { AlertDialog } from '../components/ui/AlertDialog';
import { Empty, Pane, Section } from '../components/ui/primitives';
import { button, option } from '../components/ui/variants';

export const Route = createFileRoute('/timer')({ component: TimerScreen });

/** Anything the clock can run, as the list shows it. */
interface Runnable {
	key: ProtocolKey;
	/** What the clock's strip is named. */
	label: string;
	protocol: Protocol;
}

function TimerScreen() {
	const locale = getLocale();
	const record = useTrainingRecord();
	const screen = useMemo(() => resolveTimer(getContent(locale), record, locale), [record, locale]);
	// Saved first, in the order the screen lists them, so "the first one" is the
	// one at the top.
	const runnable = useMemo(
		(): Runnable[] => [
			...screen.saved.map((s) => ({ key: s.key, label: s.name, protocol: s.protocol })),
			...screen.presets.flatMap((g) =>
				g.presets.map((p) => ({
					key: p.key,
					label: `${g.name} · ${p.name}`,
					protocol: p.protocol,
				})),
			),
		],
		[screen],
	);

	// WHICH PROTOCOL THE CLOCK IS RUNNING, held by identity.
	//
	// It opens on the one the athlete left the clock in — the stored draft's scope
	// names it — so coming back to this screen finds the same clock, paused where
	// it stopped. Read once, like the draft itself; after that only a tap on a row
	// changes it, and that tap is a different protocol, which starts clean.
	const [stored] = useTimerSetup('timer');
	const [selected, setSelected] = useState<ProtocolKey | null>(
		() => runnable.find((r) => r.key === stored?.scope)?.key ?? runnable[0]?.key ?? null,
	);
	// Owned here rather than by the Timer, for the reason Train gives: picking
	// another protocol remounts the clock, and the dialog should not close with it.
	const [clockOpen, setClockOpen] = useState(false);
	// A deleted saved protocol takes the selection with it; the clock moves to the
	// top of the list rather than vanishing.
	const current = runnable.find((r) => r.key === selected) ?? runnable[0] ?? null;

	// A copy is made where the athlete is not looking — at the top of the list,
	// while they tapped a preset further down — so the new row is scrolled to.
	// Once: the ref is stable, so React calls it when the row first mounts and not
	// on every render after.
	const [made, setMade] = useState<ProtocolKey | null>(null);
	const reveal = useCallback((el: HTMLElement | null) => {
		el?.scrollIntoView({ block: 'center' });
	}, []);
	const duplicate = async (source: { copyName: string; protocol: Protocol }) => {
		const row = await duplicateProtocol({ name: source.copyName, protocol: source.protocol });
		const key = savedProtocolKey(row.id);
		setSelected(key);
		setMade(key);
	};

	// The protocol the delete question is about, kept apart from whether the
	// question is open, so the title does not lose its name while it closes.
	const [doomed, setDoomed] = useState<SavedRow | null>(null);
	const [confirming, setConfirming] = useState(false);

	return (
		// Capped, like Train: one list and one clock, and a wider list says nothing
		// more about a protocol.
		<Pane className="gap-6">
			<header className="flex items-baseline justify-between gap-2 pt-1.5">
				<h1 className="h-screen-title min-w-0">{m.nav_timer()}</h1>
			</header>

			{current ? (
				<div className="sticky top-[44px] z-10 -mx-3 bg-bg/95 px-3 pt-1 pb-2 backdrop-blur">
					<Timer
						key={current.key}
						slot="timer"
						protocol={current.protocol}
						label={current.label}
						protocolKey={current.key}
						clockOpen={clockOpen}
						onClockOpenChange={setClockOpen}
						editable={false}
						openOnStart
						titled={false}
					/>
				</div>
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
									onSelect={() => setSelected(s.key)}
								/>
								{s.key === current?.key ? (
									<RowActions
										onDuplicate={() => void duplicate(s)}
										onDelete={() => {
											setDoomed(s);
											setConfirming(true);
										}}
									/>
								) : null}
							</div>
						))}
					</div>
				) : (
					<Empty value={m.timer_saved_empty()} />
				)}
			</Section>

			<Section label={m.timer_presets()}>
				<div className="flex flex-col gap-5">
					{screen.presets.map((g) => (
						<PresetList
							key={g.exercise}
							group={g}
							selected={current?.key ?? null}
							onSelect={setSelected}
							onDuplicate={(p) => void duplicate(p)}
						/>
					))}
				</div>
			</Section>

			<AlertDialog
				open={confirming}
				onOpenChange={setConfirming}
				title={m.timer_delete_title({ name: doomed?.name ?? '' })}
				description={m.timer_delete_body()}
				cancel={m.btn_cancel()}
				confirm={m.btn_delete()}
				onConfirm={() => {
					if (doomed) void deleteSavedProtocol(doomed.id);
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
	onSelect,
	onDuplicate,
}: {
	group: PresetGroup;
	selected: ProtocolKey | null;
	onSelect: (key: ProtocolKey) => void;
	onDuplicate: (preset: PresetGroup['presets'][number]) => void;
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
						<ProtocolButton row={p} on={p.key === selected} onSelect={() => onSelect(p.key)} />
						{/* A preset is the library's: the one thing to do with it besides
						    running it is to keep a copy that is the athlete's. */}
						{p.key === selected ? <RowActions onDuplicate={() => onDuplicate(p)} /> : null}
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
	onSelect,
}: {
	row: { name: string; shape: string; total: number };
	on: boolean;
	onSelect: () => void;
}) {
	return (
		<button
			type="button"
			aria-pressed={on}
			onClick={onSelect}
			className={option({ on, width: 'full', class: 'flex min-h-11 items-center gap-3' })}
		>
			<span className="flex min-w-0 flex-1 flex-col gap-0.5">
				<span>{row.name}</span>
				<span className="num text-[11px] font-normal text-ink-dim">{row.shape}</span>
			</span>
			<span className="num shrink-0 text-[12px] font-normal text-ink-dim">{clock(row.total)}</span>
		</button>
	);
}

/**
 * What the selected row can do besides run: duplicate, and — for a saved
 * protocol, never a preset — delete. Labelled buttons on their own line under
 * the row rather than icons on it, because an icon attached to a larger control
 * does not read as one (`component-vocabulary.md`, the measured rules).
 */
function RowActions({ onDuplicate, onDelete }: { onDuplicate: () => void; onDelete?: () => void }) {
	return (
		<div className="flex flex-wrap justify-end gap-2">
			<button type="button" onClick={onDuplicate} className={button({ class: 'min-h-11' })}>
				{m.timer_duplicate()}
			</button>
			{onDelete ? (
				<button type="button" onClick={onDelete} className={button({ class: 'min-h-11' })}>
					{m.btn_delete()}
				</button>
			) : null}
		</div>
	);
}
