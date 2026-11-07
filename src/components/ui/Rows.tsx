// The expanding row — the Log screen's timeline, and the Timer's preset groups.
//
// A row is a summary line the athlete can read without opening it: when, the
// number that matters, and a one-line conclusion. Opening it is for the detail
// underneath. That is the density bargain this direction makes on a list of
// twenty-eight sessions — everything is on the screen, but only one line of each
// until asked.
//
// The open/close animation is `.a-panel` in `app.css`, which this app owns.
// `tw-animate-css`'s accordion keyframes resolve the panel height from
// `--radix-`, `--bits-`, `--reka-`, `--kb-` or `--ngp-` and fall back to `auto`,
// and there is no Base UI variable among them — so the library's classes would
// open every row with a jump. Base UI publishes `--accordion-panel-height`, so
// the replacement is a plain CSS height transition with no measure pass in JS
// and nothing to keep in sync when pt-BR makes the content taller.
import { Accordion } from '@base-ui/react/accordion';
import { ChevronDown } from 'lucide-react';
import { type ReactNode, type RefObject, useCallback, useRef } from 'react';
import { cn } from '$lib/utils';

/**
 * The rows, in one card. One row open at a time unless `multiple`; the open ones
 * are the group's own state unless the caller holds `value` (the Timer's preset
 * groups open today's by default and keep the tapped head under the finger,
 * #119).
 */
export function RowGroup({
	children,
	multiple,
	value,
	onValueChange,
}: {
	children: ReactNode;
	multiple?: boolean;
	/** The open rows' `value`s, when the caller holds them. */
	value?: readonly string[];
	/** Called before the change renders: `event` is the press that made it. */
	onValueChange?: (value: string[], event: Event) => void;
}) {
	return (
		<Accordion.Root
			multiple={multiple}
			value={value as string[] | undefined}
			onValueChange={
				onValueChange
					? (next, details) => onValueChange(next as string[], details.event)
					: undefined
			}
			className="flex flex-col overflow-hidden rounded-lg border border-line bg-panel"
		>
			{children}
		</Accordion.Root>
	);
}

export function Row({
	value,
	summary,
	touch,
	aside,
	current,
	children,
}: {
	/** A stable id for this row — never a display label (ADR-0003). */
	value: string;
	summary: ReactNode;
	/** A 48px head in the rows' 15px, for a list worked through mid-set (the
	 *  Timer's preset groups); 44px otherwise. */
	touch?: boolean;
	/** From `lg` the caller shows a row's detail beside the list (Log's second
	 *  pane, #120), so there the row does not open under itself: its panel and
	 *  chevron are hidden. */
	aside?: boolean;
	/** The row whose detail is beside the list from `lg` (with `aside`), marked
	 *  there as the bar marks the current destination, plus the chalk edge a row
	 *  needs (DESIGN.md › Navigation › One selection language). Kept apart from
	 *  open: below `lg` nothing need be open, and from `lg` the pane always
	 *  shows a day. The summary takes chalk through `group-data-[current]`. */
	current?: boolean;
	children: ReactNode;
}) {
	return (
		<Accordion.Item
			value={value}
			data-row={value}
			className="border-b border-line-soft last:border-b-0 data-[open]:bg-panel-2/40"
		>
			<Accordion.Header>
				<Accordion.Trigger
					data-current={aside && current ? '' : undefined}
					className={cn(
						// The ring is drawn inside: the group's `overflow-hidden` (its
						// rounded corners) cut the global 2px-outside ring to its top and
						// bottom lines, or to one line on the first and last rows (#120).
						'group flex w-full items-center gap-2 px-2.5 py-2 text-left transition-colors hover:bg-panel-2 focus-visible:-outline-offset-2 active:bg-panel-2',
						touch ? 'min-h-12 text-[15px] font-semibold text-ink' : 'min-h-11',
						aside &&
							current &&
							'lg:bg-panel-3 lg:ring-1 lg:ring-chalk/60 lg:ring-inset lg:hover:bg-panel-3',
					)}
				>
					<span className="min-w-0 flex-1">{summary}</span>
					{/* A row's trailing chevron (DESIGN.md › Icons): 18px at stroke 2, faint. */}
					<ChevronDown
						size={18}
						strokeWidth={2}
						aria-hidden="true"
						className={cn(
							'shrink-0 text-ink-faint transition-transform duration-200 group-data-[panel-open]:rotate-180',
							aside && 'lg:hidden',
						)}
					/>
				</Accordion.Trigger>
			</Accordion.Header>
			<Accordion.Panel className={cn('a-panel', aside && 'lg:hidden')}>
				<div className="border-t border-line-soft px-2.5 py-2.5">{children}</div>
			</Accordion.Panel>
		</Accordion.Item>
	);
}

