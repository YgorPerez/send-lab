// The instrument that answers the ticket's open question.
//
// #50 asks where a horizontal drag stops being stolen by Android's back gesture,
// and says to answer it with a real control in hand rather than blocking on a lab
// measurement. `Latch.tsx` is the real control; this is the gauge next to it.
//
// It cannot be answered from code alone. The width of Android's gesture strip is
// a user setting (Settings → System navigation → back sensitivity), the web has
// no API that reports it, and Chrome does not tell the page that the OS took a
// touch — the page just gets a `pointercancel`, or nothing at all because the
// back navigation already happened. So this measures it empirically, on the
// athlete's own phone, at their own sensitivity setting:
//
//   • every drag that starts here is written to localStorage *before* it resolves;
//   • a drag that completes clears that record and counts as **kept**;
//   • a `pointercancel` counts as **taken**;
//   • and a record still sitting there at the next page load also counts as
//     taken — that is the case where the OS navigated back and took the tab with
//     it, which is precisely the failure a naive in-memory probe cannot see.
//
// localStorage is the right store for this: it is ephemeral UI state on one
// device, not account data.
import type * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as m from '$lib/paraglide/messages';
import { bigButton, Head, Panel, pill } from './physical';

const STORE_KEY = 'sendlab.d.edgeguard';
/** Minimum horizontal travel before a drag counts as a drag rather than a tap. */
const DRAG_THRESHOLD = 28;

interface Reading {
	/** Distance from the nearest screen edge, in CSS px. */
	inset: number;
	edge: 'left' | 'right';
}

interface Store {
	taken: Reading[];
	kept: Reading[];
	/** A drag that started and has not resolved. Survives a back navigation. */
	pending: Reading | null;
}

const EMPTY: Store = { taken: [], kept: [], pending: null };

function load(): Store {
	if (typeof localStorage === 'undefined') return EMPTY;
	try {
		const raw = localStorage.getItem(STORE_KEY);
		if (!raw) return EMPTY;
		const parsed = JSON.parse(raw) as Partial<Store>;
		const next: Store = {
			taken: parsed.taken ?? [],
			kept: parsed.kept ?? [],
			pending: null,
		};
		// An unresolved drag from a previous load is the interesting case: the OS
		// consumed the gesture hard enough to take the page with it.
		if (parsed.pending) next.taken = [...next.taken, parsed.pending];
		return next;
	} catch {
		return EMPTY;
	}
}

function save(store: Store): void {
	try {
		localStorage.setItem(STORE_KEY, JSON.stringify(store));
	} catch {
		// Private mode, quota, whatever — the gauge is not worth an error path.
	}
}

/** The worst case observed: how far in from an edge the OS still took a drag. */
const deepestTaken = (readings: Reading[], edge: 'left' | 'right'): number | null => {
	const insets = readings.filter((r) => r.edge === edge).map((r) => r.inset);
	return insets.length ? Math.max(...insets) : null;
};

/** The best case observed: the closest to an edge a drag survived. */
const closestKept = (readings: Reading[], edge: 'left' | 'right'): number | null => {
	const insets = readings.filter((r) => r.edge === edge).map((r) => r.inset);
	return insets.length ? Math.min(...insets) : null;
};

