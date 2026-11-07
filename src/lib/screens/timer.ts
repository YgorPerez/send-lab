// What the Timer screen reads (#101).
//
// The presets: every library variant that carries a protocol, as a protocol the
// athlete can run without typing a number. They are **computed here, at read
// time, and never stored** — a preset is the library's, so a copy of it in the
// training record would be a second place its numbers live, and the first one to
// drift. Nothing reaches the record until the athlete duplicates one (#103).
//
// Grouped by exercise, in the library's own order, because that is how the
// library cites them: the study is the exercise's, and every variant of it runs
// that method (`studyOf`).
//
// The names are produced now, from the content for this locale, and nothing
// here is an identity: a preset is addressed by its `ProtocolKey`, which is the
// variant (ADR 0003, ADR 0012).
//
// Then the athlete's **saved protocols** (#103), from the training record, in
// the order they were made. A saved protocol's name is the athlete's own text
// and is shown as written; its key is its id. The name is optional (#112): one
// without is listed under its shape, read here in the locale and never stored,
// so the list still has a name to show for every row.
//
// And what the saved-protocol editor accepts (#104), at the end: the one place
// that decides whether what was typed is a protocol.
import type { Content } from '$lib/content/types';
import { isoDayOf } from '$lib/dates';
import { protocolShape, STUDY_TITLE, shortTime } from '$lib/format';
import {
	asExerciseId,
	type ExerciseId,
	type ProtocolKey,
	presetKey,
	type SavedProtocolId,
	savedProtocolKey,
	weekdayKeyOf,
} from '$lib/ids';
import { type ResolverState, trainableExerciseIds } from '$lib/prescription';
import { studyOf } from '$lib/progression';
import {
	PROTOCOL_FIELDS,
	PROTOCOL_MINIMUM,
	type Protocol,
	type ProtocolField,
	protocolOf,
	totalOf,
} from '$lib/protocol';
import type { AppLocale } from '$lib/store/locale';
import type { TrainingRecord } from '$lib/store/record';
import { STUDIES } from '$lib/studies';
import type { NamedProtocol } from '$lib/types';

/**
 * Anything the Timer screen lists and the clock can run, ready to show: a
 * preset or a saved protocol. Not a "row": that word is the store's, for what is
 * persisted, and a preset never is.
 */
export interface ProtocolListing extends NamedProtocol {
	/** Its identity, and the scope its clock's draft is kept under — the
	 *  variant's `preset:` key, or the saved protocol's `saved:<id>`. */
	key: ProtocolKey;
	/** What the clock's strip is named: a saved protocol's own name, a preset's
	 *  exercise and variant, since the group heading it sat under is not on the
	 *  strip. */
	label: string;
	/** `6 × 7s/3s · 4 sets`. */
	shape: string;
	/** How long it runs, prepare included, in seconds. */
	total: number;
	/** What a duplicate of it is called until the athlete renames it (#112):
	 *  its own name, a preset's without the exercise in front, numbered `(2)`,
	 *  `(3)`… past the saved protocols already called that. Empty for a copy of
	 *  an unnamed one, which is unnamed too. */
	copyName: string;
	/** Whether `name` is the athlete's or a preset's, rather than the shape an
	 *  unnamed saved protocol is listed under (#112). The editor opens an unnamed
	 *  one with its name empty, not filled in with its shape. */
	named: boolean;
}

/** A library variant's protocol, offered as it is. `name` is the variant's, in
 *  the locale. */
export interface PresetListing extends ProtocolListing {
	exercise: ExerciseId;
	/** Position among the exercise's variants — not renumbered when a variant
	 *  without a protocol is skipped. */
	variant: number;
}

/** One of the athlete's saved protocols. `name` is theirs, as they wrote it. */
export interface SavedProtocolListing extends ProtocolListing {
	id: SavedProtocolId;
}

export interface PresetGroup {
	exercise: ExerciseId;
	/** The exercise's name, in the locale. */
	name: string;
	/** The study the library cites for this exercise, or `null` if none. */
	study: { title: string; url: string } | null;
	presets: PresetListing[];
}

