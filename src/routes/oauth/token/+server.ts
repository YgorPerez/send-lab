// OAuth token endpoint (RFC 6749) — authorization_code (with PKCE) and
// refresh_token grants. Request bodies are form-encoded per spec.
import { json } from '@sveltejs/kit';
import {
	CORS_HEADERS,
	exchangeAuthCode,
	exchangeRefreshToken,
	OAuthError,
	type TokenResponse,
} from '$lib/server/oauth';
import type { RequestHandler } from './$types';

/** Client credentials may arrive via HTTP Basic or as body params. */
function clientCreds(
	request: Request,
	form: URLSearchParams,
): { id: string; secret: string | null } {
	const auth = request.headers.get('authorization') ?? '';
	if (auth.startsWith('Basic ')) {
		try {
			const [id, secret] = Buffer.from(auth.slice(6), 'base64').toString('utf8').split(':');
			return { id: decodeURIComponent(id ?? ''), secret: decodeURIComponent(secret ?? '') };
		} catch {
			/* fall through to body params */
		}
	}
	return { id: form.get('client_id') ?? '', secret: form.get('client_secret') };
}

export const POST: RequestHandler = async ({ request }) => {
	const form = new URLSearchParams(await request.text());
	const grantType = form.get('grant_type');
	const { id: clientId, secret: clientSecret } = clientCreds(request, form);

	try {
		let tokens: TokenResponse;
		if (grantType === 'authorization_code') {
			tokens = await exchangeAuthCode({
				code: form.get('code') ?? '',
				redirectUri: form.get('redirect_uri') ?? '',
				clientId,
				clientSecret,
				codeVerifier: form.get('code_verifier') ?? '',
			});
		} else if (grantType === 'refresh_token') {
			tokens = await exchangeRefreshToken({
				refreshToken: form.get('refresh_token') ?? '',
				clientId,
				clientSecret,
			});
		} else {
			throw new OAuthError('unsupported_grant_type', 400, `unsupported grant_type: ${grantType}`);
		}
		// Tokens must not be cached (RFC 6749 §5.1).
		return json(tokens, {
			headers: { ...CORS_HEADERS, 'Cache-Control': 'no-store', Pragma: 'no-cache' },
		});
	} catch (e) {
		if (e instanceof OAuthError)
			return json(
				{ error: e.error, error_description: e.description },
				{ status: e.status, headers: CORS_HEADERS },
			);
		return json(
			{ error: 'server_error', error_description: (e as Error).message },
			{ status: 500, headers: CORS_HEADERS },
		);
	}
};

export const OPTIONS: RequestHandler = () =>
	new Response(null, { status: 204, headers: CORS_HEADERS });
