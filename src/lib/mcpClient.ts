// Thin wrappers around the /api/tokens endpoints (kept out of the component so
// data-fetching doesn't live in a Svelte script). One token per user.

/** Fetch the user's token (the server mints one on first call). */
export async function getToken(): Promise<string | null> {
	const res = await fetch('/api/tokens');
	return res.ok ? (await res.json()).token : null;
}

/** Kill the current token and get a fresh one. */
export async function regenerateToken(): Promise<string | null> {
	const res = await fetch('/api/tokens', { method: 'POST' });
	return res.ok ? (await res.json()).token : null;
}
