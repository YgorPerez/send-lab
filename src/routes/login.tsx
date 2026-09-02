// Sign in.
//
// This was the scaffold's `/` (#21): the page that proved the app boots
// client-only, an athlete can sign in, and an authenticated read reaches Turso.
// It moves here rather than being deleted, because `/` is now Today and those
// three things still need somewhere to be true.
//
// It is deliberately **not redesigned**. `login` is one of the nine page tickets
// on the rebuild map (#11) and owns its own first-run and error states; the
// component vocabulary (#53) only moved it and dressed it in the primitives so it
// stops being the one screen with hand-rolled classes. Everything about its
// *shape* is still the scaffold's.
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import * as m from '$lib/paraglide/messages';
import { Column, Eyebrow, Section } from '../components/ui/primitives';
import { button, card, input } from '../components/ui/variants';
import { authClient, signIn, signOut } from '../lib/auth-client';

export const Route = createFileRoute('/login')({ component: Login });

interface Me {
	name: string | null;
	email: string | null;
	stateUpdatedAt: string | null;
}

function Login() {
	const { data: session, isPending } = authClient.useSession();

	if (isPending) return <div className="min-h-[50dvh]" />;

	return (
		// One column at every width. A sign-in form is two fields and a button; the
		// desktop layout has nothing to give it, which is the point #52 makes about
		// most of the nine pages — a second column is earned, not granted.
		<Column>
			<header className="pt-1.5">
				<h1 className="h-screen-title">{m.btn_sign_in()}</h1>
			</header>
			{/* `session?.user`, not `session`. A session object that arrives without a
			    user — a malformed or non-JSON response to `get-session`, which is
			    exactly what an offline navigation served the app shell would produce —
			    used to reach `session.user.name` and take the whole page down to the
			    router's error boundary. Found by `pnpm check:contrast`, which could not
			    measure a screen that never rendered. Falling back to the signed-out
			    view is the honest answer: no user means not signed in. */}
			{session?.user ? <SignedIn name={session.user.name || session.user.email} /> : <SignInForm />}
		</Column>
	);
}

function SignedIn({ name }: { name: string }) {
	const [me, setMe] = useState<Me | null>(null);
	const [error, setError] = useState<string | null>(null);

	// Fetched in an effect rather than through a route loader, deliberately:
	// ADR 0006 excludes route loaders for account data, because loader caching is
	// what re-introduces back/forward reuse of one athlete's data.
	useEffect(() => {
		let cancelled = false;
		fetch('/api/me')
			.then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
			.then((data: Me) => {
				if (!cancelled) setMe(data);
			})
			.catch((e: Error) => {
				if (!cancelled) setError(e.message);
			});
		return () => {
			cancelled = true;
		};
	}, []);

	return (
		<Section label={m.btn_sign_in()}>
			<div className={card()}>
				<p className="text-[14px] text-ink">{name}</p>
				<p className="num mt-2 text-[12px] text-ink-dim">
					{me
						? `database reachable · state ${me.stateUpdatedAt ? `last written ${me.stateUpdatedAt}` : 'not yet written'}`
						: error
							? `database read failed: ${error}`
							: '…'}
				</p>
				<button
					type="button"
					className={button({ size: 'md', class: 'mt-4 min-h-11' })}
					onClick={() => void signOut()}
				>
					{m.btn_sign_out()}
				</button>
			</div>
		</Section>
	);
}

function SignInForm() {
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [error, setError] = useState<string | null>(null);

	async function submit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		setError(null);
		const r = await signIn.email({ email, password });
		if (r.error) setError(r.error.message ?? 'Sign-in failed');
	}

	// Inputs carry a real <label>, not a placeholder: a placeholder disappears on
	// focus and is not an accessible name. The 16px base size comes from the
	// `input` recipe — anything smaller makes iOS zoom the viewport on focus.
	return (
		<form className="flex max-w-sm flex-col gap-3" onSubmit={submit}>
			<label className="flex flex-col gap-1" htmlFor="email">
				<Eyebrow>{m.field_email()}</Eyebrow>
				<input
					id="email"
					className={input({ align: 'left', class: 'min-h-11' })}
					type="email"
					autoComplete="email"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
				/>
			</label>
			<label className="flex flex-col gap-1" htmlFor="password">
				<Eyebrow>{m.field_password()}</Eyebrow>
				<input
					id="password"
					className={input({ align: 'left', class: 'min-h-11' })}
					type="password"
					autoComplete="current-password"
					value={password}
					onChange={(e) => setPassword(e.target.value)}
				/>
			</label>
			<button type="submit" className={button({ kind: 'primary', size: 'touch' })}>
				{m.btn_sign_in()}
			</button>
			{error ? <p className="text-[13px] text-flag">{error}</p> : null}
		</form>
	);
}
