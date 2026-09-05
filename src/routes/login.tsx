// SIGN IN.
//
// The last of the nine pages, and deliberately so: it is cheap and it yields no
// primitives, so building it earlier would have bought the pages after it
// nothing. What it does own is the one place in the app where the network is not
// optional, and the copy that has to be right when it is missing.
//
// A DESTINATION, NEVER A GATE
// ---------------------------
// **No page in this app is auth-blocked.** ADR 0006 declined middleware, and the
// reason it stays declined is here: offline the service worker serves the shell
// and middleware never runs, so the client has to handle the unauthenticated
// case correctly anyway — an optimistic redirect would be the same decision
// implemented twice, with the copy that runs less often being the one that rots.
// The app is usable without an account, `AppShell` keeps its three tabs on this
// screen like any other, and nothing here is a dead end. That is also why there
// is no "continue without an account" button: there is nothing to continue *from*.
//
// THE OFFLINE EXCEPTION, AND WHAT IT MUST NOT IMPLY
// -------------------------------------------------
// #24 decided every page works offline **except this one** — it needs a server to
// verify anything. The same ticket decided **a lapsed sign-in never clears the
// local store or the queue**: only an explicit sign-out, made online and after
// the queue has drained, clears anything, and that one lives on Settings where
// it can be held until the queue is empty.
//
// So an athlete whose sign-in lapsed still has every set they logged on this
// device, including writes that have not been sent. What they *see* is an empty
// app, because `__root.tsx` points the store at the signed-out namespace the
// moment a sign-in resolves to absent — the records are untouched under their
// own prefix, but nothing on screen says so. This page is where that gets said,
// and getting it said is most of what this page is for. `screens/login.ts` picks
// which of the three lines applies; `heldAccounts()` is what tells a device that
// has held a record from one that has not, since the sign-in is absent for both.
//
// *Sign-in*, not *session*: a session in this app is training (`CONTEXT.md`), and
// `screens/login.ts` carries the distinction in full. `useSession` below is
// better-auth's own spelling and stays.
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { type FormEvent, useId, useState } from 'react';
import { useOnline } from '$lib/online';
import * as m from '$lib/paraglide/messages';
import {
	type AuthFailure,
	classifyAuthFailure,
	type LoginNotice,
	resolveLogin,
} from '$lib/screens/login';
import { heldAccounts } from '$lib/store/collections';
import { setActiveAccount, useActiveAccount } from '$lib/store/record';
import { cn } from '$lib/utils';
import { Bare, Eyebrow, Pane } from '../components/ui/primitives';
import { button, chip, input } from '../components/ui/variants';
import { authClient, signIn, signUp } from '../lib/auth-client';

export const Route = createFileRoute('/login')({ component: Login });

/** Message functions, not strings: each reads the locale when it is called,
 *  which is after the root has re-keyed the tree on a switch. */
const NOTICE: Record<LoginNotice, () => string> = {
	offline: m.login_offline,
	'has-record': m.login_has_record,
	'no-record': m.login_no_record,
};

/** One sentence per failure, and the two that matter are opposite instructions:
 *  `credentials` says type something else, `unreachable` says change nothing and
 *  try again. `server` is its own line rather than sharing `unreachable`'s,
 *  because that one promises nothing was sent and a request that reached a
 *  server cannot promise it. `refused` is the generic. */
const FAILURE: Record<AuthFailure, () => string> = {
	credentials: m.auth_bad_credentials,
	taken: m.auth_email_taken,
	unreachable: m.auth_unreachable,
	server: m.auth_server_error,
	refused: m.auth_error,
};

/** Gold for the offline line — a warning about this device, the same colour
 *  Settings gives its caveats — and dim ink for the two that are information. */
const NOTICE_TONE: Record<LoginNotice, string> = {
	offline: 'text-gold',
	'has-record': 'text-ink-dim',
	'no-record': 'text-ink-dim',
};

