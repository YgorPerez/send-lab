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

export function RowGroup({ children }: { children: ReactNode }) {
	return (
		<Accordion.Root className="flex flex-col overflow-hidden rounded-lg border border-line bg-panel">
			{children}
		</Accordion.Root>
	);
}

export function Row({
	value,
	summary,
	children,
}: {
	/** A stable id for this row — never a display label (ADR-0003). */
	value: string;
	summary: ReactNode;
	children: ReactNode;
}) {
	return (
		<Accordion.Item
			value={value}
			className="border-b border-line-soft last:border-b-0 data-[open]:bg-panel-2/40"
		>
			<Accordion.Header>
				<Accordion.Trigger className="group flex min-h-11 w-full items-center gap-2 px-2.5 py-2 text-left transition-colors active:bg-panel-2">
					<span className="min-w-0 flex-1">{summary}</span>
					<ChevronDown
						size={14}
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
