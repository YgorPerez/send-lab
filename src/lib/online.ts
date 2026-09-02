// Whether the device believes it has a network.
//
// `navigator.onLine` is the browser's own answer and the only one available
// before a request is tried. It is optimistic — a captive portal reads as online
// — so a screen uses it to say what *will not* work rather than to promise what
// will, and a failed request is still the final word. `store/sync.ts` listens
// to the same `online` event to retry unsynced work; this is the read half, for
// a screen that has to tell the athlete which of its controls need a connection
// (#24: preferences work offline, account actions do not).
import { useSyncExternalStore } from 'react';

function subscribe(notify: () => void): () => void {
	window.addEventListener('online', notify);
	window.addEventListener('offline', notify);
	return () => {
		window.removeEventListener('online', notify);
		window.removeEventListener('offline', notify);
	};
}

const read = (): boolean => typeof navigator === 'undefined' || navigator.onLine;

/** `true` while the browser reports a connection. The prerendered shell reads
 *  `true`: it has nothing to disable, and a page's controls are not in it. */
export function useOnline(): boolean {
	return useSyncExternalStore(subscribe, read, () => true);
}
