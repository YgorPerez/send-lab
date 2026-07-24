// RFC 9728 forms the metadata URL by inserting `/.well-known/oauth-protected-resource`
// between the host and the resource's own path — so the metadata for the resource
// `https://host/mcp` lives at `https://host/.well-known/oauth-protected-resource/mcp`,
// not at the bare well-known path. MCP clients (including claude.ai connectors) use
// that path-inserted form, so serve it here; the bare path is kept by the parent
// route for clients that ask for it directly.
import { error, json } from '@sveltejs/kit';
import { CORS_HEADERS, protectedResourceMetadata } from '$lib/server/oauth';
import type { RequestHandler } from './$types';

/** `/mcp` is the only protected resource this server exposes. */
const isMcpResource = (resource: string) => resource.replace(/^\/+|\/+$/g, '') === 'mcp';

export const GET: RequestHandler = ({ params, url }) => {
	if (!isMcpResource(params.resource)) error(404, 'Unknown protected resource.');
	return json(protectedResourceMetadata(url.origin), { headers: CORS_HEADERS });
};

export const OPTIONS: RequestHandler = () =>
	new Response(null, { status: 204, headers: CORS_HEADERS });
