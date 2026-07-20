// RFC 9728 protected-resource metadata — tells an MCP client which authorization
// server guards this resource (the /mcp endpoint).
import { json } from '@sveltejs/kit';
import { CORS_HEADERS, protectedResourceMetadata } from '$lib/server/oauth';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url }) =>
	json(protectedResourceMetadata(url.origin), { headers: CORS_HEADERS });

export const OPTIONS: RequestHandler = () =>
	new Response(null, { status: 204, headers: CORS_HEADERS });
