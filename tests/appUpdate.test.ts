// When the app says a new version is ready, and when it says nothing.
//
// The decision this covers is one line wide and easy to get backwards: an update
// prompt on a **first install** tells an athlete the app they just opened is out
// of date, and a missing prompt on an **update** is the bug the notice exists to
// fix. `navigator.serviceWorker.controller` is what separates the two, and it is
// the only thing distinguishing them.
//
// jsdom has no service worker, so none of this could be asserted against the real
// API. `lib/appUpdate.ts` takes the two shapes it touches structurally for
// exactly this reason: the whole decision becomes a function of a plain object.
import { describe, expect, it, vi } from 'vitest';
import {
	activateUpdate,
	type RegistrationLike,
	reloadWhenTakenOver,
	type WorkerLike,
	watchForUpdate,
} from '../src/lib/appUpdate.ts';

function worker(state: string): WorkerLike & { fire(): void; posted: unknown[] } {
	const listeners: (() => void)[] = [];
	const posted: unknown[] = [];
	return {
		state,
		posted,
		postMessage: (message) => void posted.push(message),
		addEventListener: (_type, listener) => void listeners.push(listener),
		fire: () => {
			for (const l of listeners) l();
		},
	};
}

function registration(init: {
	waiting?: WorkerLike | null;
	installing?: WorkerLike | null;
}): RegistrationLike & { found(): void } {
	const listeners: (() => void)[] = [];
	return {
		waiting: init.waiting ?? null,
		installing: init.installing ?? null,
		addEventListener: (_type, listener) => void listeners.push(listener),
		found: () => {
			for (const l of listeners) l();
		},
	};
}

describe('watchForUpdate', () => {
	it('says so when a worker was already waiting from an earlier visit', () => {
		// The common case and the one with no event left to hear: the worker
		// finished installing last time and has been waiting ever since, so the
		// state has to be read rather than listened for.
		const onWaiting = vi.fn();
		watchForUpdate(registration({ waiting: worker('installed') }), true, onWaiting);
		expect(onWaiting).toHaveBeenCalledTimes(1);
	});

	it('says so when one finishes installing while the page is open', () => {
		const onWaiting = vi.fn();
		const installing = worker('installing');
		const reg = registration({ installing });

		watchForUpdate(reg, true, onWaiting);
		reg.found();
		expect(onWaiting, 'fired while the worker was still installing').not.toHaveBeenCalled();

		installing.state = 'installed';
		installing.fire();
		expect(onWaiting).toHaveBeenCalledTimes(1);
	});

	// The half that is easy to get backwards, and the reason `controlled` exists.
	it('says nothing on a first install, when no worker is running the page yet', () => {
		const onWaiting = vi.fn();
		const installing = worker('installing');
		const reg = registration({ waiting: worker('installed'), installing });

		watchForUpdate(reg, false, onWaiting);
		reg.found();
		installing.state = 'installed';
		installing.fire();

		expect(
			onWaiting,
			'a first install is not an update: the app that just opened is the new one',
		).not.toHaveBeenCalled();
	});

	it('fires once, however many times the state changes', () => {
		const onWaiting = vi.fn();
		const installing = worker('installing');
		const reg = registration({ installing });

		watchForUpdate(reg, true, onWaiting);
		reg.found();
		installing.state = 'installed';
		installing.fire();
		installing.fire();
		installing.fire();
		expect(onWaiting).toHaveBeenCalledTimes(1);
	});

	it('says nothing after it is unsubscribed', () => {
		const onWaiting = vi.fn();
		const installing = worker('installing');
		const reg = registration({ installing });

		const stop = watchForUpdate(reg, true, onWaiting);
		reg.found();
		stop();
		installing.state = 'installed';
		installing.fire();
		expect(onWaiting).not.toHaveBeenCalled();
	});
});

describe('activateUpdate', () => {
	it('asks the waiting worker to take over, in the message it listens for', () => {
		// `SKIP_WAITING` is not ours to name: workbox's generated worker listens for
		// this exact type, and a rename here is a notice whose button does nothing.
		const waiting = worker('installed');
		activateUpdate(registration({ waiting }));
		expect(waiting.posted).toEqual([{ type: 'SKIP_WAITING' }]);
	});

	it('does nothing when there is no worker waiting', () => {
		expect(() => activateUpdate(registration({}))).not.toThrow();
	});
});

// The reload half (#122). `sw.ts` calls `clientsClaim()`, so a first install
// takes over the page it was registered from, and that fires `controllerchange`
// as an update does. Reloading on it reloaded every first visit a moment after
// it opened, under whatever the athlete was doing, and under the gates:
// `check:contrast --desktop` read the baked shell (7 elements against a floor of
// 12) whenever the claim landed just before it measured `/settings`.
describe('reloadWhenTakenOver', () => {
	function container(controller: unknown) {
		const listeners: (() => void)[] = [];
		const c = {
			controller,
			addEventListener: (_type: 'controllerchange', listener: () => void) =>
				void listeners.push(listener),
			takeOver(next: unknown) {
				c.controller = next;
				for (const l of listeners) l();
			},
		};
		return c;
	}

	it('does not reload a page that no worker controlled: that is a first install', () => {
		const sw = container(null);
		const reload = vi.fn();
		reloadWhenTakenOver(sw, reload);
		sw.takeOver({});
		expect(reload).not.toHaveBeenCalled();
	});

	it('reloads once when a new worker takes over from the one running the page', () => {
		const sw = container({ version: 1 });
		const reload = vi.fn();
		reloadWhenTakenOver(sw, reload);
		sw.takeOver({ version: 2 });
		sw.takeOver({ version: 3 });
		expect(reload).toHaveBeenCalledTimes(1);
	});

	it('reloads on an update that arrives after a first install in the same tab', () => {
		const sw = container(null);
		const reload = vi.fn();
		reloadWhenTakenOver(sw, reload);
		sw.takeOver({ version: 1 });
		sw.takeOver({ version: 2 });
		expect(reload).toHaveBeenCalledTimes(1);
	});
});
