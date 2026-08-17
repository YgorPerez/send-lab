// The identities that flow through props, and the only place they are minted.
//
// WHY A BRAND AND NOT A LITERAL UNION
// -----------------------------------
// `type WeekdayKey = 'Mon' | 'Tue' | ...` looks sufficient and is not. A pt-BR
// label (`'Seg'`) is rejected, so it appears to work — but the *English* label
// `'Mon'` is a member of that union, so `taskDone[m.mon()]` compiles and the bug
// stays invisible in the base locale. That is the whole failure mode ADR-0003 is
// about: the English weekday labels are byte-identical to the stable keys. A
// literal union cannot tell *the key `Mon`* from *the English word for Monday*.
// Only a brand can, because Paraglide's `m.mon()` returns plain `string`.
//
// Mandated by the rebuild's quality gates (#20) and made the path of least
// resistance by the component vocabulary (#53): every component prop that
// carries an identity carries a branded one, so passing a label is a compile
// error rather than a screen that renders correctly in English.
//
// THE BRAND IS A PRIVATE SYMBOL
// -----------------------------
// #20 sketched `string & { readonly __brand: 'WeekdayKey' }`. A private `unique
// symbol` is used instead: `__brand` is a spellable property, so any object
// literal or hand-written interface elsewhere can satisfy it and quietly mint an
// identity. The symbol below is not exported and cannot be named outside this
// module, which leaves the constructors here as the only door — with a type
// assertion (`x as WeekdayKey`) as the one way around them, and `tests/ids.test.ts`
// asserts that no file outside this one writes such an assertion.
//
// NAMING: `WeekdayKey`, NOT #20's `DayKey`
// ----------------------------------------
// ADR-0002 removed exactly one overload: `"Mon"` used to name both
// Monday-the-calendar-position and Limit/Power-the-protocol. Day types now have
// their own ids and `DayTypeId` already exists as a closed literal union in
// `lib/content/types.ts`. A brand called `DayKey` sitting beside it reads as
// "the key of a day type" and reopens the overload at the type level, so the
// weekday key is named for what it is. `CONTEXT.md` calls the pairing of a
// weekday with a training week a **slot**; a weekday alone is calendar position
// and has no glossary term of its own.

declare const IDENTITY: unique symbol;

/** A `string` that has been checked, or vouched for, as the identity it names. */
type Identity<Name extends string> = string & { readonly [IDENTITY]: Name };

/** The account that owns one athlete's training record. */
export type AthleteId = Identity<'AthleteId'>;

/** One training week inside the block, `w1`-shaped and numbered from 1. */
export type WeekId = Identity<'WeekId'>;

/** Calendar position within a week: `Mon`..`Sun`, never a localized label. */
export type WeekdayKey = Identity<'WeekdayKey'>;

/** A movement in the app's exercise library. Keys `content.exercises`. */
export type ExerciseId = Identity<'ExerciseId'>;

/**
 * One exercise as it appears in one slot — the unit the athlete ticks off, and
 * the key of the `taskDone` record that ADR-0001 makes the source of truth for
 * whether a slot was trained. Shaped `w1-Tue:pinch`.
 */
export type TaskKey = Identity<'TaskKey'>;

/** The seven weekday keys, in ISO week order. */
export const WEEKDAY_KEYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

const WEEKDAY_SET: ReadonlySet<string> = new Set(WEEKDAY_KEYS);

/** `Date.getDay()` is Sunday-first; `WEEKDAY_KEYS` is Monday-first. */
const BY_DAY_INDEX = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

// ------------------------------------------------------------------ weekday

/**
 * A weekday key, checked against the closed set.
 *
 * It throws rather than coercing, and that is the point: the closed set is small
 * enough to validate, so a localized label reaching here fails loudly at runtime
 * in *either* locale — including the English one, where `'Mon'` would otherwise
 * sail through and take the bug back into hiding.
 */
export function asWeekdayKey(value: string): WeekdayKey {
	if (!WEEKDAY_SET.has(value)) {
		throw new Error(
			`"${value}" is not a weekday key. Expected one of ${WEEKDAY_KEYS.join(', ')} — ` +
				'a localized weekday label is never an identity (ADR-0003).',
		);
	}
	return value as WeekdayKey;
}

