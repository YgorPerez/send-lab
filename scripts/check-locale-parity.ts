// Gate step: en-US and pt-BR must carry the same keys, in BOTH places the app
// keeps localized text.
//
// Neither Paraglide nor any i18n library catches this — a missing key compiles
// to a message function that falls back silently, so the app renders English at
// an athlete who set pt-BR and nothing anywhere goes red. ADR 0005 and ADR 0006
// both make this a build-time requirement for that reason.
//
// It is also the locale the ADR-0003 bug class only reproduces in: the English
// weekday labels are byte-identical to the stable keys, so a label-as-identifier
// bug is invisible in en-US and only shows up here.
//
// Three stores, checked separately because they fail differently:
//
//   1. `messages/*.json` — UI chrome, compiled by Paraglide.
//   2. `src/lib/content/{en-US,pt-BR}.ts` — the training library: exercise prose,
//      verdicts, readiness flags, glossary. ~2,200 lines apiece, nested, and
//      until now **completely unguarded**. A flag removed from one locale only
//      would render as a missing verdict for a pt-BR athlete and pass every
//      check. The redesign is judged on a phone in both locales, so this half
//      matters at least as much as the first.
//   3. `src/lib/store/prose.ts` — the athlete-typed text in the seeded scenario
//      (#56). Small, but it is the only free text in the account state, and the
//      app is used in pt-BR, where a dense layout breaks first.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import enContent from '../src/lib/content/en-US.ts';
import ptContent from '../src/lib/content/pt-BR.ts';
import { SEED_PROSE } from '../src/lib/store/prose.ts';

const BASE = 'en-US';
const TARGET = 'pt-BR';

/** Keys under these paths are allowed to differ. `glossary` maps abbreviations,
 *  and the Portuguese ones are genuinely different words — CNS→SNC, FDP→FPD. A
 *  shared key there would be the bug. */
const DIVERGENT_BY_DESIGN = ['glossary'];

const failures: string[] = [];

function report(store: string, missingInTarget: string[], missingInBase: string[]): void {
	for (const [label, list] of [
		[`missing from ${TARGET}`, missingInTarget],
		[`present only in ${TARGET}`, missingInBase],
	] as const) {
		if (!list.length) continue;
		failures.push(`${store}: ${list.length} key(s) ${label}`);
		for (const k of list.slice(0, 25)) failures.push(`    ${k}`);
		if (list.length > 25) failures.push(`    … and ${list.length - 25} more`);
	}
}

// ---- 1. Paraglide messages (flat) ----
function loadMessages(locale: string): Record<string, unknown> {
	const path = fileURLToPath(new URL(`../messages/${locale}.json`, import.meta.url));
	return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
}

// `$schema` is metadata, not a message.
const msgBase = new Set(Object.keys(loadMessages(BASE)).filter((k) => !k.startsWith('$')));
const msgTarget = new Set(Object.keys(loadMessages(TARGET)).filter((k) => !k.startsWith('$')));

report(
	'messages',
	[...msgBase].filter((k) => !msgTarget.has(k)),
	[...msgTarget].filter((k) => !msgBase.has(k)),
);

// ---- 2. Training content (nested) ----
function paths(value: unknown, prefix = ''): string[] {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) return [];
	const out: string[] = [];
	for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
		const path = prefix ? `${prefix}.${key}` : key;
		if (DIVERGENT_BY_DESIGN.includes(path.split('.')[0] as string) && path.includes('.')) continue;
		out.push(path);
		out.push(...paths(child, path));
	}
	return out;
}

const contentBase = new Set(paths(enContent));
const contentTarget = new Set(paths(ptContent));

report(
	'content',
	[...contentBase].filter((k) => !contentTarget.has(k)),
	[...contentTarget].filter((k) => !contentBase.has(k)),
);

// ---- 3. Prototype fixture prose (flat, per locale) ----
const fxBase = new Set(Object.keys(SEED_PROSE[BASE] ?? {}));
const fxTarget = new Set(Object.keys(SEED_PROSE[TARGET] ?? {}));

report(
	'fixtures',
	[...fxBase].filter((k) => !fxTarget.has(k)),
	[...fxTarget].filter((k) => !fxBase.has(k)),
);

if (failures.length) {
	console.error('check:i18n — locale parity broken:\n');
	for (const line of failures) console.error(`  ${line}`);
	process.exit(1);
}

console.log(
	`check:i18n — ok (${msgBase.size} message keys, ${contentBase.size} content keys, ${fxBase.size} fixture keys, ${BASE} ↔ ${TARGET} in parity)`,
);
