// The platform's close request, for a popup that is open.
//
// Android's back gesture reaches a page as a close request, which only a
// `CloseWatcher` hears (Chrome 120+); without one the gesture goes back a
// page, out from under whatever the popup was holding. Escape is a close
// request too, but Base UI hears it first, as a keydown: the top popup closes
// and cancels the key, and a cancelled key never reaches a watcher. So only
// the gesture arrives here.
//
// A popup can have another open over it (the full-screen clock's ⋯ menu), and
// the request is for the top one. A watcher cannot know which that is, and
// closing its own popup took the menu down with it. So a request is handed
// on as the key Base UI already answers, an Escape keydown at the focus: the
// top popup closes, as it would on Escape, and `onClose` runs only if nothing
// took the key. A watcher hears one request and is spent, so where the popup
// is still open after one, the next is watched for again.

import { useEffect, useEffectEvent } from 'react';

/** The part of the platform's `CloseWatcher` used here, declared because not
 *  every browser has one. */
type CloseWatcherClass = new () => { onclose: (() => void) | null; destroy: () => void };

/** While `open`, the system back gesture closes the top popup, and `onClose`
 *  runs if no popup took it. Where there is no `CloseWatcher`, nothing. */
export function useCloseRequest(open: boolean, onClose: () => void): void {
	const close = useEffectEvent(onClose);
	useEffect(() => {
		if (!open) return;
		const Watcher = (globalThis as { CloseWatcher?: CloseWatcherClass }).CloseWatcher;
		if (!Watcher) return;
		let watcher = new Watcher();
		const hear = () => {
			watcher = new Watcher();
			watcher.onclose = hear;
			const key = new KeyboardEvent('keydown', {
				key: 'Escape',
				code: 'Escape',
				bubbles: true,
				cancelable: true,
			});
			(document.activeElement ?? document.body).dispatchEvent(key);
			if (!key.defaultPrevented) close();
		};
		watcher.onclose = hear;
		return () => watcher.destroy();
	}, [open]);
}
