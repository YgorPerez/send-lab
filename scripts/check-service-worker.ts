// Gate step: the built service worker exists, is non-empty, and actually
// precaches something.
//
// ADR 0005 makes this a build failure rather than a warning, on evidence: both
// ecosystems' PWA tooling fails silently behind a green build, and one reported
// case shipped a truncated worker to production for six days. A worker that
// registers cleanly and precaches nothing looks identical to a working one until
// the device goes offline — which, for this app, is the feature.
//
// It also asserts the shell is in the manifest, because that single entry is
// what an installed app cold-starts from.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { clientOutputDir } from './output-dir.ts';

const clientDir = clientOutputDir();
const swPath = join(clientDir, 'sw.js');
const shellPath = join(clientDir, '_shell.html');

function fail(message: string): never {
	console.error(`check:sw — ${message}`);
	process.exit(1);
}

if (!existsSync(swPath)) fail('no service worker at dist/client/sw.js');

const bytes = statSync(swPath).size;
if (bytes < 512) fail(`service worker is ${bytes} bytes — truncated or empty`);

const source = readFileSync(swPath, 'utf8');

// workbox emits `precacheAndRoute([{url:…,revision:…}, …])`. An empty array is
// the exact silent failure this check exists for.
const manifest = /precacheAndRoute\(\s*\[([\s\S]*?)\]\s*(?:,|\))/.exec(source);
if (!manifest) fail('service worker has no precache manifest');

const entries = manifest[1].match(/"url"\s*:|url\s*:/g)?.length ?? 0;
if (entries === 0) fail('precache manifest is empty — the worker caches nothing');

if (!existsSync(shellPath)) fail('no prerendered shell at dist/client/_shell.html');
if (!/_shell\.html/.test(source)) {
	fail('the shell is not precached — an installed app would need the network to cold-start');
}

// The shell must stay user-independent (ADR 0006): it is precached once and
// served to whoever opens the app. Catching an account-specific shell here is
// cheaper than catching it as a cross-account leak.
const shell = readFileSync(shellPath, 'utf8');
for (const marker of ['"email"', '"userId"', 'sessionToken']) {
	if (shell.includes(marker)) fail(`shell contains ${marker} — it must be user-independent`);
}

console.log(`check:sw — ok (${entries} precached entries, ${(bytes / 1024).toFixed(1)} kB worker)`);
