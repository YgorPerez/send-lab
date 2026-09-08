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
// what an installed app cold-starts from, and that the worker still listens for
// the message the update prompt sends it.
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

// The update prompt's other half.
//
// `components/UpdatePrompt.tsx` posts `{ type: 'SKIP_WAITING' }` to the waiting
// worker, and the worker takes over only because it listens for that exact type.
// The string used to be **not ours to name** — workbox's generated code owned it,
// nothing in `src/` defined it, and a workbox upgrade renaming it would have left
// `tests/appUpdate.test.ts` green while the button did nothing at all. #76 made
// the worker a source file, so `src/sw.ts` names it now and the two ends can be
// read against each other. This assertion stays anyway: it is the bundler, not
// workbox, that could now drop the listener silently.
//
// There is deliberately no unconditional `self.skipWaiting()` beside it (a swap
// under a live session is #24's and #27's problem), so this listener is the
// *only* way an update ever reaches the athlete.
if (!source.includes('SKIP_WAITING')) {
	fail(
		"the worker does not listen for 'SKIP_WAITING' — the update prompt's button\n" +
			'  would post a message nothing acts on, and every deploy would stay\n' +
			'  undeliverable until the athlete closed every tab. See\n' +
			'  src/components/UpdatePrompt.tsx and src/lib/appUpdate.ts.',
	);
}

console.log(
	`check:sw — ok (${entries} precached entries, ${(bytes / 1024).toFixed(1)} kB worker, ` +
		'listens for SKIP_WAITING)',
);
