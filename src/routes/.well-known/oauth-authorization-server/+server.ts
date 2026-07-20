// RFC 8414 authorization-server metadata — advertises the authorize / token /
// registration endpoints and the supported grants + PKCE method.
import { json } from '@sveltejs/kit';
import { authorizationServerMetadata, CORS_HEADERS } from '$lib/server/oauth';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url }) =>
	json(authorizationServerMetadata(url.origin), { headers: CORS_HEADERS });

export const OPTIONS: RequestHandler = () =>
	new Response(null, { status: 204, headers: CORS_HEADERS });
