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
import type { Content } from '$lib/content/types';
import { protocolShape, STUDY_TITLE } from '$lib/format';
import { asExerciseId, type ExerciseId, type ProtocolKey, presetKey } from '$lib/ids';
import { studyOf } from '$lib/progression';
import { type Protocol, protocolOf, totalOf } from '$lib/protocol';
import type { AppLocale } from '$lib/store/locale';
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
}

/** Everything the Timer screen reads, in the locale it is read in. */
export function resolveTimer(content: Content, locale: AppLocale): TimerScreen {
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
				},
			];
		});
		if (rows.length)
			presets.push({ exercise, name: ex.name, study: studyFor(id, locale), presets: rows });
	}
	return { presets };
}

function studyFor(exercise: string, locale: AppLocale): PresetGroup['study'] {
	const id = studyOf(exercise);
	const url = id ? STUDIES.find((s) => s.id === id)?.url : undefined;
	return id && url ? { title: STUDY_TITLE[id]({}, { locale }), url } : null;
}
