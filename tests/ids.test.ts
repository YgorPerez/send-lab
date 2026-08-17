// The identity module, and the gate that keeps it the only door.
//
// The behaviour tests below matter less than the last one. A brand is only worth
// having while the constructors are the only way to mint one, and TypeScript
// always leaves a type assertion open — `m.mon() as WeekdayKey` compiles, is one
// keystroke away from convenient, and quietly reopens the entire bug class
// ADR-0003 exists to close. #20 called for exactly this check when it made
// branded ids mandatory.
import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative, sep } from 'node:path';
import { describe, expect, test } from 'vitest';
import {
	asAthleteId,
	asExerciseId,
	asWeekdayKey,
	asWeekId,
	parseAthleteId,
	parseTaskKey,
	parseWeekdayKey,
	parseWeekId,
	taskKey,
	WEEKDAY_KEYS,
	weekdayKeyOf,
	weekNumberOf,
} from '../src/lib/ids.ts';

describe('weekday keys', () => {
	test('accepts the seven stable keys', () => {
		for (const key of WEEKDAY_KEYS) expect(asWeekdayKey(key)).toBe(key);
	});

	// The one that matters. A pt-BR label failing is table stakes; the English
	// label failing is the whole reason this is a brand and not a union, because
	// `m.mon()` returns exactly the string `'Mon'` in the base locale.
	test('rejects localized weekday labels in both locales', () => {
		for (const label of ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']) {
			expect(() => asWeekdayKey(label)).toThrow(/not a weekday key/);
			expect(parseWeekdayKey(label)).toBeNull();
		}
		// English labels differ from the keys only in case, which is the closest a
		// label ever gets to a key — and still not one.
		for (const label of ['monday', 'MON', 'Monday']) {
			expect(() => asWeekdayKey(label)).toThrow(/not a weekday key/);
		}
	});

	test('reads the weekday of a local ISO date', () => {
		// 2026-08-13 is a Thursday; the fixtures pin the same date.
		expect(weekdayKeyOf('2026-08-13')).toBe('Thu');
		expect(weekdayKeyOf('2026-08-16')).toBe('Sun');
		expect(weekdayKeyOf('2026-08-17')).toBe('Mon');
	});
});

describe('week ids', () => {
	test('round-trips a week number', () => {
		expect(asWeekId(1)).toBe('w1');
		expect(weekNumberOf(asWeekId(12))).toBe(12);
	});

	test('rejects a week that is not numbered from 1', () => {
		expect(() => asWeekId(0)).toThrow();
		expect(() => asWeekId(-3)).toThrow();
		expect(() => asWeekId(2.5)).toThrow();
		expect(parseWeekId('w0')).toBeNull();
		expect(parseWeekId('1')).toBeNull();
		expect(parseWeekId('week1')).toBeNull();
	});
});

describe('task keys', () => {
	const week = asWeekId(1);
	const weekday = asWeekdayKey('Tue');
	const exercise = asExerciseId('pinch');

	test('builds the shape ADR-0001 keys completion by', () => {
		expect(taskKey(week, weekday, exercise)).toBe('w1-Tue:pinch');
	});

	test('round-trips back to its three identities', () => {
		expect(parseTaskKey(taskKey(week, weekday, exercise))).toEqual({ week, weekday, exercise });
	});

	// Exercise ids carry hyphens (`half-crimp-repeaters`), so splitting on the
	// first `-` would tear the slot apart. The separator search has to run from
	// the right of the slot, and this is the case that proves it does.
	test('survives an exercise id containing the separators', () => {
		const hyphenated = asExerciseId('one-arm-lockoff');
		const parsed = parseTaskKey(taskKey(asWeekId(3), asWeekdayKey('Sat'), hyphenated));
		expect(parsed).toEqual({
			week: 'w3',
			weekday: 'Sat',
			exercise: 'one-arm-lockoff',
		});
	});

	test('rejects a key that is not one', () => {
		expect(parseTaskKey('w1-Tue')).toBeNull();
		expect(parseTaskKey('w1-Seg:pinch')).toBeNull();
		expect(parseTaskKey('Tue:pinch')).toBeNull();
		expect(parseTaskKey('w1-Tue:')).toBeNull();
		expect(parseTaskKey(undefined)).toBeNull();
	});
});