export interface TimerScreen {
	presets: PresetGroup[];
	/** Oldest first, as the record holds them. */
	saved: SavedProtocolListing[];
	/** Everything the clock can run, in the order the screen lists it: saved
	 *  first, then every preset group's, so "the first one" is the one at the
	 *  top. */
	runnable: ProtocolListing[];
}

/** Everything the Timer screen reads, in the locale it is read in. */
export function resolveTimer(
	content: Content,
	record: Pick<TrainingRecord, 'savedProtocols'>,
	locale: AppLocale,
): TimerScreen {
	const taken = new Set(record.savedProtocols.map((p) => p.name));
	const presets: PresetGroup[] = [];
	for (const [id, ex] of Object.entries(content.exercises)) {
		const exercise = asExerciseId(id);
		const rows = ex.variants.flatMap((v, variant): PresetListing[] => {
			const protocol = protocolOf(v);
			if (!protocol) return [];
			// The exercise as well as the variant: the strip leaves the group that
			// said which exercise "7/3 · 20mm…" was. A copy does not need it — it is
			// listed among the athlete's own, and the exercise made it too long to
			// sit on one line (#112).
			const label = `${ex.name} · ${v.name}`;
			return [
				{
					key: presetKey(exercise, variant),
					exercise,
					variant,
					name: v.name,
					label,
					protocol,
					shape: protocolShape(protocol, locale),
					total: totalOf(protocol),
					copyName: copyNameOf(v.name, taken),
					named: true,
				},
			];
		});
		if (rows.length)
			presets.push({ exercise, name: ex.name, study: studyFor(id, locale), presets: rows });
	}
	const saved = record.savedProtocols.map((p): SavedProtocolListing => {
		const shape = protocolShape(p.protocol, locale);
		const name = p.name || shape;
		return {
			key: savedProtocolKey(p.id),
			id: p.id,
			name,
			label: name,
			protocol: p.protocol,
			shape,
			total: totalOf(p.protocol),
			copyName: copyNameOf(p.name, taken),
			named: p.name !== '',
		};
	});
	return { presets, saved, runnable: [...saved, ...presets.flatMap((g) => g.presets)] };
}

/**
 * The preset groups the Timer screen opens by default (#119): today's, the
 * exercises the plan schedules today that the library has a protocol for, in
 * the list's order. None on a rest day. Every other group waits for a tap, so
 * twenty-four presets are nine lines with the ones the session needs already
 * open.
 */
export function todaysPresetGroups(
	screen: Pick<TimerScreen, 'presets'>,
	content: Content,
	record: ResolverState,
	now: number,
): ExerciseId[] {
	const today = new Set(
		trainableExerciseIds(content, record, record.currentWeek, weekdayKeyOf(isoDayOf(now))),
	);
	return screen.presets.flatMap((g) => (today.has(g.exercise) ? [g.exercise] : []));
}

/**
 * What a copy of something called `name` is called: the name, or — when a saved
 * protocol already has it — the name numbered with the first free `(2)`, `(3)`…
 * A copy of a copy counts on from the name it was numbered after, so copying
 * "Tabata (2)" makes "Tabata (3)", not "Tabata (2) (2)". Unnamed stays unnamed.
 */
function copyNameOf(name: string, taken: ReadonlySet<string>): string {
	if (!name || !taken.has(name)) return name;
	const base = name.replace(/ \(\d+\)$/, '');
	let n = 2;
	while (taken.has(`${base} (${n})`)) n++;
	return `${base} (${n})`;
}

function studyFor(exercise: string, locale: AppLocale): PresetGroup['study'] {
	const id = studyOf(exercise);
	const url = id ? STUDIES.find((s) => s.id === id)?.url : undefined;
	return id && url ? { title: STUDY_TITLE[id]({}, { locale }), url } : null;
}

/** What the saved-protocol editor holds: what was typed, as typed. Text rather
 *  than numbers, because a field mid-edit is often not a number yet — empty, or
 *  a lone minus — and turning it into one on every keystroke is how a `0`
 *  appears under the athlete's cursor while they are clearing the field. */
export interface ProtocolForm {
	name: string;
	fields: Record<ProtocolField, string>;
}

