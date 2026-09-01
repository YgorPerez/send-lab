// What Log reads.
//
// The history, as rows: every readiness check with the answers that produced it,
// and every session with the sets that were actually logged.
//
// Every localized string here is produced *now*, from what was stored then. A
// session holds an exercise id and a variant index, and both the name and which
// columns to show are derived from them at render (ADR 0012) — before #69 the
// label came off a stored `name` and the columns were always variant 0's, so a
// session that logged a swapped variant showed the wrong ones and a session
// logged in English stayed English after a switch to pt-BR.
import type { Content, VerdictId } from '$lib/content/types';
import { isoDayOf } from '$lib/dates';
import { displayDate } from '$lib/displayDate';
import { exerciseLabel, weekdayLabel } from '$lib/format';
import { asExerciseId, type ExerciseId, type WeekdayKey } from '$lib/ids';
import { fieldsFor, type SetField } from '$lib/loggedSet';
import { dayTemplate, variantOf } from '$lib/prescription';
import type { TrainingRecord } from '$lib/store/record';
import type { LoggedSet } from '$lib/types';

export interface LoggedCheckRow {
	/** ISO calendar date. The row's identity; the labels are for display. */
	iso: string;
	dateLabel: string;
	timeLabel: string;
	score: number;
	verdictId: VerdictId;
	verdict: Content['verdicts'][VerdictId];
	/** The check as answered — question text against the chosen answer. */
	responses: { question: string; answer: string }[];
	flagTitles: string[];
	/** 0 bailed · 1 flat · 2 as expected · 3 strong. */
	outcome: number | null;
}

export interface LoggedSessionRow {
	iso: string;
	dateLabel: string;
	weekday: WeekdayKey;
	weekdayLabel: string;
	dayType: string;
	exercises: { exercise: ExerciseId; name: string; fields: SetField[]; sets: LoggedSet[] }[];
	note: string;
	durationMin: number | null;
	setCount: number;
}

export interface LogScreen {
	checks: LoggedCheckRow[];
	sessions: LoggedSessionRow[];
}

/** Time of day, in the athlete's locale. A readiness check is identified by its
 *  epoch timestamp; this is the only place that turns one into a clock face.
 *
 *  The locale is an argument for the same reason `getContent`'s is (#56): a
 *  resolver that reads the ambient locale is not a pure function of what it was
 *  handed, whatever its signature claims. */
function timeLabel(at: number, locale: string): string {
	return new Date(at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

/** Everything Log reads, resolved against the record. */
export function resolveLog(content: Content, record: TrainingRecord, locale: string): LogScreen {
	return {
		// The record hands readiness back oldest first, because that is how the
		// trend, the baseline and the calibration read it. A history reads the
		// other way.
		checks: [...record.readinessLog].reverse().map((r) => checkRow(content, r, locale)),
		// Already newest first (`store/record.ts`).
		sessions: record.sessions.map((s) => sessionRow(content, s)),
	};
}

function checkRow(
	content: Content,
	r: TrainingRecord['readinessLog'][number],
	locale: string,
): LoggedCheckRow {
	const iso = isoDayOf(r.at);
	const verdictId = r.verdict;
	return {
		iso,
		dateLabel: displayDate(iso),
		timeLabel: timeLabel(r.at, locale),
		score: r.score,
		verdictId,
		verdict: content.verdicts[verdictId],
		responses: content.quiz.flatMap((q) => {
			const v = r.answers?.[q.id];
			if (v == null) return [];
			return [{ question: q.q, answer: q.a.find((o) => o.v === v)?.t ?? String(v) }];
		}),
		flagTitles: (r.flags ?? []).map((f) => content.flags[f.id]?.title ?? f.id),
		outcome: r.outcome ?? null,
	};
}

function sessionRow(content: Content, s: TrainingRecord['sessions'][number]): LoggedSessionRow {
	// `Session.weekday` is branded on the entity (#55), so nothing is re-minted
	// on the way out.
	//
	// What this resolves is the *built-in* week's day type for that weekday, which
	// is an approximation rather than the day type the session actually ran — a
	// `Session` records no day type at all, so the moment the athlete edits a
	// weekday's day type this row goes on showing the built-in one. ADR 0016's
	// split surfaced that (the lookup is by weekday, the field read describes a day
	// type) and deliberately preserved the behaviour: the fix is to record the day
	// type on the session, which changes what a session *is*.
	const weekday = content.builtInWeek.find((d) => d.k === s.weekday);
	const day = weekday ? dayTemplate(content, weekday.dayType) : undefined;
	const exercises = renderableExercises(content, s);
	return {
		iso: s.at,
		dateLabel: displayDate(s.at),
		weekday: s.weekday,
		weekdayLabel: weekdayLabel(content, s.weekday),
		dayType: day?.type ?? '',
		exercises,
		note: s.note,
		durationMin: s.durationMin ?? null,
		// Counted over what is rendered, not over what is stored, so the number on
		// the closed row matches the rows inside it when it opens.
		setCount: exercises.reduce((n, e) => n + e.sets.length, 0),
	};
}

/**
 * The exercises of one session, as the history can render them.
 *
 * An id the library no longer has is **dropped**, not thrown on. The library
 * closed when #12 dropped athlete-authored exercises, so a stored id can outlive
 * its exercise — and this is a screen, where a throw blanks five weeks of history
 * over one unrenderable row. The session itself survives with its other
 * exercises, its note and its duration, because all of those are still true.
 */
function renderableExercises(content: Content, s: TrainingRecord['sessions'][number]) {
	return s.exercises.flatMap((logged) => {
		const exercise = content.exercises[logged.exercise];
		if (!exercise) return [];
		return [
			{
				exercise: asExerciseId(logged.exercise),
				name: exerciseLabel(exercise, logged.variant),
				fields: fieldsFor(variantOf(exercise, logged.variant)),
				sets: logged.sets,
			},
		];
	});
}
