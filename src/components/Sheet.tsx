// The sheet. Everything secondary in this direction arrives from the bottom.
//
// Base UI's Drawer, not Motion. #46 chose Base UI on touch specifically because
// its swipe-dismiss ignores drags that start on an input — which matters here,
// since two of these sheets contain typing. Motion is still needed in this
// direction (see `Latch.tsx`), but a sheet that already handles the keyboard,
// focus trapping and velocity-scaled release is not the place to spend it.
//
// The mechanics are in `app.css` (`.sheet-*`): Base UI publishes the live finger
// offset as a CSS custom property and expects CSS to apply it.
import { Drawer } from '@base-ui/react/drawer';
import { X } from 'lucide-react';
import type * as React from 'react';
import * as m from '$lib/paraglide/messages';

export function Sheet({
	open,
	onOpenChange,
	title,
	description,
	children,
}: {
	open: boolean;
	onOpenChange: (next: boolean) => void;
	title: string;
	description?: string;
	children: React.ReactNode;
}) {
	return (
		<Drawer.Root open={open} onOpenChange={onOpenChange} swipeDirection="down">
			<Drawer.Portal>
				<Drawer.Backdrop className="sheet-backdrop" />
				<Drawer.Viewport className="sheet-viewport">
					<Drawer.Popup className="sheet-popup">
						{/* The grab bar. Knurled, because on real equipment knurling is
						    where you are told to put your hand — and it is the only
						    discoverability the drag gesture gets. */}
						<div className="sticky top-0 z-10 bg-[var(--panel-2)] px-4 pt-3 pb-3">
							<div
								aria-hidden="true"
								className="knurl mx-auto h-[7px] w-16 rounded-full bg-panel-3"
							/>
							<div className="mt-3 flex items-start gap-3">
								<div className="min-w-0 flex-1">
									<Drawer.Title className="text-[19px] leading-tight font-bold tracking-tight text-ink">
										{title}
									</Drawer.Title>
									<Drawer.Description className="mt-1 font-mono text-[11px] tracking-wider text-ink-faint uppercase">
										{description ?? m.sheet_grab()}
									</Drawer.Description>
								</div>
								{/* The tappable equivalent of the drag. Always present. */}
								<Drawer.Close
									aria-label={m.btn_close()}
									className="slab flex size-14 shrink-0 items-center justify-center rounded-md text-ink transition-transform duration-75 active:slab-press"
								>
									<X className="size-6" strokeWidth={3} />
								</Drawer.Close>
							</div>
						</div>
						<div className="px-4 pt-1 pb-5">{children}</div>
					</Drawer.Popup>
				</Drawer.Viewport>
			</Drawer.Portal>
		</Drawer.Root>
	);
}
