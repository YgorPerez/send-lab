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
// and is shown as written; its key is its id.
//
// And what the saved-protocol editor accepts (#104), at the end: the one place
// that decides whether what was typed is a protocol.
import type { Content } from '$lib/content/types';
import { protocolShape, STUDY_TITLE } from '$lib/format';
import {
	asExerciseId,
	type ExerciseId,
	type ProtocolKey,
	presetKey,
	type SavedProtocolId,
	savedProtocolKey,
} from '$lib/ids';
import * as m from '$lib/paraglide/messages';
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

export interface PresetRow {
	/** The preset's identity, and the scope its clock is kept under. */
	key: ProtocolKey;
	exercise: ExerciseId;
	/** Position among the exercise's variants — not renumbered when a variant
	 *  without a protocol is skipped. */
	variant: number;
	/** The variant's name, in the locale. */
	name: string;
	protocol: Protocol;
	/** `6 × 7s/3s · 4 sets`. */
	shape: string;
	/** How long it runs, prepare included, in seconds. */
	total: number;
	/** What a duplicate of it is called until the athlete renames it. */
	copyName: string;
}

/** One of the athlete's saved protocols, ready to list and to run. */
export interface SavedRow {
	/** The scope its clock is kept under — `saved:<id>`. */
	key: ProtocolKey;
	id: SavedProtocolId;
	/** The athlete's name for it, as they wrote it. */
	name: string;
	protocol: Protocol;
	shape: string;
	total: number;
	copyName: string;
}

export interface PresetGroup {
	exercise: ExerciseId;
	/** The exercise's name, in the locale. */
	name: string;
	/** The study the library cites for this exercise, or `null` if none. */
	study: { title: string; url: string } | null;
	presets: PresetRow[];
}

export interface TimerScreen {
	presets: PresetGroup[];
	/** Oldest first, as the record holds them. */
	saved: SavedRow[];
}

/** Everything the Timer screen reads, in the locale it is read in. */
export function resolveTimer(
	content: Content,
	record: Pick<TrainingRecord, 'savedProtocols'>,
	locale: AppLocale,
): TimerScreen {
	const presets: PresetGroup[] = [];
	for (const [id, ex] of Object.entries(content.exercises)) {
		const exercise = asExerciseId(id);
		const rows = ex.variants.flatMap((v, variant): PresetRow[] => {
			const protocol = protocolOf(v);
			if (!protocol) return [];
			return [
				{
					key: presetKey(exercise, variant),
					exercise,
					variant,
					name: v.name,
					protocol,
					shape: protocolShape(protocol, locale),
					total: totalOf(protocol),
					// The exercise as well as the variant: a copy leaves the group that
					// said which exercise "7/3 · 20mm…" was.
					copyName: copyNameOf(`${ex.name} · ${v.name}`, locale),
				},
			];
		});
		if (rows.length)
			presets.push({ exercise, name: ex.name, study: studyFor(id, locale), presets: rows });
	}
	const saved = record.savedProtocols.map(
		(p): SavedRow => ({
			key: savedProtocolKey(p.id),
			id: p.id,
			name: p.name,
			protocol: p.protocol,
			shape: protocolShape(p.protocol, locale),
			total: totalOf(p.protocol),
			copyName: copyNameOf(p.name, locale),
		}),
	);
	return { presets, saved };
}

function copyNameOf(name: string, locale: AppLocale): string {
	return m.timer_copy_name({ name }, { locale });
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
export type FormReading =
	| { ok: true; name: string; protocol: Protocol }
	| { ok: false; refused: (ProtocolField | 'name')[] };

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
 * beside the field rather than by a write that bounces later. The name is
 * trimmed and must be left with something: it is the only way the athlete tells
 * one saved protocol from another in the list.
 */
export function readProtocolForm(form: ProtocolForm): FormReading {
	const refused: (ProtocolField | 'name')[] = [];
	const name = form.name.trim();
	if (!name) refused.push('name');
	const protocol = {} as Protocol;
	for (const f of PROTOCOL_FIELDS) {
		const typed = form.fields[f].trim();
		const value = /^\d+$/.test(typed) ? Number(typed) : Number.NaN;
		if (!(value >= PROTOCOL_MINIMUM[f])) refused.push(f);
		protocol[f] = value;
	}
	return refused.length ? { ok: false, refused } : { ok: true, name, protocol };
}
