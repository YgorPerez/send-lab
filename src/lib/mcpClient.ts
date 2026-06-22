// Thin wrappers around the /api/tokens endpoints (kept out of the component so
// data-fetching doesn't live in a Svelte script).
export type TokenRow = { id: string; name: string; createdAt: string };

export async function listTokens(): Promise<TokenRow[]> {
	const res = await fetch('/api/tokens');
	return res.ok ? res.json() : [];
}

export async function createToken(name: string): Promise<string | null> {
	const res = await fetch('/api/tokens', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ name }),
	});
	return res.ok ? (await res.json()).token : null;
}

export async function revokeToken(id: string): Promise<void> {
	await fetch(`/api/tokens?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
}
