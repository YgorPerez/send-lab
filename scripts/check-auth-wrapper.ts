// Gate step: every exported method of every server route goes through
// `withAthlete`.
//
// ADR 0006 chose per-handler authorization over middleware, because offline the
// service worker serves the shell and middleware never runs — so the client must
// handle the unauthenticated case correctly regardless, and an optimistic
// middleware redirect would be the same decision implemented twice. The named
// weakness of that choice is that a forgotten wrapper is a silent, exploitable
// hole: the route works, returns data, and nobody notices until someone reads it.
//
// This is the check that makes the weakness loud. It is deliberately a textual
// scan rather than a type-level guarantee: a type can be satisfied by a wrapper
// that does nothing, and the failure being guarded against is an omission.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const routesDir = fileURLToPath(new URL('../src/routes', import.meta.url));

/** Routes that legitimately authenticate no one, with the reason. Anything not
 *  listed here must use the wrapper. */
const EXEMPT: Record<string, string> = {
	'api/auth/$.ts': "better-auth's own endpoints — this is how an athlete signs in",
};

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

function walk(dir: string, prefix = ''): string[] {
	const out: string[] = [];
	for (const name of readdirSync(dir)) {
		const full = join(dir, name);
		const rel = prefix ? `${prefix}/${name}` : name;
		if (statSync(full).isDirectory()) out.push(...walk(full, rel));
		else if (/\.(ts|tsx)$/.test(name)) out.push(rel);
	}
	return out;
}

const failures: string[] = [];
let checked = 0;

for (const rel of walk(routesDir)) {
	const source = readFileSync(join(routesDir, rel), 'utf8');
	// Only files that actually declare server handlers are in scope.
	if (!/\bserver\s*:\s*\{/.test(source) || !/\bhandlers\s*:/.test(source)) continue;
	checked++;

	if (rel in EXEMPT) continue;

	for (const method of HTTP_METHODS) {
		// Match `GET:` at a handler position and capture what follows it.
		const m = new RegExp(`\\b${method}\\s*:\\s*([\\s\\S]{0,80})`).exec(source);
		if (!m) continue;
		if (!m[1].includes('withAthlete')) {
			failures.push(`${rel} — ${method} does not go through withAthlete()`);
		}
	}
}

if (failures.length) {
	console.error('check:routes — unwrapped server route method(s):\n');
	for (const f of failures) console.error(`  ${f}`);
	console.error('\nWrap it in withAthlete(), or add it to EXEMPT here with the reason.');
	process.exit(1);
}

console.log(
	`check:routes — ok (${checked} server route file(s), ${Object.keys(EXEMPT).length} exempt)`,
);