function Login() {
	// The store's active account, not the sign-in (Settings keys on the same
	// thing, for the same reason): offline the sign-in cannot be checked and
	// reports nobody, and telling a signed-in athlete in a gym basement that they
	// are signed out is the worst thing this particular page could do.
	const account = useActiveAccount();
	const online = useOnline();
	// Read once, at mount — the idiom for anything that comes out of storage. It
	// cannot change while the page is open: a record appears on this device only
	// by signing in, and signing in navigates away.
	//
	// A lazy initialiser rather than a `useSyncExternalStore` with a server
	// snapshot, which is what the other two device reads on this page are. That
	// is safe here and only here: ADR 0006's seam means no route renders into the
	// prerendered shell — `__root.tsx` holds the Outlet back until the client has
	// hydrated — so there is no baked markup for this to disagree with.
	// `check:hydration` covers `/login` in both locales.
	const [held] = useState(heldAccounts);
	const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
	const screen = resolveLogin({ account, online, held });
	const signup = mode === 'sign-up';

	return (
		// One pane at every width (#52): a sign-in form is two fields and a button,
		// and a second column is earned rather than granted.
		<Pane>
			<header className="flex items-baseline justify-between gap-2 pt-1.5">
				<h1 className="h-screen-title">
					{screen.signedIn ? m.set_account() : signup ? m.signup_title() : m.login_title()}
				</h1>
				{online ? null : <span className={chip({ tone: 'warn' })}>{m.sync_offline()}</span>}
			</header>

			{screen.signedIn ? (
				<SignedIn />
			) : (
				<>
					{/* The lede and the notices are one group, not three children of the
					    pane: `Pane` sets 28px between sections, which is the space that
					    makes eight things read as eight — and this is one thing said in
					    two or three sentences. */}
					<div className="-mt-4 flex flex-col gap-2">
						<p className="text-[13px] leading-snug text-ink-dim">
							{signup ? m.signup_subtitle() : m.login_subtitle()}
						</p>
						{screen.notices.map((notice) => (
							<p key={notice} className={cn('text-[12.5px] leading-snug', NOTICE_TONE[notice])}>
								{NOTICE[notice]()}
							</p>
						))}
					</div>
					<SignInForm
						signup={signup}
						reachable={online}
						onMode={() => setMode(signup ? 'sign-in' : 'sign-up')}
					/>
				</>
			)}
		</Pane>
	);
}

/**
 * Already signed in, which on this page means one thing: there is nothing to do
 * here. The one `primary` is the way back to Today.
 *
 * Signing out is **not** offered. It lives on Settings, where it flushes the
 * queue first and is held — with the reason on screen — if anything is still
 * unsent (#24, #58). A second sign-out button here without that hold would be a
 * one-tap path to losing training, which is the exact outcome the rule exists to
 * prevent.
 *
 * The email comes with the sign-in, so on a cold offline load there is none: the
 * eyebrow stands alone rather than showing a guess, the same way Settings does
 * it. The store already told us an account is signed in; the sign-in only adds
 * the address once it has answered.
 */
function SignedIn() {
	const { data: session } = authClient.useSession();
	const email = session?.user?.email ?? null;

	return (
		<>
			<Bare>
				<Eyebrow>{m.field_email()}</Eyebrow>
				{email ? <p className="truncate text-[13px] text-ink">{email}</p> : null}
			</Bare>
			{/* The way out and the line about the way *further* out, grouped: the
			    pane's 28px belongs between sections, and these are one. */}
			<div className="flex flex-col gap-2.5">
				<Link to="/" className={button({ kind: 'primary', size: 'touch' })}>
					{m.btn_go_today()}
				</Link>
				<p className="text-[12.5px] leading-snug text-ink-dim">{m.login_signout_note()}</p>
			</div>
		</>
	);
}

/**
 * The form, in its two modes.
 *
 * Inputs carry a real `<label>` rather than a placeholder: a placeholder
 * disappears on focus and is not an accessible name. The 16px base size comes
 * from the `input` recipe and is not a style choice — under 16px iOS zooms the
 * viewport on focus, and this screen is nothing but inputs.
 */
