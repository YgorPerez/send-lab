// RFC 7591 dynamic client registration. An MCP client with no pre-arranged
// credentials POSTs its redirect URIs here and gets a client_id back.
import { json } from '@sveltejs/kit';
import { CORS_HEADERS, registerClient } from '$lib/server/oauth';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => null);
	try {
		const client = await registerClient(body);
		return json(client, { status: 201, headers: CORS_HEADERS });
	} catch (e) {
		return json(
			{ error: 'invalid_client_metadata', error_description: (e as Error).message },
			{ status: 400, headers: CORS_HEADERS },
		);
	}
};

export const OPTIONS: RequestHandler = () =>
	new Response(null, { status: 204, headers: CORS_HEADERS });
