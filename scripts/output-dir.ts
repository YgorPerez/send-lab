// Where the built client assets landed.
//
// Nitro decides this from its preset, and the preset differs by host: a local
// build is `node-server` and writes `.output/public`, while a Vercel build uses
// the `vercel` preset and writes Build Output API v3 into `.vercel/output/static`.
// Hard-coding either one means the service worker is generated for the wrong
// directory on the other — and since a worker that precaches nothing looks
// identical to a working one until the device goes offline, that failure would
// be silent. Hence resolving it rather than assuming it.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

/** The prerendered shell — present in whichever directory is the real one. */
const SHELL = '_shell.html';

export function clientOutputDir(): string {
	const candidates: string[] = [];

	// Nitro writes its own manifest naming the public directory. Prefer it over
	// guessing.
	const nitroManifest = join(root, '.output', 'nitro.json');
	if (existsSync(nitroManifest)) {
		try {
			const { publicDir } = JSON.parse(readFileSync(nitroManifest, 'utf8')) as {
				publicDir?: string;
			};
			if (publicDir) candidates.push(join(root, '.output', publicDir));
		} catch {
			// Unreadable manifest — fall through to the known layouts.
		}
	}

	candidates.push(
		join(root, '.vercel', 'output', 'static'), // nitro, vercel preset
		join(root, '.output', 'public'), // nitro, node-server preset
		join(root, 'dist', 'client'), // no nitro (plain vite build)
	);

	const found = candidates.find((dir) => existsSync(join(dir, SHELL)));
	if (!found) {
		throw new Error(
			`Could not find the built client output — no ${SHELL} in any of:\n${candidates.map((c) => `  ${c}`).join('\n')}`,
		);
	}
	return found;
}