describe('athlete ids', () => {
	test('vouches for a non-empty id and refuses an empty one', () => {
		expect(asAthleteId('abc123')).toBe('abc123');
		expect(() => asAthleteId('')).toThrow();
		expect(parseAthleteId('')).toBeNull();
		expect(parseAthleteId(42)).toBeNull();
	});
});

describe('the constructors are the only door', () => {
	// `process.cwd()`, not `import.meta.url`: the unit project runs in jsdom,
	// where `import.meta.url` is an `http://localhost` URL and `fileURLToPath`
	// refuses it. Vitest's cwd is the repo root.
	const root = join(process.cwd(), 'src');
	const OWNER = join(root, 'lib', 'ids.ts');

	/** Every hand-written source file under `src/`, generated output excluded. */
	function sourceFiles(dir: string, out: string[] = []): string[] {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const full = join(dir, entry.name);
			if (entry.isDirectory()) {
				// Paraglide's compiler owns `lib/paraglide`; `routeTree.gen.ts` is the
				// router CLI's. Neither is edited by hand, and neither mints an id.
				if (entry.name === 'paraglide') continue;
				sourceFiles(full, out);
			} else if (['.ts', '.tsx'].includes(extname(entry.name)) && !entry.name.endsWith('.gen.ts')) {
				out.push(full);
			}
		}
		return out;
	}

	const BRANDS = ['AthleteId', 'WeekId', 'WeekdayKey', 'ExerciseId', 'TaskKey'].join('|');
	// `as WeekdayKey` and `as unknown as TaskKey`.
	//
	// The angle-bracket cast (`<ExerciseId>raw`) is deliberately **not** matched.
	// The first version of this scan did match it and immediately failed on
	// `heldSet: ReadonlySet<ExerciseId>` — a type argument, not a cast. There is no
	// way to tell the two apart with a regex, and nothing is lost: `.tsx` reserves
	// `<T>` for JSX and cannot spell that cast at all, and every `.ts` file in
	// `src/` is compiled under the same `jsx` setting. `as` is the only spelling
	// that reaches this tree.
	//
	// Caught by running the check rather than by reading it — the same way the
	// contrast checker's first version was found to be reporting "ok" over a
	// screen that had crashed.
	const ASSERTION = new RegExp(String.raw`\bas\s+(?:unknown\s+as\s+)?(?:${BRANDS})\b`, 'g');

	test('no file outside lib/ids.ts asserts its way to a branded id', () => {
		const offenders: string[] = [];
		for (const file of sourceFiles(root)) {
			if (file === OWNER) continue;
			const source = readFileSync(file, 'utf8');
			for (const match of source.matchAll(ASSERTION)) {
				const line = source.slice(0, match.index).split('\n').length;
				offenders.push(`${relative(root, file).split(sep).join('/')}:${line} — ${match[0]}`);
			}
		}
		expect(
			offenders,
			'Mint identities through lib/ids.ts. A type assertion accepts a localized ' +
				'label, which is the bug ADR-0003 closed and this brand exists to keep closed.',
		).toEqual([]);
	});

	// The check above is worthless if its pattern has rotted, so it is tested
	// against strings it must match — and, just as importantly, against the
	// generic type arguments it must not.
	test('the scan recognises every spelling it claims to, and nothing else', () => {
		for (const asserted of [
			'const d = label as WeekdayKey;',
			'const k = value as unknown as TaskKey;',
			'const a = id as AthleteId;',
			'const w = s as WeekId;',
			'const list = raw as ExerciseId[];',
		]) {
			expect(asserted).toMatch(new RegExp(ASSERTION.source));
		}
		for (const innocent of [
			'const n = value as number;',
			'heldSet: ReadonlySet<ExerciseId>;',
			'done: Record<TaskKey, boolean>;',
			'function f(id: ExerciseId) {}',
			'const alias = ids as unknown;',
		]) {
			expect(innocent).not.toMatch(new RegExp(ASSERTION.source));
		}
	});
});
