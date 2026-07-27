// Compiles the inlang project, then refuses to succeed on an empty result.
//
// `paraglide-js compile` loads the plugins named in project.inlang/settings.json
// over the network from a CDN. When that fetch is blocked — an offline dev box, a
// CI runner without egress, a restrictive proxy — the import fails, the compiler
// prints `PluginImportError` as a *warning*, then reports "Successfully compiled"
// and exits 0 having emitted zero of the ~534 messages. Nothing downstream
// notices: `svelte-check` types every `m.foo()` call against an empty module and
// produces hundreds of "Property 'foo' does not exist" errors, which read as a
// mass regression in the app rather than one failed download. A `vite build` in
// that state ships a UI with no strings at all.
//
// So this wrapper turns that silent degradation into a loud, specific failure.
// Two independent signals, either of which fails the build:
//
//   1. the compiler reported a plugin it couldn't import — the direct cause, and
//      the one that actually explains what to fix
//   2. the compiler emitted no messages while the base locale defines some — a
//      backstop that catches an empty result whatever the reason
//
// (2) deliberately trips only on *zero* messages rather than comparing against
// the base locale's key count. Message-to-export mapping is a codegen detail of
// the paraglide version in use, so a strict parity check would risk failing a
// perfectly good build; "the base locale has strings but nothing was generated"
// is unambiguous at any codegen shape.
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';

const PROJECT = './project.inlang';
const OUTDIR = './src/lib/paraglide';

type Settings = {
	baseLocale: string;
	modules?: string[];
	'plugin.inlang.messageFormat'?: { pathPattern?: string };
};

/** The compiler treats a failed plugin import as a warning; we don't. */
const PLUGIN_FAILURE = /PluginImportError|Couldn't import the plugin/;

const run = spawnSync(
	'paraglide-js',
	['compile', '--project', PROJECT, '--outdir', OUTDIR],
	// Capture the output so we can inspect it, but keep showing it to the user.
	{ encoding: 'utf8', shell: true },
);

const output = `${run.stdout ?? ''}${run.stderr ?? ''}`;
process.stdout.write(output);

function fail(problem: string, explanation: string): never {
	console.error(`\n✗ paraglide compile produced no usable messages: ${problem}\n`);
	console.error(explanation);
	process.exit(1);
}

if (run.status !== 0) {
	console.error('\n✗ paraglide-js compile exited non-zero.\n');
	process.exit(run.status ?? 1);
}

const settings: Settings = JSON.parse(readFileSync(`${PROJECT}/settings.json`, 'utf8'));

// --- signal 1: a plugin failed to load ---

if (PLUGIN_FAILURE.test(output)) {
	const hosts = [
		...new Set(
			(settings.modules ?? []).filter((m) => m.startsWith('http')).map((m) => new URL(m).host),
		),
	];
	fail(
		'the compiler could not import one or more inlang plugins',
		`Those plugins are fetched at compile time from: ${hosts.join(', ') || '(none)'}\n` +
			`Without them the message files are never parsed, so every m.*() call\n` +
			`resolves to nothing. Restore network access to the host(s) above and re-run.\n` +
			`The compiler reports this as a warning and exits 0 on its own — see the\n` +
			`PluginImportError above for the underlying cause.`,
	);
}

// --- signal 2: nothing was emitted ---

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
