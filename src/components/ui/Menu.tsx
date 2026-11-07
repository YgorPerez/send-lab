// A row's ⋯: the actions a list row has besides the one its tap does (#119).
//
// Base UI's menu, so it announces as a menu button and its items as menu items,
// arrows move between them and Escape closes it. The Timer list's rows were the
// first (#111, as a page composition); spec #113 made it a primitive so the next
// list with row actions does not draw its own.
//
// THE TRIGGER IS ITS OWN CONTROL
// ------------------------------
// A separate, bordered 44px square beside the row, never an icon inside it: an
// icon-only affordance attached to a larger control does not read as one
// (`component-vocabulary.md`, the measured rules). Its label names what it acts
// on — "Delete" alone does not say what goes — so the caller passes a label, not
// a word.
//
// NOTHING IS COLOURED APART
// -------------------------
// A destructive item is worded, not painted: colour here reports state, and a
// red Delete is decoration. What guards it is the question the caller asks next
// (`AlertDialog`).
import { Menu as Base } from '@base-ui/react/menu';
import { Ellipsis } from 'lucide-react';
import { cn } from '$lib/utils';

export interface MenuAction {
	/** The item's words, in the locale. */
	label: string;
	onSelect: () => void;
}

const ITEM =
	'flex min-h-11 cursor-default items-center rounded-md px-3 text-[15px] text-ink outline-none select-none data-[highlighted]:bg-panel-3';

export function RowMenu({
	label,
	actions,
	placement = 'row',
}: {
	/** The trigger's accessible name: what it acts on ("Actions for Tabata"). */
	label: string;
	/** In the order offered. */
	actions: readonly MenuAction[];
	/** Beside a row, the row's height at 14px corners; in a dialog's header, the
	 *  48px square of the close beside it. */
	placement?: 'row' | 'header';
}) {
	return (
		<Base.Root>
			<Base.Trigger
				aria-label={label}
				className={cn(
					'flex shrink-0 items-center justify-center border border-line text-ink-dim transition-colors hover:bg-panel-2 hover:text-ink data-[popup-open]:bg-panel-3 data-[popup-open]:text-ink',
					placement === 'row'
						? 'min-h-11 w-11 self-stretch rounded-xl'
						: 'size-12 self-start rounded-md bg-panel-2',
				)}
			>
				<Ellipsis size={20} strokeWidth={1.75} aria-hidden="true" />
			</Base.Trigger>
			<Base.Portal>
				<Base.Positioner sideOffset={6} align="end" collisionPadding={12} className="z-50">
					{/* Closing, it takes no taps: an item tapped again as the menu fades
					    would run twice. */}
					<Base.Popup className="min-w-[180px] rounded-lg border border-line bg-panel p-1 shadow-lg transition-[opacity,transform] duration-150 data-[ending-style]:pointer-events-none data-[ending-style]:scale-[0.98] data-[ending-style]:opacity-0 data-[starting-style]:scale-[0.98] data-[starting-style]:opacity-0">
						{actions.map((a) => (
							<Base.Item key={a.label} className={ITEM} onClick={a.onSelect}>
								{a.label}
							</Base.Item>
						))}
					</Base.Popup>
				</Base.Positioner>
			</Base.Portal>
		</Base.Root>
	);
}
