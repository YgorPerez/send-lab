import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isForbiddenCrossSiteForm } from '../src/lib/server/csrf';

const ORIGIN = 'https://send-lab-sable.vercel.app';

/** Build a request the way a client actually would. Omit `origin` to model a
 *  server-to-server caller, which sends no Origin header at all. */
function req(
	pathname: string,
	{
		method = 'POST',
		contentType,
		origin,
	}: { method?: string; contentType?: string; origin?: string },
): Request {
	const headers = new Headers();
	if (contentType) headers.set('content-type', contentType);
	if (origin) headers.set('origin', origin);
	return new Request(`${ORIGIN}${pathname}`, {
		method,
		headers,
		body: method === 'GET' || method === 'HEAD' ? undefined : '',
	});
}

const forbidden = (pathname: string, opts: Parameters<typeof req>[1]) =>
	isForbiddenCrossSiteForm(req(pathname, opts), ORIGIN, pathname);

test('the token endpoint accepts a form POST carrying no Origin', () => {
	// The regression this guard exists to avoid. RFC 6749 §4.1.3 mandates
	// application/x-www-form-urlencoded, and an MCP client fetching server-to-server
	// sends no Origin — the combination SvelteKit's built-in check rejects outright,
	// which broke every OAuth connection at the token exchange.
	assert.equal(
		forbidden('/oauth/token', { contentType: 'application/x-www-form-urlencoded' }),
		false,
	);
});

test('the token endpoint is exempt by path, not by who is calling', () => {
	// A registered client may be browser-hosted and send its own Origin. The endpoint
	// carries no ambient authority either way, so the exemption does not depend on it.
	assert.equal(
		forbidden('/oauth/token', {
			contentType: 'application/x-www-form-urlencoded',
			origin: 'https://claude.ai',
		}),
		false,
	);
});

test('app state is not writable by a cross-site text/plain form', () => {
	// /api/state is cookie-authenticated and blind-upserts the athlete's entire app
	// state. It reads request.text(), so it accepts text/plain — which IS cross-site
	// form submittable, and whose `name=value\r\n` encoding can be crafted to parse as
	// valid JSON. Exempting the token endpoint must not widen the hole to this.
	assert.equal(forbidden('/api/state', { contentType: 'text/plain' }), true);
	assert.equal(
		forbidden('/api/state', { contentType: 'text/plain', origin: 'https://evil.test' }),
		true,
	);
});

test('the consent POST rejects a cross-site submission', () => {
	// Dynamic client registration is open, so without this an attacker could register
	// a client and CSRF a signed-in athlete into approving it.
	assert.equal(
		forbidden('/oauth/authorize', {
			contentType: 'application/x-www-form-urlencoded',
			origin: 'https://evil.test',
		}),
		true,
	);
});

test('a same-origin form POST is allowed', () => {
	assert.equal(
		forbidden('/oauth/authorize', {
			contentType: 'application/x-www-form-urlencoded',
			origin: ORIGIN,
		}),
		false,
	);
});

test('JSON posts are never treated as form submissions', () => {
	// A cross-site HTML form cannot set application/json, so these are safe by
	// construction. This is what keeps /mcp and the /api/v1 routes — all Bearer-token
	// callers that send no Origin — working.
	assert.equal(forbidden('/mcp', { contentType: 'application/json' }), false);
	assert.equal(forbidden('/api/v1/workouts', { contentType: 'application/json' }), false);
});

test('a charset parameter does not defeat the content-type match', () => {
	assert.equal(
		forbidden('/api/state', {
			contentType: 'text/plain; charset=utf-8',
			origin: 'https://evil.test',
		}),
		true,
	);
	assert.equal(
		forbidden('/api/state', { contentType: 'TEXT/PLAIN', origin: 'https://evil.test' }),
		true,
	);
});

test('safe methods are never blocked', () => {
	assert.equal(forbidden('/api/state', { method: 'GET', origin: 'https://evil.test' }), false);
});

test('every unsafe method is covered, not just POST', () => {
	for (const method of ['PUT', 'PATCH', 'DELETE']) {
		assert.equal(
			forbidden('/api/state', { method, contentType: 'text/plain', origin: 'https://evil.test' }),
			true,
			`${method} should be guarded`,
		);
	}
});
