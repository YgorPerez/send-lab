// Shared shapes for the training content. Exercise *parameters* (ranges +
// metadata) are language-neutral and live once in `exercises.ts`; only prose
// (names, cues, rationale) differs per locale. `getContent()` merges the two.

export type VerdictId = 'rest' | 'tissue' | 'moderate' | 'short' | 'green';
export type PhaseId = 'phase1' | 'phase2' | 'deload';
export type MetricId = 'rfd' | 'contact' | 'cf' | 'pinch' | 'pull' | 'maxhang' | 'density';

/** Inclusive numeric range. A fixed value has `min === max`. */
export interface Range {
	min: number;
	max: number;
}

/** Primary grip an exercise loads. */
export type Grip = 'half-crimp' | 'open-hand' | 'full-crimp' | 'pinch' | 'sloper' | 'wrist' | 'jug';

/** Adaptation an exercise trains (an exercise may hit several). */
type Quality =
	| 'max-strength'
	| 'rfd'
	| 'strength-endurance'
	| 'hypertrophy'
	| 'tissue'
	| 'power'
	| 'aerobic'
	| 'skill';

/** Body region an exercise loads. */
type Region = 'fingers' | 'wrist' | 'pull' | 'antagonist';

/** Relative systemic / skin / joint cost. */
export type Cost = 'low' | 'mod' | 'high';

/** Language-neutral, fully-parametrized targets + metadata for one variant.
 *  Targets are ranges in canonical units: counts, **seconds**, kg, mm, % and
 *  RPE (0–10). Only the fields that apply are set. */
export interface VariantParams {
	sets?: Range;
	reps?: Range;
	/** On/off cycles (or holds) per timed set. */
	rounds?: Range;
	/** Work / hold time per rep, seconds. */
	workSec?: Range;
	/** Rest between reps within a set, seconds. */
	restSec?: Range;
	/** Rest between sets, seconds. */
	setRestSec?: Range;
	/** Added load, kg (negative = assisted). */
	loadKg?: Range;
	/** Edge depth, mm. */
	edgeMm?: Range;
	/** Relative intensity, % of MVC / max. */
	intensityPct?: Range;
	/** Target effort, RPE 0–10. */
	rpe?: Range;
	/** Whether the last set(s) go to failure. */
	toFailure?: boolean;
	grip?: Grip;
	qualities?: Quality[];
	region?: Region[];
	cnsCost?: Cost;
	/** Tracked metrics this variant feeds (for progression graphs). */
	metricIds?: MetricId[];
}

/** Localized prose for one variant. */
interface VariantProse {
	name: string;
	what: string;
	/** Rationale paragraphs (may contain inline <b> emphasis). */
	why: string[];
	/** Cue that doesn't fit a numeric field (may contain inline <b>). */
	note?: string;
}

/** A merged variant (params + prose), as consumed by the UI. */
export type Variant = VariantParams & VariantProse;

/** Shared (language-neutral) parameters for one exercise. */
export interface ExerciseParams {
	/** CSS custom-property name driving this exercise's accent colour. */
	catVar: string;
	/** Swappable variants; index 0 is the default prescription. */
	variants: VariantParams[];
}

/** A merged exercise (params + localized prose). */
export interface Exercise {
	cat: string;
	catVar: string;
	variants: Variant[];
}

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

/** The localized half of the content (prose only; params come from exercises.ts). */
export interface LocaleContent {
	days: Day[];
	exercises: Record<string, { cat: string; variants: VariantProse[] }>;
	metrics: Metric[];
	quiz: QuizQuestion[];
	verdicts: Record<VerdictId, Verdict>;
	phases: Record<PhaseId, Phase>;
	/** Jargon/acronym → plain-language definition, surfaced as tooltips in prose. */
	glossary: Record<string, string>;
}

/** The fully-merged content the UI consumes. */
export interface Content extends Omit<LocaleContent, 'exercises'> {
	exercises: Record<string, Exercise>;
}
