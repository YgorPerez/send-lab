// Compiles the inlang project, then refuses to succeed on an empty result.
//
// Two problems, one script:
//
// 1. Message compilation used to require network access. The plugins in
//    `project.inlang/settings.json` are CDN URLs the SDK fetches on every compile,
//    so an offline box, a CI runner without egress, or a filtering proxy broke the
//    build. `serveInlangPluginsLocally()` serves them from `node_modules` instead —
//    see scripts/inlang-local-plugins.ts for why interception is the mechanism.
//
// 2. An empty compile used to pass silently. When a plugin fails to load,
//    `paraglide-js` reports `PluginImportError` as a *warning*, prints
//    "Successfully compiled", and exits 0 having emitted none of the messages.
//    Nothing downstream noticed: `svelte-check` typed every `m.foo()` call against
//    an empty module and produced 629 "Property 'foo' does not exist" errors, which
//    read as a mass regression in the app rather than as one failed download, and a
//    `vite build` in that state would ship a UI with no strings at all.
//
// The guard below trips only on *zero* messages rather than comparing against the
// base locale's key count: message-to-export mapping is a codegen detail of the
// paraglide version in use, so a strict parity check could fail a perfectly good
// build, while "the base locale has strings but nothing was generated" is
// unambiguous at any codegen shape.
//
// This runs the compiler in-process rather than shelling out to the `paraglide-js`
// CLI, because the local-plugin shim patches `fetch` and so only affects this
// process. `vite.config.ts` installs the same shim for the dev/build path.
import { readdirSync, readFileSync } from 'node:fs';
import { compile } from '@inlang/paraglide-js';
import { serveInlangPluginsLocally } from './inlang-local-plugins';
import { PARAGLIDE_STRATEGY } from './paraglide-strategy';

const PROJECT = './project.inlang';
const OUTDIR = './src/lib/paraglide';

type Settings = {
	baseLocale: string;
	'plugin.inlang.messageFormat'?: { pathPattern?: string };
};

function fail(problem: string, explanation: string): never {
	console.error(`\n✗ paraglide compile produced no usable messages: ${problem}\n`);
	console.error(explanation);
	process.exit(1);
}

const served = serveInlangPluginsLocally(`${PROJECT}/settings.json`);
for (const file of served) console.log(`i inlang plugin served locally: ${file}`);

// The strategy has to be passed here too, not just in `vite.config.ts` — this
// compiler overwrites the same generated runtime. See `paraglide-strategy.ts`.
await compile({ project: PROJECT, outdir: OUTDIR, strategy: [...PARAGLIDE_STRATEGY] });

const settings: Settings = JSON.parse(readFileSync(`${PROJECT}/settings.json`, 'utf8'));
const pathPattern = settings['plugin.inlang.messageFormat']?.pathPattern;
if (!pathPattern) {
	fail(
		'settings.json has no plugin.inlang.messageFormat.pathPattern',
		'Cannot locate the message files to verify the compile against.',
	);
}

const basePath = pathPattern.replace('{locale}', settings.baseLocale);
const baseMessages = JSON.parse(readFileSync(basePath, 'utf8'));
const sourceCount = Object.keys(baseMessages).filter((k) => !k.startsWith('$')).length;

// Shape-tolerant: any re-export, declaration or binding counts as a message.
const EXPORTS = /^\s*export\s+(?:const|let|var|function|\*|\{)/gm;
const generatedCount = readdirSync(`${OUTDIR}/messages`)
	.filter((f) => f.endsWith('.js'))
	.reduce(
		(n, f) => n + (readFileSync(`${OUTDIR}/messages/${f}`, 'utf8').match(EXPORTS)?.length ?? 0),
		0,
	);

if (sourceCount > 0 && generatedCount === 0) {
	fail(
		`${basePath} defines ${sourceCount} message(s) but the compiler emitted none`,
		`${OUTDIR}/messages/ contains no exported messages, so every m.*() call in\n` +
			`the app resolves to nothing. This usually means an inlang plugin failed to\n` +
			`load, or pathPattern no longer matches where the message files live.`,
	);
}

console.log(
	`✓ paraglide: ${generatedCount} message export(s) from ${sourceCount} source message(s).`,
);