export function EdgeGuardProbe() {
	const [store, setStore] = useState<Store>(EMPTY);
	// Pointer handlers need the current store synchronously — a gesture can start
	// and be taken by the OS inside one frame — so it is mirrored in a ref and the
	// state updater stays pure. Writing to localStorage from inside a `setState`
	// callback is the impure-updater trap the gate catches.
	const storeRef = useRef<Store>(EMPTY);
	const dragRef = useRef<{ x: number; y: number; moved: boolean; reading: Reading } | null>(null);

	const commit = useCallback((next: Store) => {
		storeRef.current = next;
		setStore(next);
		save(next);
	}, []);

	// Read on mount rather than during render: this is browser state, and the
	// tree is client-only but still renders once before hydration settles. The
	// write-back is deliberate — it folds any unresolved pending drag into the
	// permanent record.
	useEffect(() => {
		commit(load());
	}, [commit]);

	const readingFor = useCallback((clientX: number): Reading => {
		const width = window.innerWidth;
		return clientX <= width / 2
			? { edge: 'left', inset: Math.round(clientX) }
			: { edge: 'right', inset: Math.round(width - clientX) };
	}, []);

	const onPointerDown = useCallback(
		(e: React.PointerEvent<HTMLDivElement>) => {
			const reading = readingFor(e.clientX);
			dragRef.current = { x: e.clientX, y: e.clientY, moved: false, reading };
			// Written before the gesture resolves, on purpose. If Android takes the
			// page, this is the only record that survives.
			commit({ ...storeRef.current, pending: reading });
		},
		[commit, readingFor],
	);

	const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
		const drag = dragRef.current;
		if (!drag) return;
		const dx = Math.abs(e.clientX - drag.x);
		const dy = Math.abs(e.clientY - drag.y);
		if (dx > DRAG_THRESHOLD && dx > dy) drag.moved = true;
	}, []);

	const resolve = useCallback(
		(outcome: 'kept' | 'taken') => {
			const drag = dragRef.current;
			dragRef.current = null;
			const prev = storeRef.current;
			// A tap is not a measurement — only a real horizontal throw counts.
			const reading = drag != null && (outcome === 'taken' || drag.moved) ? drag.reading : null;
			commit({
				taken: reading && outcome === 'taken' ? [...prev.taken, reading] : prev.taken,
				kept: reading && outcome === 'kept' ? [...prev.kept, reading] : prev.kept,
				pending: null,
			});
		},
		[commit],
	);

	const guard = 44;
	const rows: { edge: 'left' | 'right'; label: string }[] = [
		{ edge: 'left', label: m.guard_left() },
		{ edge: 'right', label: m.guard_right() },
	];

	return (
		<section>
			<Head right={<span className={pill({ tone: 'hot' })}>{`${guard}px`}</span>}>
				{m.guard_title()}
			</Head>
			<Panel className="p-3">
				<p className="text-[13px] leading-snug text-ink-dim">{m.guard_desc()}</p>

				<div className="mt-3 grid grid-cols-2 gap-2">
					{rows.map((row) => {
						const taken = deepestTaken(store.taken, row.edge);
						const kept = closestKept(store.kept, row.edge);
						return (
							<div key={row.edge} className="well rounded-md p-3">
								<p className="font-mono text-[10px] tracking-wider text-ink-faint uppercase">
									{row.label}
								</p>
								<p className="mt-1 font-mono text-[24px] leading-none font-bold text-flag">
									{taken == null ? '—' : `${taken}px`}
								</p>
								<p className="mt-1 text-[11px] leading-snug text-ink-dim">
									{taken == null ? m.guard_none() : null}
									{kept == null ? null : <span className="text-teal">{` ✓ ${kept}px`}</span>}
								</p>
							</div>
						);
					})}
				</div>

				<div className="mt-3 flex items-center justify-between gap-3">
					<span className={pill()}>
						{m.guard_tally({ taken: store.taken.length, kept: store.kept.length })}
					</span>
					<button
						type="button"
						className={bigButton({ tone: 'quiet', wide: false, class: 'min-h-[52px] px-5' })}
						onClick={() => commit(EMPTY)}
					>
						{m.guard_reset()}
					</button>
				</div>
			</Panel>

			{/* The strip must reach the *real* screen edges, so it sits outside the
			    panel (which clips) and cancels the page gutter with a negative
			    margin. Every number it reports is a distance from the device edge. */}
			<div
				onPointerDown={onPointerDown}
				onPointerMove={onPointerMove}
				onPointerUp={() => resolve('kept')}
				onPointerCancel={() => resolve('taken')}
				className="well relative -mx-3 mt-2 flex h-24 touch-pan-y items-center justify-center overflow-hidden rounded-none"
			>
				<span
					aria-hidden="true"
					className="absolute inset-y-0 left-0 bg-flag/25"
					style={{ width: `${guard}px` }}
				/>
				<span
					aria-hidden="true"
					className="absolute inset-y-0 right-0 bg-flag/25"
					style={{ width: `${guard}px` }}
				/>
				<span className="px-2 text-center font-mono text-[11px] tracking-wider text-ink-faint uppercase">
					{m.guard_swipe_here()}
				</span>
			</div>
		</section>
	);
}