/** A weekday key from untrusted input (stored JSON, a query string), or `null`. */
export function parseWeekdayKey(value: unknown): WeekdayKey | null {
	return typeof value === 'string' && WEEKDAY_SET.has(value) ? (value as WeekdayKey) : null;
}

/** The weekday of a local ISO calendar date (`YYYY-MM-DD`). */
export function weekdayKeyOf(iso: string): WeekdayKey {
	const [y, m, d] = iso.split('-').map(Number);
	const index = new Date(y, m - 1, d).getDay();
	const key = BY_DAY_INDEX[index];
	if (!key) throw new Error(`"${iso}" is not an ISO calendar date`);
	return key as WeekdayKey;
}

// --------------------------------------------------------------------- week

const WEEK_PATTERN = /^w([1-9]\d*)$/;

/** The id of training week `n`, numbered from 1 within the block. */
export function asWeekId(n: number): WeekId {
	if (!Number.isInteger(n) || n < 1) {
		throw new Error(`Training weeks are numbered from 1 within the block; got ${n}`);
	}
	return `w${n}` as WeekId;
}

/** A week id from untrusted input, or `null`. */
export function parseWeekId(value: unknown): WeekId | null {
	return typeof value === 'string' && WEEK_PATTERN.test(value) ? (value as WeekId) : null;
}

/** The week number behind a week id — for `m.week_label({ n })` and ordering. */
export function weekNumberOf(id: WeekId): number {
	const match = WEEK_PATTERN.exec(id);
	if (!match) throw new Error(`"${id}" is not a week id`);
	return Number(match[1]);
}

// ----------------------------------------------------------------- exercise

/**
 * An exercise id.
 *
 * Vouched for rather than checked: the set is the exercise library, which this
 * module deliberately does not import — `lib/content` resolves localized content
 * and pulling it in here would make the identity module locale-aware, which is
 * the inversion ADR-0003 warns about. The library lookup *is* the validation:
 * `content.exercises[id]` is `undefined` for an id that does not exist, and every
 * caller already has to handle that.
 */
export function asExerciseId(value: string): ExerciseId {
	if (value === '') throw new Error('An exercise id is never empty');
	return value as ExerciseId;
}

/** An exercise id from untrusted input, or `null`. */
export function parseExerciseId(value: unknown): ExerciseId | null {
	return typeof value === 'string' && value !== '' ? (value as ExerciseId) : null;
}

// --------------------------------------------------------------------- task

/**
 * The key of one task: this exercise, in this slot.
 *
 * Built rather than concatenated at the call site. That is what keeps the shape
 * in one place, and it is why the components never see the `-` and `:` — a
 * screen that formats its own key is a screen that can format it wrong in one
 * place and right in nine others.
 */
export function taskKey(week: WeekId, weekday: WeekdayKey, exercise: ExerciseId): TaskKey {
	return `${week}-${weekday}:${exercise}` as TaskKey;
}

export interface TaskParts {
	week: WeekId;
	weekday: WeekdayKey;
	exercise: ExerciseId;
}

/** The three identities inside a task key, or `null` if it is not one. */
export function parseTaskKey(value: unknown): TaskParts | null {
	if (typeof value !== 'string') return null;
	const separator = value.indexOf(':');
	if (separator < 0) return null;
	const slot = value.slice(0, separator);
	const exercise = parseExerciseId(value.slice(separator + 1));
	const dash = slot.lastIndexOf('-');
	if (dash < 0 || !exercise) return null;
	const week = parseWeekId(slot.slice(0, dash));
	const weekday = parseWeekdayKey(slot.slice(dash + 1));
	return week && weekday ? { week, weekday, exercise } : null;
}

// ------------------------------------------------------------------ athlete

/**
 * The signed-in account's athlete.
 *
 * Vouched for: the id is minted by the auth provider and read back from the
 * session, so there is no local set to check it against. It is branded anyway,
 * because it is the boundary between two athletes' records on a shared device
 * (`CONTEXT.md`, *Account*) and that is not a boundary to hold with a bare
 * `string`.
 */
export function asAthleteId(value: string): AthleteId {
	if (value === '') throw new Error('An athlete id is never empty');
	return value as AthleteId;
}

/** An athlete id from untrusted input, or `null`. */
export function parseAthleteId(value: unknown): AthleteId | null {
	return typeof value === 'string' && value !== '' ? (value as AthleteId) : null;
}
