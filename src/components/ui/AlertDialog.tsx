// A question the athlete has to answer before something irreversible happens.
//
// Base UI's alert dialog rather than its plain dialog: it is modal, it cannot be
// dismissed by clicking outside, and it announces as `alertdialog`, so the one
// way past it is one of the two buttons. The plain `Dialog` is for a sheet the
// athlete opens and closes at will — the timer face, the injury self-check — and
// this is for the case where closing it without answering would be the wrong
// default. Regenerating the API token is the first use (#62): it invalidates a
// token the athlete has configured in another client, and nothing on this device
// can undo that.
//
// Controlled, like `Dialog` is used everywhere here: the page owns `open` and
// renders its own trigger, so the trigger can be any button the page already
// has. The confirm is the dialog's one `primary`; the page under it carries
// none, which is how a settings screen keeps the one-per-screen ration.
import { AlertDialog as Base } from '@base-ui/react/alert-dialog';
import type { ReactNode } from 'react';
import { button } from './variants';

export function AlertDialog({
	open,
	onOpenChange,
	title,
	description,
	cancel,
	confirm,
	onConfirm,
	busy,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: ReactNode;
	description: ReactNode;
	cancel: string;
	confirm: string;
	onConfirm: () => void;
	/** The action is under way: the confirm drops its fill and cannot be pressed
	 *  twice. */
	busy?: boolean;
}) {
	return (
		<Base.Root open={open} onOpenChange={onOpenChange}>
			<Base.Portal>
				<Base.Backdrop className="fixed inset-0 z-40 bg-black/70 transition-opacity duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
				<Base.Popup className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-32px)] max-w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-line bg-panel p-4 transition-[opacity,transform] duration-150 data-[ending-style]:scale-[0.97] data-[ending-style]:opacity-0 data-[starting-style]:scale-[0.97] data-[starting-style]:opacity-0">
					<Base.Title className="text-[15px] leading-snug font-semibold text-ink">
						{title}
					</Base.Title>
					<Base.Description className="mt-1.5 text-[13px] leading-snug text-ink-dim">
						{description}
					</Base.Description>
					{/* Cancel first, confirm last — the reading order puts the safe answer
					    under the thumb first. Both wrap, because pt-BR runs longer. */}
					<div className="mt-4 flex flex-wrap justify-end gap-2">
						<Base.Close className={button({ size: 'md', class: 'min-h-11' })}>{cancel}</Base.Close>
						<button
							type="button"
							disabled={busy}
							onClick={onConfirm}
							className={button({ kind: 'primary', size: 'md', class: 'min-h-11' })}
						>
							{confirm}
						</button>
					</div>
				</Base.Popup>
			</Base.Portal>
		</Base.Root>
	);
}
