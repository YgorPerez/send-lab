// Lazy in-place migrations for the per-user state document. Every hydration path
// (server fetch, offline cache, guest cache, backup import) runs through
// migrateState, so old documents are upgraded on next load and written back by
// the normal debounced persistence — no server-side backfill needed.
//
// Each step must be idempotent: it runs on every load, including already-migrated
// documents. Legacy and current values are always drawn from disjoint sets so a
// step can tell them apart (weekday keys vs day-type ids, localized labels vs
// weekday keys).
//
// TODO(#55): this whole module may be dead in the rebuild, and is certainly stale.
// It upgrades *legacy* documents, and #11's Out of scope rules that no accounts or
// training history are ported — the rebuild starts clean — which is the same
// reasoning that deleted the `date`/`today()` fallbacks in #55. It is also now
// out of step with the entity types: `migrateProgramTemplate` writes `entry.dayKey`,
// and the field is `dayType`, so nothing reads what it produces. Decide whether it
// is deleted outright or rewritten against the current shapes; do not assume the
// tests passing means it still does anything.
import enUS from './content/en-US';
import ptBR from './content/pt-BR';
import type { DayTypeId } from './content/types';
import { isPlainObject as isObj } from './objects';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Weekday key → the day-type id that weekday runs in the built-in week. The
 *  mapping legacy documents implied by storing a weekday key as a protocol. */
const DAY_TYPE_BY_WEEKDAY: Record<string, DayTypeId> = Object.fromEntries(
	enUS.days.map((d) => [d.k, d.id]),
);

/** Default exercise ids per day type (language-neutral). */
const EX_BY_DAY_TYPE: Record<string, string[]> = Object.fromEntries(
	enUS.days.map((d) => [d.id, d.ex]),
);

/** Localized weekday label → weekday key, across *every* locale. Sessions used to
 *  store the translated label, so a backfill has to read both label sets — the
 *  athlete's rows are in whichever language they were using at the time. */
const WEEKDAY_BY_LABEL: Record<string, string> = Object.fromEntries([
	...WEEKDAYS.map((k) => [k, k]),
	...enUS.days.map((d) => [d.label, d.k]),
	...ptBR.days.map((d) => [d.label, d.k]),
]);

const isLegacyDayKey = (v: unknown): v is string =>
	typeof v === 'string' && WEEKDAYS.includes(v) && DAY_TYPE_BY_WEEKDAY[v] !== undefined;

/** ADR-0002: per-slot protocol overrides stored another weekday's key; they now
 *  store a day-type id. */
function migrateDayPlan(raw: unknown): Record<string, string> | undefined {
	if (!isObj(raw)) return undefined;
	const out: Record<string, string> = {};
	for (const [slot, v] of Object.entries(raw)) {
		if (isLegacyDayKey(v)) out[slot] = DAY_TYPE_BY_WEEKDAY[v];
		else if (typeof v === 'string') out[slot] = v;
	}
	return out;
}

/** ADR-0002: a program template's dayKey was a weekday key; it's now a day-type id. */
function migrateProgramTemplate(program: unknown): void {
	if (!isObj(program) || !isObj(program.template)) return;
	for (const entry of Object.values(program.template)) {
		if (isObj(entry) && isLegacyDayKey(entry.dayKey)) {
			entry.dayKey = DAY_TYPE_BY_WEEKDAY[entry.dayKey];
		}
	}
}

/** ADR-0003: sessions identified their slot by the *localized* weekday label, so
 *  a language switch orphaned them. They now store the stable weekday key. */
function migrateWorkouts(raw: unknown): void {
	if (!Array.isArray(raw)) return;
	for (const w of raw) {
		if (!isObj(w) || typeof w.day !== 'string') continue;
		const key = WEEKDAY_BY_LABEL[w.day];
		if (key) w.day = key;
	}
}

/** The exercise ids a slot resolved to, mirroring the app's override precedence.
 *  Used to express a legacy slot-level completion tick as per-task completion. */
function slotExercises(data: Record<string, unknown>, slot: string, weekday: string): string[] {
	const dayExercises = isObj(data.dayExercises) ? data.dayExercises : {};
	const perSlot = dayExercises[slot];
	if (Array.isArray(perSlot)) return perSlot.filter((id): id is string => typeof id === 'string');

	const program = isObj(data.program) ? data.program : {};
	const template = isObj(program.template) ? program.template : {};
	const entry = isObj(template[weekday]) ? (template[weekday] as Record<string, unknown>) : {};
	if (Array.isArray(entry.ex)) return entry.ex.filter((id): id is string => typeof id === 'string');

	const dayPlan = isObj(data.dayPlan) ? data.dayPlan : {};
	const typeId =
		(typeof dayPlan[slot] === 'string' ? (dayPlan[slot] as string) : undefined) ??
		(typeof entry.dayKey === 'string' ? entry.dayKey : undefined) ??
		DAY_TYPE_BY_WEEKDAY[weekday];
	return EX_BY_DAY_TYPE[typeId] ?? [];
}

/** ADR-0001: a slot-level "mark done" tick lived in its own map that nothing read,
 *  so it earned no adherence credit and the work was still offered as missed. Each
 *  tick becomes per-task completion for that slot's exercises, which is what
 *  adherence and carry-forward both read. Runs after the day-type migrations so
 *  slot exercises resolve against day-type ids. */
function migrateCompleted(data: Record<string, unknown>): void {
	const completed = data.completed;
	if (!isObj(completed)) return;
	const taskDone = isObj(data.taskDone) ? { ...data.taskDone } : {};
	for (const [slot, done] of Object.entries(completed)) {
		if (!done) continue;
		const weekday = slot.slice(slot.indexOf('-') + 1);
		if (!WEEKDAYS.includes(weekday)) continue;
		for (const exId of slotExercises(data, slot, weekday)) {
			if (exId === 'rest') continue;
			taskDone[`${slot}:${exId}`] = true;
		}
	}
	data.taskDone = taskDone;
	delete data.completed;
}

/** Upgrade a raw state document in place. Safe to call on any document — current,
 *  legacy, partial, or empty. */
export function migrateState<T>(data: T): T {
	if (!isObj(data)) return data;
	const doc = data as Record<string, unknown>;
	const plan = migrateDayPlan(doc.dayPlan);
	if (plan) doc.dayPlan = plan;
	migrateProgramTemplate(doc.program);
	if (Array.isArray(doc.savedPrograms)) {
		for (const s of doc.savedPrograms) if (isObj(s)) migrateProgramTemplate(s.program);
	}
	if (isObj(doc.rehab)) migrateProgramTemplate(doc.rehab.previous);
	migrateWorkouts(doc.workouts);
	migrateCompleted(doc);
	return data;
}
