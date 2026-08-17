// The expanding row — the Log screen's whole structure, and the readiness
// check's on Today.
//
// A row is a summary line the athlete can read without opening it: date, the
// number that matters, and a one-line conclusion. Opening it is for the detail
// underneath. That is the density bargain this direction makes on a list of
// twenty-eight sessions — everything is on the screen, but only one line of
// each until asked.
//
// Base UI's accordion reports the panel's natural height as a CSS variable, so
// the open/close animation is declarative (see `.a-panel` in app.css) rather
// than a measure-then-animate pass in JS.
import { Accordion } from '@base-ui/react/accordion';
import { ChevronDown } from 'lucide-react';
import { cn } from '$lib/utils';

export function RowGroup({ children }: { children: React.ReactNode }) {
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
	value: string;
	summary: React.ReactNode;
	children: React.ReactNode;
}) {
	return (
		<Accordion.Item
			value={value}
			className="border-b border-line-soft last:border-b-0 data-[open]:bg-panel-2/40"
		>
			<Accordion.Header>
				<Accordion.Trigger
					className={cn(
						'group flex w-full items-center gap-2 px-2.5 py-2 text-left transition-colors active:bg-panel-2',
					)}
				>
					<span className="min-w-0 flex-1">{summary}</span>
					<ChevronDown
						size={14}
						className="shrink-0 text-ink-faint transition-transform duration-200 group-data-[panel-open]:rotate-180"
					/>
				</Accordion.Trigger>
			</Accordion.Header>
			<Accordion.Panel className="a-panel overflow-hidden">
				<div className="border-t border-line-soft px-2.5 py-2.5">{children}</div>
			</Accordion.Panel>
		</Accordion.Item>
	);
}
