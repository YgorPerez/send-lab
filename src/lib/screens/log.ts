// What Log reads.
//
// The history, as one timeline of dated days (#120, spec #113 story 60): each
// date the athlete checked in or trained, holding that day's readiness check
// (the answers that produced it) and that day's session (the sets that were
// actually logged), either of which may be missing. It was two lists, checks and
// sessions, and reading a day meant matching them by date across the screen.
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

/** How a score reads at a glance: the state its verdict sets, in the three
 *  state tones. */
export type ScoreTone = 'ok' | 'warn' | 'stop';

/**
 * The verdict's state, not the library's colour for it.
 *
 * The library paints `green` and `short` vermilion (`var(--flag)`), the colour
 * that means at the limit or stop everywhere else, so Log showed a good day's
 * score in the stop colour (spec #113 story 61). Both are a session trained as
 * planned, one of them shorter; `moderate` and `tissue` cap it; `rest` stops it.
 */
const VERDICT_TONE: Record<VerdictId, ScoreTone> = {
	green: 'ok',
	short: 'ok',
	moderate: 'warn',
	tissue: 'warn',
	rest: 'stop',
};

export type FlagSeverity = 'stop' | 'warn' | 'info';

/** A stored severity, as one of the three; the store types it as a string. */
function severityOf(stored: string): FlagSeverity {
	return stored === 'stop' || stored === 'warn' ? stored : 'info';
}

export interface LoggedCheckRow {
	/** ISO calendar date. The row's identity; the labels are for display. */
	iso: string;
	dateLabel: string;
	timeLabel: string;
	score: number;
	verdictId: VerdictId;
	verdict: Content['verdicts'][VerdictId];
	tone: ScoreTone;
	/** The check as answered — question text against the chosen answer. */
	responses: { question: string; answer: string }[];
	/** The flags it raised, each with the severity it was raised at. */
	flags: { title: string; severity: FlagSeverity }[];
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

/** One date on the timeline: what was checked and what was trained that day. */
export interface LogDay {
	/** ISO calendar date. The row's identity; the labels are for display. */
	iso: string;
	/** The row's date, short: "Aug 13". */
	dateLabel: string;
	/** The date in full, heading the day beside the timeline from `lg`. */
	fullDate: string;
	/** The day's last check: a re-check replaces the morning's verdict. */
	check: LoggedCheckRow | null;
	session: LoggedSessionRow | null;
}

export interface LogScreen {
	/** Newest first, one per date. */
	days: LogDay[];
	/** What the timeline holds, counted as the rows show it. */
	counts: { sessions: number; checks: number };
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

/** A calendar date in full, in the athlete's locale: "Thursday, August 13". It
 *  heads a pane, so it starts with a capital in pt-BR too, where the weekday is
 *  written in lower case ("quinta-feira"). */
function fullDate(iso: string, locale: string): string {
	const [y, m, d] = iso.split('-').map(Number);
	const date = new Date(y, m - 1, d).toLocaleDateString(locale, {
		weekday: 'long',
		month: 'long',
		day: 'numeric',
	});
	return date.charAt(0).toLocaleUpperCase(locale) + date.slice(1);
}

/** Everything Log reads, resolved against the record. */
export function resolveLog(content: Content, record: TrainingRecord, locale: string): LogScreen {
	// One check per date: the record hands readiness back oldest first (how the
	// trend, the baseline and the calibration read it), so a later check of the
	// same day overwrites the earlier one here. The athlete can re-check within a
	// day, and the later answer is the one that set the day's verdict.
	const checks = new Map<string, LoggedCheckRow>();
	for (const r of record.readinessLog) {
		const row = checkRow(content, r, locale);
		checks.set(row.iso, row);
	}
	// A session is keyed by its date already (`store/collections.ts`).
	const sessions = new Map(record.sessions.map((s) => [s.at, sessionRow(content, s)]));
	const dates = [...new Set([...checks.keys(), ...sessions.keys()])].sort().reverse();
	return {
		days: dates.map((iso) => ({
			iso,
			dateLabel: displayDate(iso),
			fullDate: fullDate(iso, locale),
			check: checks.get(iso) ?? null,
			session: sessions.get(iso) ?? null,
		})),
		counts: { sessions: sessions.size, checks: checks.size },
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
		tone: VERDICT_TONE[verdictId],
		responses: content.quiz.flatMap((q) => {
			const v = r.answers?.[q.id];
			if (v == null) return [];
			return [{ question: q.q, answer: q.a.find((o) => o.v === v)?.t ?? String(v) }];
		}),
		flags: (r.flags ?? []).map((f) => ({
			title: content.flags[f.id]?.title ?? f.id,
			severity: severityOf(f.severity),
		})),
		outcome: r.outcome ?? null,
	};
}

function sessionRow(content: Content, s: TrainingRecord['sessions'][number]): LoggedSessionRow {
	// `Session.weekday` is branded on the entity (#55), so nothing is re-minted
	// on the way out.
	//
	// The day type is read off the session rather than looked up. It used to be
	// resolved from the *built-in* week, which meant editing a weekday's day type
	// silently relabelled every past session on that weekday — history rewritten
	// by a change to the plan. ADR 0016 surfaced it and ADR 0017 fixed it by
	// stamping the day type when the session is logged; all this does now is
	// localize what was recorded.
	const day = dayTemplate(content, s.dayType);
	const exercises = renderableExercises(content, s);
	return {
		iso: s.at,
		dateLabel: displayDate(s.at),
		weekday: s.weekday,
		weekdayLabel: weekdayLabel(content, s.weekday),
		dayType: day.type,
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
