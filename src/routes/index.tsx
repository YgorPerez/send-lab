import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { authClient, signIn, signOut } from '../lib/auth-client';

export const Route = createFileRoute('/')({
	component: Hello,
});

interface Me {
	name: string | null;
	email: string | null;
	stateUpdatedAt: string | null;
}

/**
 * The scaffold's hello page. Not a design — the redesign map (#42) owns that,
 * and the four direction prototypes replace this. It exists to prove the three
 * things #21 asks for: the app boots client-only, an athlete can sign in, and an
 * authenticated read reaches Turso.
 */
function Hello() {
	const { data: session, isPending } = authClient.useSession();
	const [me, setMe] = useState<Me | null>(null);
	const [error, setError] = useState<string | null>(null);

	// Fetched in an effect rather than through a route loader, deliberately:
	// ADR 0006 excludes route loaders for account data, because loader caching is
	// what re-introduces back/forward reuse of one athlete's data.
	useEffect(() => {
		if (!session) {
			setMe(null);
			return;
		}
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
	}, [session]);

	if (isPending) return <main className="min-h-dvh bg-background" />;

	return (
		<main className="min-h-dvh bg-background px-5 py-10 text-foreground">
			<h1 className="font-mono text-[11px] tracking-wider text-ink-faint uppercase">Send Lab</h1>

			{/* `session?.user`, not `session`. A session object that arrives without a
			    user — a malformed or non-JSON response to `get-session`, which is
			    exactly what an offline navigation served the app shell would produce —
			    used to reach `session.user.name` and take the whole page down to the
			    router's error boundary. Found by `pnpm check:contrast`, which could
			    not measure a screen that never rendered. Falling back to the signed-out
			    view is the honest answer: no user means not signed in. */}
			{session?.user ? (
				<section className="mt-6">
					<p className="text-[15px]">
						Signed in as <strong>{session.user.name || session.user.email}</strong>
					</p>
					<p className="mt-2 font-mono text-[13px] text-ink-dim">
						{me
							? `database reachable · state ${me.stateUpdatedAt ? `last written ${me.stateUpdatedAt}` : 'not yet written'}`
							: error
								? `database read failed: ${error}`
								: 'reading…'}
					</p>
					<button
						type="button"
						className="mt-6 rounded-xl border border-line px-4 py-2 text-sm"
						onClick={() => void signOut()}
					>
						Sign out
					</button>
				</section>
			) : (
				<SignInForm />
			)}
		</main>
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
	// focus and is not an accessible name. The 16px base size is also deliberate —
	// anything smaller makes iOS zoom the viewport on focus.
	return (
		<form className="mt-6 flex max-w-sm flex-col gap-3" onSubmit={submit}>
			<label className="flex flex-col gap-1" htmlFor="email">
				<span className="font-mono text-[11px] tracking-wider text-ink-faint uppercase">Email</span>
				<input
					id="email"
					className="rounded-xl border border-line bg-panel-2 px-3 py-2 text-base"
					type="email"
					autoComplete="email"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
				/>
			</label>
			<label className="flex flex-col gap-1" htmlFor="password">
				<span className="font-mono text-[11px] tracking-wider text-ink-faint uppercase">
					Password
				</span>
				<input
					id="password"
					className="rounded-xl border border-line bg-panel-2 px-3 py-2 text-base"
					type="password"
					autoComplete="current-password"
					value={password}
					onChange={(e) => setPassword(e.target.value)}
				/>
			</label>
			<button type="submit" className="rounded-xl bg-flag px-4 py-2 text-sm text-bg">
				Sign in
			</button>
			{error ? <p className="text-[13px] text-flag">{error}</p> : null}
		</form>
	);
}
