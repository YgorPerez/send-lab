// Keep the screen on while a clock is counting.
//
// Lifted out of `Timer.tsx` when the stopwatch (#108) became the second thing
// that counts while the athlete is deliberately not touching the phone: a
// display that blanks 30 seconds into a hang, or into a boulder attempt being
// timed, is worse than no clock at all.
import { useEffect } from 'react';

/**
 * Hold a screen wake lock while `active`.
 *
 * The browser drops the lock on a visibility change either way, so it is
 * re-requested when the page comes back. Denied or unsupported is silent: the
 * clock still runs, and the screen just times out as usual.
 */
export function useWakeLock(active: boolean): void {
	useEffect(() => {
		if (!active) return;
		const nav = navigator as Navigator & {
			wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> };
		};
		if (!nav.wakeLock) return;
		let sentinel: { release: () => Promise<void> } | null = null;
		let cancelled = false;
		const acquire = () => {
			nav.wakeLock
				?.request('screen')
				.then((s) => {
					if (cancelled) void s.release();
					else sentinel = s;
				})
				// Nothing to do and nothing worth telling the athlete.
				.catch(() => {});
		};
		const onVisible = () => {
			if (document.visibilityState === 'visible') acquire();
		};
		acquire();
		document.addEventListener('visibilitychange', onVisible);
		return () => {
			cancelled = true;
			document.removeEventListener('visibilitychange', onVisible);
			void sentinel?.release();
		};
	}, [active]);
}