/** What the form says, read: a protocol to save, or the fields that stop it. */
export type FormReading = ({ ok: true } & NamedProtocol) | { ok: false; refused: ProtocolField[] };

/** The editor opened on a protocol — the one being edited, or a blank one's
 *  starting numbers. */
export function formOf(name: string, protocol: Protocol): ProtocolForm {
	const fields = {} as Record<ProtocolField, string>;
	for (const f of PROTOCOL_FIELDS) fields[f] = String(protocol[f]);
	return { name, fields };
}

/**
 * The form, read as a saved protocol, or every field that stops it being one.
 *
 * Each field is whole and at least its minimum (`PROTOCOL_MINIMUM`): an effort,
 * a round and a set at least, and no negative seconds — the protocol the
 * server's row schema will accept, refused here first so the athlete is told
 * beside the field rather than by a write that bounces later.
 *
 * The name is trimmed and may be left empty (#112): a protocol with no name is
 * listed under its shape (`resolveTimer`), so it is never what stops a save.
 */
export function readProtocolForm(form: ProtocolForm): FormReading {
	const refused: ProtocolField[] = [];
	const protocol = {} as Protocol;
	for (const f of PROTOCOL_FIELDS) {
		if (!runs(f, form.fields[f])) refused.push(f);
		protocol[f] = typedValue(f, form.fields[f]);
	}
	if (refused.length) return { ok: false, refused };
	return { ok: true, name: form.name.trim(), protocol };
}

/** The counts, as against the seconds: never typed as a time, and refused as a
 *  number rather than as seconds. */
export const COUNTS: ReadonlySet<ProtocolField> = new Set(['rounds', 'sets']);

/**
 * What a field's text says as a number, or `NaN` when it is not a whole one.
 * A time may also be typed as `m:ss` (#112), the way the editor shows one from a
 * minute up; a count may not.
 */
export function typedValue(f: ProtocolField, text: string): number {
	const typed = text.trim();
	if (/^\d+$/.test(typed)) return Number(typed);
	const clock = COUNTS.has(f) ? null : /^(\d+):([0-5]\d)$/.exec(typed);
	return clock ? Number(clock[1]) * 60 + Number(clock[2]) : Number.NaN;
}

/** Whether a field's text is a number the clock can run: whole, and at least the
 *  field's minimum (`PROTOCOL_MINIMUM`). What the editor refuses and what Train's
 *  Adjust hands the clock are this one rule. */
export function runs(f: ProtocolField, text: string): boolean {
	return typedValue(f, text) >= PROTOCOL_MINIMUM[f];
}

/**
 * A field after one press of its − or + (#112), as text for the form.
 *
 * A count steps by one. A time steps by more the longer it is — 1s up to 30s,
 * 5s up to two minutes, 15s above — because a hang is counted in seconds and a
 * set rest in minutes, and both are set with the same two buttons. A step lands
 * on its own grid (`33` goes up to `35`, down to `30`), and a step down from a
 * boundary takes the finer step below it, so one back undoes one forward.
 *
 * Never below the field's minimum; a field that is not a number goes back to it.
 */
export function nudged(f: ProtocolField, text: string, by: 1 | -1): string {
	const min = PROTOCOL_MINIMUM[f];
	const value = typedValue(f, text);
	if (!(value >= min)) return String(min);
	const step = COUNTS.has(f) ? 1 : stepAt(by > 0 ? value : value - 1);
	const next =
		by > 0 ? Math.floor(value / step) * step + step : Math.ceil(value / step) * step - step;
	return String(Math.max(min, next));
}

/** The step a time takes from where it is: 1s under 30s, 5s under two minutes,
 *  15s from there. */
function stepAt(seconds: number): number {
	return seconds < 30 ? 1 : seconds < 120 ? 5 : 15;
}

/**
 * A field's value as its row shows it while it is not being typed (#112): a
 * time from a minute up as `m:ss`, under it in seconds (`10s`), a count as the
 * number. Text that is not a number is shown as typed, so the athlete sees what
 * the refusal beside it is about.
 */
export function shownOf(f: ProtocolField, text: string): string {
	const value = typedValue(f, text);
	if (Number.isNaN(value)) return text;
	return COUNTS.has(f) ? String(value) : shortTime(value);
}
