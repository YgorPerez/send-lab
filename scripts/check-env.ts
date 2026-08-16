// Gate step: `.env.example` must still satisfy the server env schema.
//
// SvelteKit's `$env/static/private` failed the build on a missing variable.
// TanStack Start has no equivalent, and a dynamic lookup silently escapes
// inlining rather than failing — so a renamed or dropped variable would reach
// production undetected. This is the check that replaces it.
//
// It validates the *example* file, not the developer's real `.env`: the example
// is the contract every deploy is configured from, and it is the copy that goes
// stale when a variable is renamed.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const examplePath = fileURLToPath(new URL('../.env.example', import.meta.url));

function parseDotenv(text: string): Record<string, string> {
	const out: Record<string, string> = {};
	for (const rawLine of text.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line || line.startsWith('#')) continue;
		const eq = line.indexOf('=');
		if (eq === -1) continue;
		out[line.slice(0, eq).trim()] = line
			.slice(eq + 1)
			.trim()
			.replace(/^["']|["']$/g, '');
	}
	return out;
}

const example = parseDotenv(readFileSync(examplePath, 'utf8'));

// Load the schema with the example's values in place, so `createEnv` validates
// them rather than whatever happens to be in this shell.
const saved = { ...process.env };
try {
	for (const [k, v] of Object.entries(example)) process.env[k] = v;
	// Never let the example's placeholder secret look like production.
	process.env.NODE_ENV = 'development';
	await import('../src/lib/server/env.ts');
} catch (err) {
	console.error('check:env — .env.example does not satisfy the env schema:\n');
	console.error(err instanceof Error ? err.message : String(err));
	process.exit(1);
} finally {
	for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
	Object.assign(process.env, saved);
}

// Every variable the schema declares must be present in the example, even when
// optional — the example is documentation as much as it is a contract.
const declared = [
	'BETTER_AUTH_SECRET',
	'BETTER_AUTH_URL',
	'TURSO_DATABASE_URL',
	'TURSO_AUTH_TOKEN',
];
const missing = declared.filter((k) => !(k in example));
if (missing.length) {
	console.error(`check:env — .env.example is missing: ${missing.join(', ')}`);
	process.exit(1);
}

console.log(`check:env — ok (${declared.length} variables documented)`);
