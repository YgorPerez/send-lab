// What Sign in reads, and what it does with a refusal.
//
// Like `screens/welcome.ts`, this resolver has almost nothing to read: the page
// is a form, and a form's state is the athlete's typing. What it has instead are
// two decisions that are easy to get wrong in markup and impossible to see in a
// diff, so both live here where a test can ask them directly.
//
// 1. WHAT THIS DEVICE IS HOLDING
// -------------------------------
// *Sign-in*, not *session*, throughout — a session in this app is training
// (`CONTEXT.md`), and the two words met on this page for the first time. The
// authenticated one is a **sign-in**: the standing proof that a device is acting
// as an account. It lapses on its own, and a **sign-out** is the athlete ending
// it deliberately. `useSession` survives only where better-auth's own API spells
// it that way.
//
// Three athletes can be reading this page and they need three different
// sentences:
//
//   * one with no account, who has never signed in anywhere;
//   * one whose sign-in lapsed, whose training is all still on this device;
//   * one signed in already, who arrived here by tapping the wrong thing.
//
// A lapsed sign-in and a first run are indistinguishable from the sign-in
// itself: it is absent for both. What tells them apart is whether this device
// is still holding a record, which is `heldAccounts()` in
// `store/collections.ts`. That matters more here than anywhere else in the app,
// because of what #24 decided: **a lapse never clears the local store or the
// queue.** Only an explicit sign-out, made online and after the queue has
// drained, clears anything. So the athlete in front of a lapsed sign-in still
// has every set they logged and every write that has not been sent — and a page
// that reads like a fresh install is telling them, wrongly, that it is all gone.
//
// What the device holds is the honest question, and the notices are named for
// it. It cannot answer the athlete-shaped one: a record here means *someone*
// signed in on this device, and **Account** exists in the glossary precisely
// because that someone need not be the person now reading.
//
// 2. WHAT WENT WRONG, IN THE CATEGORIES THE ATHLETE CAN ACT ON
// ------------------------------------------------------------
// Wrong credentials and an unreachable server are opposite instructions — *type
// something else* against *change nothing and try again* — and they arrive
// through two different channels. Anything the server answered comes back as a
// returned `error` with a status and usually a code; a fetch that never landed
// **throws**, because better-auth's client does not set better-fetch's
// `catchAllError`. `classifyAuthFailure(null)` is the throw, and it is
// `unreachable` by construction.
//
// The messages themselves stay in `messages/` and are chosen by the route: this
// module names the case, never the sentence (ADR 0003 — a label is not an
// identifier, and this one has to exist in two languages).

/**
 * A line above the form. `offline` says the form cannot do anything yet; the
 * other two say what this device is holding.
 *
 * Named for the device rather than for the reader, and that is the correction
 * worth keeping: the pair was `returning` and `first-run`, which are claims
 * about a *person* the app cannot make. A record on this device means someone
 * signed in here, not that the athlete now reading is the same one — the
 * glossary keeps **Account** as "the boundary keeping one athlete's record
 * separate from another's on a shared device" precisely because that case is
 * real. `first-run` was the worse half of the two: it is a word **Intake**'s
 * `_Avoid_` list names, sitting one button away from the control that opens an
 * intake (ADR 0014).
 */
export type LoginNotice = 'offline' | 'has-record' | 'no-record';

export interface LoginScreen {
	/** Whether this device believes an account is signed in. */
	signedIn: boolean;
	/** What to say above the form, in order. Empty when there is nothing to
	 *  explain, which is only ever the signed-in case. */
	notices: readonly LoginNotice[];
}

export interface LoginInput {
	/** The store's active account — **not** the session. Offline the session
	 *  fetch fails and reports nobody, and `store/record.ts` remembers the last
	 *  account for exactly that reason.
	 *
	 *  Typed `string`, not `AthleteId`: the only question asked of it is whether
	 *  there is one, and a resolver that took a branded id would make every test
	 *  mint one to ask it. */
	account: string | null;
	online: boolean;
	/** The accounts whose records this device is still holding. */
	held: readonly string[];
}

/**
 * What the page shows, from what the device knows.
 *
 * Offline is a **second** notice rather than a replacement for the first, and
 * that is the correction worth writing down: it is a fact about the form, while
 * the other two are facts about the device, and the two are independent. An
 * athlete whose sign-in lapsed while standing in a gym basement is exactly who
 * the reassurance is written for — suppressing it there would drop the line in
 * the one state that most needs it.
 */
export function resolveLogin({ account, online, held }: LoginInput): LoginScreen {
	const signedIn = account !== null;
	if (signedIn) return { signedIn, notices: [] };
	const holding: LoginNotice = held.length > 0 ? 'has-record' : 'no-record';
	return { signedIn, notices: online ? [holding] : ['offline', holding] };
}

/**
 * What the page can say about a refusal.
 *
 * `unreachable` and `server` are split rather than folded together, because the
 * sentence differs on a fact rather than on a nuance: nothing reached a server
 * in the first case and something did in the second, so **"nothing was sent"**
 * is true of one and can be false of the other — a sign-up that 500s after the
 * row is written is exactly that. `refused` is the generic, for a server that
 * answered no for a reason this app has no better sentence for.
 */
export type AuthFailure = 'credentials' | 'taken' | 'unreachable' | 'server' | 'refused';

/** As much of better-auth's client error as the classification needs. Declared
 *  here rather than imported so a test can build one, and so the shape this
 *  depends on is written down in one place. */
export interface AuthErrorLike {
	status?: number;
	code?: string;
}

/** The codes that mean the athlete typed the wrong thing. */
const CREDENTIALS = new Set([
	'INVALID_EMAIL_OR_PASSWORD',
	'INVALID_PASSWORD',
	'INVALID_EMAIL',
	'USER_NOT_FOUND',
	'CREDENTIAL_ACCOUNT_NOT_FOUND',
]);

/** The codes that mean the email is already an account. Two spellings, because
 *  better-auth uses the longer one on sign-up and the shorter one elsewhere. */
const TAKEN = new Set(['USER_ALREADY_EXISTS', 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL']);

/**
 * Classify what came back from a sign-in or sign-up attempt.
 *
 * `null` or `undefined` means nothing answered — the caller caught a throw — and
 * that is `unreachable` rather than a refusal. The status is the fallback for a
 * missing or unrecognised code: a `401` is the athlete's, a `5xx` is the
 * server's, and anything else the server said no to is `refused`.
 */
export function classifyAuthFailure(error: AuthErrorLike | null | undefined): AuthFailure {
	if (!error) return 'unreachable';
	if (error.code && TAKEN.has(error.code)) return 'taken';
	if (error.code && CREDENTIALS.has(error.code)) return 'credentials';
	const status = error.status ?? 0;
	if (status === 0) return 'unreachable';
	if (status >= 500) return 'server';
	if (status === 401 || status === 403) return 'credentials';
	return 'refused';
}
