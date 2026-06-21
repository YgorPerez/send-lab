// Shared shapes for the localized training content. Structural fields (ids,
// colors, exercise refs) are identical across locales; only the prose differs.

export type VerdictId = 'rest' | 'tissue' | 'moderate' | 'short' | 'green';
export type PhaseId = 'phase1' | 'phase2' | 'deload';
export type MetricId = 'rfd' | 'contact' | 'cf' | 'pinch' | 'pull' | 'maxhang' | 'density';

export interface Day {
	/** Stable id (Mon..Sun) — used in storage keys and exercise refs. */
	k: string;
	/** Localized weekday label. */
	label: string;
	/** Localized day category/type (e.g. "Limit / Power", "Rest"). */
	type: string;
	prime: string;
	sec: string;
	/** Localized load label (e.g. HIGH / ALTO). */
	load: string;
	/** CSS custom-property reference driving the load accent, e.g. `var(--flag)`. */
	color: string;
	/** Exercise ids referenced by this day, primary first. */
	ex: string[];
}

/** Structured prescription for a variant — only the fields that apply are set.
 *  Values are short display strings so they can carry ranges and units
 *  ("3–5s", "2–3", "~20mm", "~60% MVC"). */
export interface Prescription {
	/** Working sets (e.g. "3", "2–3", "4–6 problems"). */
	sets?: string;
	/** Reps per set (e.g. "4/side", "10–15"). */
	reps?: string;
	/** Work / hold time per rep (e.g. "10s", "7s on / 3s off ×6"). */
	work?: string;
	/** Rest between reps within a set (e.g. "5s"). */
	rest?: string;
	/** Rest between sets (e.g. "3 min", "full"). */
	setRest?: string;
	/** Added load when applicable (e.g. "+30–45kg", "bodyweight"). */
	load?: string;
	/** Edge depth when applicable (mm). */
	edge?: string;
	/** Relative intensity when applicable (e.g. "~60% MVC", "~90% 7s max"). */
	intensity?: string;
	/** Free-text cue that doesn't fit a numeric field. */
	note?: string;
}

/** A full exercise variant — each swap is one of these. */
interface Variant {
	name: string;
	what: string;
	spec: Prescription;
	/** Rationale paragraphs (may contain inline <b> emphasis). */
	why: string[];
}

interface Exercise {
	cat: string;
	/** CSS custom-property name driving this exercise's accent colour. */
	catVar: string;
	/** Swappable variants; index 0 is the default prescription. */
	variants: Variant[];
}

interface Metric {
	id: MetricId;
	name: string;
	abbr: string;
	cat: string;
	unit: string;
	desc: string;
}

interface QuizOption {
	t: string;
	v: number;
}

interface QuizQuestion {
	id: string;
	q: string;
	a: QuizOption[];
}

interface Verdict {
	title: string;
	tag: string;
	color: string;
	text: string;
	focus: string[];
}

interface Phase {
	name: string;
	banner: string;
	cat: string;
}

export interface Content {
	days: Day[];
	exercises: Record<string, Exercise>;
	metrics: Metric[];
	quiz: QuizQuestion[];
	verdicts: Record<VerdictId, Verdict>;
	phases: Record<PhaseId, Phase>;
	/** Jargon/acronym → plain-language definition, surfaced as tooltips in prose. */
	glossary: Record<string, string>;
}
