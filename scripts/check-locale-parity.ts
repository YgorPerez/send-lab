// Gate step: every key in the base locale must exist in pt-BR, and vice versa.
//
// Neither Paraglide nor any i18n library catches this — a missing key compiles
// to a message function that falls back silently, so the app renders English at
// an athlete who set pt-BR and nothing anywhere goes red. ADR 0005 and ADR 0006
// both make this a build-time requirement for that reason.
//
// It is also the locale the ADR-0003 bug class only reproduces in: the English
// weekday labels are byte-identical to the stable keys, so a label-as-identifier
// bug is invisible in en-US and only shows up here.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const BASE = 'en-US';
const TARGET = 'pt-BR';

function load(locale: string): Record<string, unknown> {
	const path = fileURLToPath(new URL(`../messages/${locale}.json`, import.meta.url));
	return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
}

const base = load(BASE);
const target = load(TARGET);

// `$schema` is metadata, not a message.
const keys = (o: Record<string, unknown>) => Object.keys(o).filter((k) => !k.startsWith('$'));

const baseKeys = new Set(keys(base));
const targetKeys = new Set(keys(target));

const missingInTarget = [...baseKeys].filter((k) => !targetKeys.has(k));
const missingInBase = [...targetKeys].filter((k) => !baseKeys.has(k));

if (missingInTarget.length || missingInBase.length) {
	if (missingInTarget.length) {
		console.error(`check:i18n — ${missingInTarget.length} key(s) missing from ${TARGET}:`);
		for (const k of missingInTarget.slice(0, 25)) console.error(`  ${k}`);
		if (missingInTarget.length > 25) console.error(`  … and ${missingInTarget.length - 25} more`);
	}
	if (missingInBase.length) {
		console.error(`check:i18n — ${missingInBase.length} key(s) present only in ${TARGET}:`);
		for (const k of missingInBase.slice(0, 25)) console.error(`  ${k}`);
		if (missingInBase.length > 25) console.error(`  … and ${missingInBase.length - 25} more`);
	}
	process.exit(1);
}

console.log(`check:i18n — ok (${baseKeys.size} keys, ${BASE} ↔ ${TARGET} in parity)`);
