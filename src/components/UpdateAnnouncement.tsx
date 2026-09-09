// "A new version is ready."
//
// The notice that stops a deploy from being silently undeliverable. `lib/appUpdate.ts`
// carries why it has to exist — in short, the worker is generated with
// `skipWaiting: false`, so an update waits until every tab is closed, and a
// reload is not that. Until this line existed the athlete had no way to know a
// newer version was sitting there, or to ask for it.
//
// **Nothing swaps on its own.** The notice appears, and the swap happens when it
// is tapped. That is the conservative half of the update flow #27 owns; the
// designed one still has to answer what happens to unsent work at the moment of a
// swap, and how a stale bundle against a changed `/api/state` contract is
// detected rather than hoped about.
//
// WHERE IT SITS
// -------------
// Pinned to the bottom, in the space the tab bar left. Two reasons, and the
// second is the one that decided it: the bottom of a phone is the half a hand
// reaches, and this is the only notice in the app that asks to be *acted on*
// rather than read. It is also the one place a fixed element cannot cover
// anything now, which was not true a commit ago.
//
// It renders nothing on the server and nothing on the first client render:
// `useState(false)` and a subscription in an effect. ADR 0006 makes the
// prerendered shell user-independent and precached, and a notice baked into it
// would be an update prompt on a first cold start, before there is anything to
// update from — and a hydration mismatch on every load besides.
import { useEffect, useState } from 'react';
import { activateUpdate, reloadWhenTakenOver, watchForUpdate } from '$lib/appUpdate';
import * as m from '$lib/paraglide/messages';
import type { AppLocale } from '$lib/store/locale';
import { button } from './ui/variants';

export function UpdateAnnouncement({ locale }: { locale: AppLocale }) {
	const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

	useEffect(() => {
		if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;

		let cancelled = false;
		let unsubscribe: (() => void) | undefined;

		// `ready` rather than `register`: `__root.tsx` owns the registration, and
		// two calls to `register` for one URL is one registration either way. What
		// this needs is a handle on it, whenever it resolves.
		void navigator.serviceWorker.ready.then((reg) => {
			if (cancelled) return;
			unsubscribe = watchForUpdate(reg, navigator.serviceWorker.controller != null, () =>
				setRegistration(reg),
			);
		});

		reloadWhenTakenOver(navigator.serviceWorker);
		return () => {
			cancelled = true;
			unsubscribe?.();
		};
	}, []);

	if (!registration) return null;

	return (
		<div
			// Above the menu's popup, because an athlete who opens the menu should not
			// lose the notice behind it — and below nothing else, since there is
			// nothing else fixed to the bottom any more.
			className="fixed inset-x-0 bottom-0 z-[60] flex items-center justify-between gap-3 border-t border-line bg-panel px-3 py-2.5 pb-[max(10px,env(safe-area-inset-bottom))]"
			role="status"
		>
			<span className="min-w-0 flex-1 text-[13px] text-ink">{m.app_update_ready()}</span>
			<button
				type="button"
				onClick={() => activateUpdate(registration)}
				// The one `primary` on whatever screen it appears over. It is the only
				// thing this notice is for, and a `quiet` button on a bar that exists
				// solely to be tapped is a bar that gets ignored.
				className={button({ kind: 'primary', size: 'md', class: 'min-h-11 shrink-0' })}
			>
				{m.app_update_reload({}, { locale })}
			</button>
		</div>
	);
}
