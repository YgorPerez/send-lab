// Knowing a new version is waiting, and letting the athlete take it.
//
// THE PROBLEM THIS SOLVES
// -----------------------
// `scripts/build-service-worker.ts` generates the worker with
// `skipWaiting: false`, which is the safe default and not an oversight: a worker
// that takes over the moment it installs swaps the bundle under an athlete
// mid-session, against a sync contract that may have changed — the failure #24
// and #27 were split apart to avoid. The cost of that safety is that an updated
// worker sits in **waiting** until every tab of the app is closed. A reload does
// not do it, because reloading keeps the client alive.
//
// So a deploy was invisible. The app kept serving the old precached
// `/_shell.html` — which is `navigateFallback`, and therefore the chrome — and
// the athlete had no way to know a newer version existed or to ask for it. It
// went unnoticed until the navigation moved into a menu, which is the first
// change conspicuous enough to be missed.
//
// The answer here is the conservative half: **the athlete is told, and decides.**
// Nothing swaps on its own. Tapping the notice posts `SKIP_WAITING` to the
// waiting worker — the generated worker already listens for exactly that message
// — and the page reloads once it takes control.
//
// This is not #27's update flow, which still owns the designed one: whether an
// update should ever be forced, what happens to unsent work at the moment of a
// swap, and how a stale bundle against a changed `/api/state` contract is
// detected rather than hoped about. This is the notice that stops a deploy from
// being silently undeliverable in the meantime.
//
// WHY THE TYPES ARE STRUCTURAL
// ----------------------------
// `ServiceWorkerRegistration` cannot be constructed, and jsdom has no service
// worker at all, so a test that wanted the real thing could not run in `verify`.
// The two shapes below are the parts of it this module touches, which makes the
// whole decision — *is an update waiting, and is it an update rather than a first
// install* — assertable against a plain object.

/** The parts of a `ServiceWorker` this module uses. */
export interface WorkerLike {
	state: string;
	postMessage(message: unknown): void;
	addEventListener(type: 'statechange', listener: () => void): void;
}

/** The parts of a `ServiceWorkerRegistration` this module uses. */
export interface RegistrationLike {
	waiting: WorkerLike | null;
	installing: WorkerLike | null;
	addEventListener(type: 'updatefound', listener: () => void): void;
}

/**
 * Call `onWaiting` when a new version is installed and waiting to take over.
 *
 * `controlled` is whether a worker is already running the page
 * (`navigator.serviceWorker.controller != null`), and it is the whole difference
 * between an **update** and a **first install**. On a first visit the worker
 * installs and activates immediately with nothing to wait behind, and telling
 * that athlete a new version is ready would be telling them the app they just
 * opened is out of date.
 *
 * Returns an unsubscribe. Fires at most once: after the notice is up there is
 * nothing a second call would add.
 */
export function watchForUpdate(
	registration: RegistrationLike,
	controlled: boolean,
	onWaiting: () => void,
): () => void {
	let done = false;
	const fire = () => {
		if (done) return;
		done = true;
		onWaiting();
	};

	// The common case, and the one that is easy to miss: the worker finished
	// installing during an earlier visit and has been waiting ever since. There is
	// no event left to hear, so the state has to be read rather than listened for.
	if (registration.waiting && controlled) fire();

	registration.addEventListener('updatefound', () => {
		const installing = registration.installing;
		if (!installing) return;
		const check = () => {
			// `installed` is the state a worker reaches when it is ready and waiting.
			// Without `controlled` this also fires for the very first install.
			if (installing.state === 'installed' && controlled) fire();
		};
		check();
		installing.addEventListener('statechange', check);
	});

	return () => {
		done = true;
	};
}

/**
 * Ask the waiting worker to take over.
 *
 * The message is the one workbox's generated worker listens for. It is a
 * *request*: the swap happens in the worker, and the page finds out through
 * `controllerchange`, which is what `reloadWhenTakenOver` waits for.
 */
export function activateUpdate(registration: RegistrationLike): void {
	registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
}

/**
 * Reload once the new worker is in charge.
 *
 * Guarded, because `controllerchange` can fire more than once and a reload that
 * re-arms itself is a reload loop — the failure mode of every naive version of
 * this, and one that would present as an app that will not open.
 */
export function reloadWhenTakenOver(container: {
	addEventListener(type: 'controllerchange', listener: () => void): void;
}): void {
	let reloading = false;
	container.addEventListener('controllerchange', () => {
		if (reloading) return;
		reloading = true;
		window.location.reload();
	});
}