/** The open panel under the row whose `value` is `row`, if it is on the page. */
function panelOf(row: string): HTMLElement | null {
	const item = [...document.querySelectorAll('[data-row]')].find(
		(el) => el.getAttribute('data-row') === row,
	);
	const controls = item?.querySelector('[aria-controls]')?.getAttribute('aria-controls');
	return controls ? document.getElementById(controls) : null;
}

/** How long a closing row is followed: `.a-panel`'s 190ms, and a frame or two. */
const FOLLOW_MS = 320;

/**
 * THE TAPPED HEAD STAYS UNDER THE FINGER (#111, #119, #120).
 *
 * Two things move it when rows close, and a quick second tap, chalky and
 * one-handed, then lands on a neighbour:
 *
 * - **The page end.** A list at the end of the page that closes a row shortens
 *   the page under a scroll position that may no longer exist; the browser
 *   clamps it and everything slides down. So before the change renders, `end`
 *   (an element the page puts last, see `RowsEnd`) is given whatever the closing
 *   panels take that the room below the screen cannot absorb, and an open hands
 *   back what is no longer needed.
 * - **A row above closing.** With one row open at a time, opening a row below
 *   the open one closes the one above it, and the tapped head rises by that
 *   row's height. So the page follows the head for as long as the panel takes
 *   to close, scrolling by what it moved each frame.
 *
 * Measured at the press, before the change renders: the panel closes over
 * 190ms (`.a-panel`), so nothing has moved when the render lands and a measure
 * after it reads zero (#119). Call `hold` from `RowGroup`'s `onValueChange` with
 * the rows open before the press.
 */
export function useRowsInPlace(): {
	end: RefObject<HTMLDivElement | null>;
	hold: (open: readonly string[], next: readonly string[], event: Event) => void;
} {
	const end = useRef<HTMLDivElement>(null);
	const hold = useCallback((open: readonly string[], next: readonly string[], event: Event) => {
		const head = event.target instanceof Element ? event.target.closest('[aria-expanded]') : null;
		const stays = new Set(next);
		const closing = open
			.filter((row) => !stays.has(row))
			.map(panelOf)
			.filter((panel): panel is HTMLElement => panel != null);

		const tail = end.current;
		if (tail) {
			const shrink = closing.reduce((n, panel) => n + panel.getBoundingClientRect().height, 0);
			const room = document.documentElement.scrollHeight - window.innerHeight - window.scrollY;
			const held = Number.parseFloat(tail.style.height) || 0;
			const keep = Math.max(0, held + shrink - room);
			tail.style.height = keep ? `${keep}px` : '';
		}

		const above = closing.some(
			(panel) => head && panel.compareDocumentPosition(head) & Node.DOCUMENT_POSITION_FOLLOWING,
		);
		if (head && above && typeof requestAnimationFrame === 'function') {
			const top = head.getBoundingClientRect().top;
			const until = performance.now() + FOLLOW_MS;
			const follow = () => {
				const drift = head.getBoundingClientRect().top - top;
				if (drift) window.scrollBy(0, drift);
				if (performance.now() < until) requestAnimationFrame(follow);
			};
			requestAnimationFrame(follow);
		}
	}, []);
	return { end, hold };
}

/** The element `useRowsInPlace` lengthens the page by: put it last on the page.
 *  It takes no space until a close needs it (`-mt-sections` cancels the gap the
 *  page's column puts before it). */
export function RowsEnd({ ref }: { ref: RefObject<HTMLDivElement | null> }) {
	return <div ref={ref} aria-hidden="true" data-tail="" className="-mt-sections" />;
}
