// The two calls the settings screen makes about the API token. Kept out of the
// route so the page does not know what HTTP is, and so the shape of `/api/tokens`
// is stated once. Both throw on anything but a 200: the caller's only question
// is whether it has a token, and offline the honest answer is that it does not.

interface TokenBody {
	token: string;
}

async function tokenFrom(response: Response, what: string): Promise<string> {
	if (!response.ok) throw new Error(`${what} /api/tokens — HTTP ${response.status}`);
	const body = (await response.json()) as TokenBody;
	return body.token;
}

/** The account's token, minted on first call. */
export async function readToken(): Promise<string> {
	return tokenFrom(await fetch('/api/tokens'), 'GET');
}

/** Invalidate the current token and issue a fresh one. Any client configured
 *  with the old one stops working the moment this resolves. */
export async function regenerateToken(): Promise<string> {
	return tokenFrom(await fetch('/api/tokens', { method: 'POST' }), 'POST');
}
