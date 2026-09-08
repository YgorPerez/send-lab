// Where in the world the athlete's day starts.
//
// Preferences carried units and a language and nothing that answers "when is it
// morning for this athlete" — so a server job running at a fixed UTC hour would
// compute a "today" that is their yesterday or tomorrow. #75 added the field;
// this is the one thing that ever fills it.
//
// WHY THE DEVICE DECIDES, AND WHY IT KEEPS DECIDING
// ------------------------------------------------
// There is no screen for this and there should not be: an athlete who has flown
// to a competition has not changed a preference, they have changed where they
// are, and the phone in their pocket already knows. So the zone is read from the
// browser rather than asked for, and re-read on every boot — the most recently
// opened device wins under last-write-wins, which is exactly the device whose
// morning the notice should arrive in. Two accounts on one phone get the same
// answer for the same reason: the zone belongs to the device, not to whoever is
// signed in.
import { useEffect } from 'react';
import { writePrefsIfChanged } from './prefs';
import { useActiveAccount } from './record';

/**
 * The IANA zone this browser is in, or `null` if it will not say.
 *
 * Guarded rather than assumed: the shell prerenders with no `window`, and a
 * runtime with no zone database answers with an empty string. `UTC` is **not**
 * filtered — it is a real answer from a machine really set to UTC, and treating
 * it as a non-answer would silently drop the one athlete it is true for.
 */
export function deviceTimeZone(): string | null {
	if (typeof window === 'undefined') return null;
	try {
		return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
	} catch {
		return null;
	}
}

/**
 * Put the device's zone on the account, unless the account already has it.
 *
 * Exported for the test: the hook below is one line around this, and the
 * decisions worth checking — a browser that names no zone, an account that
 * already agrees — are all here.
 */
export async function recordDeviceTimeZone(): Promise<void> {
	const zone = deviceTimeZone();
	if (!zone) return;
	await writePrefsIfChanged({ timeZone: zone });
}

/**
 * Keep the account's time zone matching the device this boot is on.
 *
 * Called once, at the top of the app tree.
 */
export function useDeviceTimeZone(): void {
	const account = useActiveAccount();
	// `account` is the *reason to run again*, not a value this effect reads: the
	// collections are keyed by account (`sendlab:<accountId>:prefs`), so signing in
	// swaps the row underneath without changing anything named here. Reading it
	// inside just to satisfy the rule would be the dishonest fix.
	// biome-ignore lint/correctness/useExhaustiveDependencies: see above
	useEffect(() => {
		void recordDeviceTimeZone();
	}, [account]);
}
