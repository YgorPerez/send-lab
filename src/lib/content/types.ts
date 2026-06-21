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
	prime: string;
	sec: string;
	/** Localized load label (e.g. HIGH / ALTO). */
	load: string;
	/** CSS custom-property reference driving the load accent, e.g. `var(--flag)`. */
	color: string;
	/** Exercise ids referenced by this day, primary first. */
	ex: string[];
}

export interface Exercise {
	name: string;
	cat: string;
	/** CSS custom-property name driving this exercise's accent colour. */
	catVar: string;
	what: string;
	spec: string;
	/** Rationale paragraphs (may contain inline <b> emphasis). */
	why: string[];
	/** Swap alternates; index 0 is the default prescription. */
	swaps: string[];
}

export interface Metric {
	id: MetricId;
	name: string;
	abbr: string;
	cat: string;
	unit: string;
	desc: string;
}

export interface QuizOption {
	t: string;
	v: number;
}

export interface QuizQuestion {
	id: string;
	q: string;
	a: QuizOption[];
}

export interface Verdict {
	title: string;
	tag: string;
	color: string;
	text: string;
	focus: string[];
}

export interface Phase {
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
