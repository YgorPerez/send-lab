// Shared shapes for the training content. Exercise *parameters* (ranges +
// metadata) are language-neutral and live once in `exercises.ts`; only prose
// (names, cues, rationale) differs per locale. `getContent()` merges the two.

/** Every ceiling a readiness check can set on a session, tightest first.
 *  An array rather than a bare union because the write path validates against it:
 *  a stored verdict arrives from the network and has to be checked at runtime, not
 *  only described at compile time. (ADR 0013 rules on *where* a shared set is
 *  declared — here, a layer below the app — and this is that place; its *form* is
 *  a separate question, answered by the fact that something now reads it.) */
export const VERDICT_IDS = ['rest', 'tissue', 'moderate', 'short', 'green'] as const;
export type VerdictId = (typeof VERDICT_IDS)[number];
export type PhaseId = 'phase1' | 'phase2' | 'deload';
export type MetricId =
	| 'rfd'
	| 'contact'
	| 'cf'
	| 'pinch'
	| 'pull'
	| 'maxhang'
	| 'density'
	| 'boulder'
	| 'route'
	| 'bodyweight';

/** Inclusive numeric range. A fixed value has `min === max`. */
export interface Range {
	min: number;
	max: number;
}

/** Primary grip an exercise loads. */
export const GRIPS = [
	'half-crimp',
	'open-hand',
	'full-crimp',
	'pinch',
	'sloper',
	'wrist',
	'jug',
] as const;
export type Grip = (typeof GRIPS)[number];

/** Adaptation an exercise trains (an exercise may hit several). */
export type Quality =
	| 'max-strength'
	| 'rfd'
	| 'strength-endurance'
	| 'hypertrophy'
	| 'tissue'
	| 'power'
	| 'aerobic'
	| 'skill';

/** Body region an exercise loads. */
export type Region = 'fingers' | 'wrist' | 'pull' | 'antagonist';

/** Relative systemic / skin / joint cost. */
export type Cost = 'low' | 'mod' | 'high';

/**
 * A body area that can be hurt — the axis injury runs along.
 *
 * Declared here, a layer below the app, because it is used in two roles on two
 * sides of a boundary the dependency only crosses one way: content keys its
 * per-area `selfChecks` by it and a readiness flag routes to it, while the app
 * stores it on a `SelfCheck` and on the `Rehab` mode. It was declared twice —
 * `FlagArea` here and `RehabArea` in `lib/types.ts`, byte-identical — and
 * deduplicating it by importing *upward* inverts the layering, since
 * `lib/types.ts` already depends on this module. So it moved down instead (#69),
 * following the direction `SelfCheckBand` set. A body area is a body area
 * whether a flag surfaced it or a rehab block targets it, which is why neither
 * old name survived: both named the role rather than the thing.
 *
 * Not `Region`, above: that is which body region an *exercise loads*, an axis of
 * training rather than of injury, and its members differ (`pull`, `antagonist`).
 */
export const BODY_AREAS = ['fingers', 'elbow', 'shoulder', 'wrist'] as const;
export type BodyArea = (typeof BODY_AREAS)[number];

/** How far along a rehab block is — it gates which work is allowed. Declared
 *  beside `BodyArea` and for the same reason: the content library routes a
 *  self-check band to a stage, and the app stores the stage it routed to. */
export const REHAB_STAGES = ['acute', 'subacute', 'returning'] as const;
export type RehabStage = (typeof REHAB_STAGES)[number];

/** Language-neutral, fully-parametrized targets + metadata for one variant.
 *  Targets are ranges in canonical units: counts, **seconds**, kg, mm, % and
 *  RPE (0–10). Only the fields that apply are set. */
export interface VariantParams {
	sets?: Range;
	reps?: Range;
	/** On/off cycles (or holds) per timed set. */
	rounds?: Range;
	/** Get-ready countdown before the first rep, seconds. */
	prepareSec?: number;
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
	/** Tool/equipment axis label (e.g. "Block · 1 hand"). When variants carry
	 *  `tool` + `speed`, the UI offers two pickers instead of one variant list. */
	tool?: string;
	/** Speed/timing axis label (e.g. "Fast"). */
	speed?: string;
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
	/** The exercise's own name (e.g. "Abrahangs"); variants are its options. */
	name: string;
	cat: string;
	catVar: string;
	variants: Variant[];
}

// `CustomExercise` stood here until #56. Athlete-authored exercises left the
// rebuild with #12 — `getContent` stopped merging them and the library closed —
// and the type was the last thing still describing one. `CONTEXT.md` records the
// same under **Exercise**: "The library is the app's, not the athlete's."

/** Stable id of a day type — the protocol a slot runs. Independent of weekdays:
 *  a day type keeps its identity wherever it is scheduled (see ADR-0002). */