function SignInForm({
	signup,
	reachable,
	onMode,
}: {
	signup: boolean;
	reachable: boolean;
	onMode: () => void;
}) {
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [failure, setFailure] = useState<AuthFailure | null>(null);
	const [busy, setBusy] = useState(false);
	const navigate = useNavigate();
	const emailId = useId();
	const passwordId = useId();

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setBusy(true);
		setFailure(null);
		try {
			const answer = signup
				? // better-auth requires a name. This app has one athlete per account
					// and no screen that shows a display name, so asking for one would be
					// a field with no reader; the address stands in for it.
					await signUp.email({ name: email, email, password })
				: await signIn.email({ email, password });
			if (answer.error) {
				setFailure(classifyAuthFailure(answer.error));
				return;
			}
			// The server's own answer about who just signed in — the most resolved a
			// sign-in ever gets. Pointing the store at it here rather than waiting
			// for `__root.tsx`'s effect is what keeps the next screen from rendering
			// the signed-out store for a frame; the effect then agrees with it.
			const accountId = answer.data?.user?.id;
			if (accountId) setActiveAccount(accountId);
			// A new account has no baseline, so it goes to the intake; an existing one
			// goes to Today. Neither is a gate — `welcome` is skippable and Today
			// carries the line back to it (#64).
			//
			// `react-doctor` reports `tanstack-start-no-navigate-in-render` on this
			// line, and it is the same false positive `welcome.tsx` carries: the rule
			// matches any `navigate()` not lexically inside a JSX handler, and this
			// one runs from a submit that has already awaited the server. The rule
			// behind it is real — a navigation decided during render is a redirect,
			// and ADR 0006 keeps those out of this app — and this is not one.
			await navigate({ to: signup ? '/welcome' : '/' });
		} catch {
			// better-auth's client does not set better-fetch's `catchAllError`, so a
			// request that never reached a server **throws** rather than answering.
			// Nothing was sent, and the athlete's password is not the problem.
			setFailure('unreachable');
		} finally {
			setBusy(false);
		}
	}

	return (
		<form className="flex flex-col gap-3" onSubmit={submit}>
			<label className="flex flex-col gap-1" htmlFor={emailId}>
				<Eyebrow>{m.field_email()}</Eyebrow>
				<input
					id={emailId}
					className={input({ align: 'left', class: 'min-h-11' })}
					type="email"
					autoComplete="email"
					required
					value={email}
					onChange={(e) => setEmail(e.target.value)}
				/>
			</label>
			<label className="flex flex-col gap-1" htmlFor={passwordId}>
				<Eyebrow>{m.field_password()}</Eyebrow>
				<input
					id={passwordId}
					className={input({ align: 'left', class: 'min-h-11' })}
					type="password"
					// New on sign-up, current on sign-in: the wrong one here is how a
					// password manager offers to overwrite a saved credential.
					autoComplete={signup ? 'new-password' : 'current-password'}
					required
					// better-auth's floor. Said up front rather than as a round trip
					// through the server for something the field already knows.
					minLength={signup ? 8 : undefined}
					value={password}
					onChange={(e) => setPassword(e.target.value)}
				/>
			</label>
			{signup ? <p className="text-[12px] text-ink-faint">{m.auth_password_min()}</p> : null}

			{failure ? (
				// `role="alert"` because the sentence appears after a tap and is the
				// only thing that changed on the screen.
				<p role="alert" className="text-[13px] leading-snug text-flag">
					{FAILURE[failure]()}
				</p>
			) : null}

			{/* The screen's one `primary`: signing in is the thing this page exists
			    for. Disabled offline rather than hidden — a control that vanishes
			    leaves the athlete looking for it, and the line above already says
			    why it cannot be used. */}
			<button
				type="submit"
				disabled={!reachable || busy}
				className={button({ kind: 'primary', size: 'touch' })}
			>
				{signup ? m.btn_sign_up() : m.btn_sign_in()}
			</button>

			<button
				type="button"
				onClick={() => {
					setFailure(null);
					onMode();
				}}
				className={button({ kind: 'bare', size: 'md', class: 'min-h-11' })}
			>
				{signup ? m.auth_to_login() : m.auth_to_signup()}
			</button>
		</form>
	);
}
