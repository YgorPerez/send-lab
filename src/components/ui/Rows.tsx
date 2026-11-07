// The expanding row — the Log screen's whole structure, and the readiness
// check's summary on Today.
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
import type { ReactNode } from 'react';
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
	children,
}: {
	/** A stable id for this row — never a display label (ADR-0003). */
	value: string;
	summary: ReactNode;
	/** A 48px head in the rows' 15px, for a list worked through mid-set (the
	 *  Timer's preset groups); 44px otherwise. */
	touch?: boolean;
	children: ReactNode;
}) {
	return (
		<Accordion.Item
			value={value}
			className="border-b border-line-soft last:border-b-0 data-[open]:bg-panel-2/40"
		>
			<Accordion.Header>
				<Accordion.Trigger
					className={cn(
						'group flex w-full items-center gap-2 px-2.5 py-2 text-left transition-colors hover:bg-panel-2 active:bg-panel-2',
						touch ? 'min-h-12 text-[15px] font-semibold text-ink' : 'min-h-11',
					)}
				>
					<span className="min-w-0 flex-1">{summary}</span>
					{/* A row's trailing chevron (DESIGN.md › Icons): 18px at stroke 2, faint. */}
					<ChevronDown
						size={18}
						strokeWidth={2}
						aria-hidden="true"
						className="shrink-0 text-ink-faint transition-transform duration-200 group-data-[panel-open]:rotate-180"
					/>
				</Accordion.Trigger>
			</Accordion.Header>
			<Accordion.Panel className="a-panel">
				<div className="border-t border-line-soft px-2.5 py-2.5">{children}</div>
			</Accordion.Panel>
		</Accordion.Item>
	);
}