export const DAY_TYPE_IDS = [
	'limit-power',
	'pinch-wrist',
	'endurance',
	'pull',
	'max-tissue',
	'performance',
	'rest',
] as const;
export type DayTypeId = (typeof DAY_TYPE_IDS)[number];

/** The rest day type — no exercises, never counts as scheduled work. Identified
 *  by id rather than by matching its localized load label. */
export const REST_DAY_TYPE: DayTypeId = 'rest';

/**
 * A reusable archetype for a slot: its category, load level and default exercise
 * list. `CONTEXT.md`'s **Day type**.
 *
 * It says *what*, and nothing about *when*. That separation is the whole point of
 * the split: this record used to be called `Day` and carried `k` and `label` too,
 * so it was a day type and a weekday at once — see ADR 0016. A day type keeps its
 * identity wherever it is scheduled (ADR-0002), which is exactly why a weekday
 * cannot be one of its fields.
 */
export interface DayType {
	/** Stable day-type id — what this protocol *is*, independent of when it runs. */
	id: DayTypeId;
	/** Localized day category/type (e.g. "Limit / Power", "Rest"). */
	type: string;
	prime: string;
	sec: string;
	/** Localized load label (e.g. HIGH / ALTO). */
	load: string;
	/** CSS custom-property reference driving the load accent, e.g. `var(--flag)`. */
	color: string;
	/** Exercise ids referenced by this day type, primary first. */
	ex: string[];
}

/**
 * One weekday of the **built-in week** — the day type a weekday runs before the
 * athlete's program customizes anything. `CONTEXT.md`'s **Built-in week**.
 *
 * This says *when*, and names the *what* by id rather than holding it. Two
 * weekdays may name the same day type, and a day type no weekday names is still a
 * day type — neither is expressible while the two live in one record.
 */
export interface BuiltInWeekday {
	/** Stable weekday key, `Mon`..`Sun`.
	 *
	 *  Typed `string` rather than `WeekdayKey` deliberately: that brand lives in
	 *  `lib/ids.ts`, and ADR 0013 forbids `content/` importing upward from the app
	 *  — it compiles, which is the whole problem. Narrowing this properly means
	 *  moving the weekday key set down here, which is ADR 0013's own rule and a
	 *  decision of its own rather than a side effect of this split. */
	k: string;
	/** Localized weekday label. Display only — never stored, never matched on. */
	label: string;
	/** The day type this weekday runs by default. */
	dayType: DayTypeId;
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
	/** One-line rationale shown under the question ("why we ask"). */
	why?: string;
	/** Study id (into STUDIES) backing this question. */
	study?: string;
	/** Follow-up questions are revealed by logic.ts only when they'd change the
	 *  outcome; core questions (no `followup`) are always shown. */
	followup?: boolean;
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

/** A targeted recommendation for a specific readiness problem (finger pain,
 *  elbow niggle, worn skin, …), surfaced alongside the overall verdict. */
interface Flag {
	title: string;
	text: string;
	focus: string[];
}

/** One self-check question; each option scores 0–10, where 10 = healthy. */
interface SelfCheckQuestion {
	id: string;
	q: string;
	a: { t: string; v: number }[];
}

/** A per-area injury self-check, modelled on a validated instrument (its domains
 *  + 0–100 scoring) — attributed via `source`/`url`, not a diagnosis. */
export interface SelfCheckInstrument {
	title: string;
	intro: string;
	/** Instrument it's based on, e.g. "VISA-C (climbing finger/wrist)". */
	source: string;
	url: string;
	questions: SelfCheckQuestion[];
}

/** The localized half of the content (prose only; params come from exercises.ts). */
export interface LocaleContent {
	dayTypes: DayType[];
	builtInWeek: BuiltInWeekday[];
	exercises: Record<string, { name: string; cat: string; variants: VariantProse[] }>;
	metrics: Metric[];
	quiz: QuizQuestion[];
	verdicts: Record<VerdictId, Verdict>;
	/** Per-problem recommendations keyed by flag id (see logic.ts `dailyFlags`). */
	flags: Record<string, Flag>;
	/** Per-area injury self-checks, keyed by `BodyArea`.
	 *
	 *  `Partial`, because it is: both locales carry fingers, elbow and shoulder,
	 *  and **no wrist instrument exists**. The key was `string` until #69 branded
	 *  it, and the comment here claimed all four areas — which is how a gap in the
	 *  content library read as complete. Nothing hits it yet (the only lookup is a
	 *  hard-coded `.fingers`), so this is a missing instrument rather than a live
	 *  crash; the type is what will stop it becoming one. */
	selfChecks: Partial<Record<BodyArea, SelfCheckInstrument>>;
	phases: Record<PhaseId, Phase>;
	/** Jargon/acronym → plain-language definition, surfaced as tooltips in prose. */
	glossary: Record<string, string>;
}

/** The fully-merged content the UI consumes. */
export interface Content extends Omit<LocaleContent, 'exercises'> {
	exercises: Record<string, Exercise>;
}
