// WELCOME.
//
// Onboarding: four questions, then the program they generate, offered before it
// is stored. The `Baseline` this produces is not a profile — it feeds
// `programGen.ts` and, through `niggle`, the injury path — so two of its thirteen
// fields are training decisions rather than form inputs, and the shape of the
// page follows from that.
//
// WHAT A STEPPER SHELL IS HERE
// ----------------------------
// `ui/Stepper.tsx`, and it owns exactly one thing this file would otherwise have
// to decide four times: where the screen's one `primary` goes. A stepper renders
// one step at a time, so a step *is* the screen, so the advance is its primary
// and `back` is `quiet`. That is the answer to the ration's hardest case, decided
// once (#53's rule; #62 answered the opposite case for a page with no action of
// its own).
//
// Every choice is `option` — `width: 'full'` for anything whose label is prose,
// `Segmented` for the short fixed tokens (days per week, Yes/No). That split is
// the measured rule, not a preference: a full-width list costs the same in both
// languages where a chip grid reflows into ragged rows, and pt-BR is 1.4–2×
// longer. The one `Picker` in the vocabulary is not used here — nothing on this
// page is a long list.
//
// NOTHING IS PRESELECTED
// ----------------------
// The rule and the reason are in `screens/welcome.ts`: the SvelteKit form opened
// with a goal, a focus, a level, four days a week and all four pieces of gear
// already chosen, and with `niggle` and `synovitis` at `false` — which is not
// "no niggle", it is "nobody asked", and it is #61's fabricated-verdict trap one
// layer earlier. So each step's advance is held until the step is answered, and
// it says what it is waiting for.
//
// IT IS SKIPPABLE, AND IT IS RESUMABLE
// ------------------------------------
// Skippable: there is no gate anywhere and no redirect into here. An account with
// no baseline runs the built-in week, which is a real program — `defaultProgram()`
// is not a broken state — and a gate would have to be an effect-driven redirect
// over account data (ADR 0006 excludes loaders for it), which offline, before the
// store has hydrated, would bounce a returning athlete *with* a baseline into
// onboarding. Today says the week is the built-in one and links here; that is the
// whole entry path.
//
// Resumable: the draft persists, keyed on the account, through
// `lib/baselineDraft.ts` — the ephemeral mechanism (#18) and the component-side
// idiom (#53, pattern 2), with the step index stored alongside the answers so it
// reopens where it stopped. Today reads the same draft and offers to finish it.
//
// The athlete is an athlete. Not a user, a client or a patient — onboarding copy
// is where that slips, and every string on this page is second person.
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { type ReactNode, useId, useMemo, useState } from 'react';
import { useBaselineDraft } from '$lib/baselineDraft';
import { getContent } from '$lib/content';
import { isoToday } from '$lib/dates';
import * as m from '$lib/paraglide/messages';
import { getLocale } from '$lib/paraglide/runtime';
import {
	type BaselineDraft,
	firstIncompleteStep,
	type Proposal,
	resolveProposal,
	STEP_ANSWERS,
	stepComplete,
	toBaseline,
} from '$lib/screens/welcome';
import { programFor, writeBaseline } from '$lib/store/baseline';
import { useRecordSettled, useTrainingRecord } from '$lib/store/record';
import {
	type Baseline,
	EQUIPMENT,
	type Equipment,
	FOCUSES,
	type Focus,
	GOALS,
	type Goal,
	LEVELS,
	type Level,
	type Program,
} from '$lib/types';
import { Bare, Eyebrow, Pane, Prose, Section } from '../components/ui/primitives';
import { Segmented } from '../components/ui/Segmented';
import { type Step, Stepper } from '../components/ui/Stepper';
import { button, card, chip, input, option } from '../components/ui/variants';

export const Route = createFileRoute('/welcome')({ component: Welcome });

/** Labels for the closed sets, as message *functions* — each reads the locale
 *  when called, which is after the root has re-keyed the tree on a switch. A map
 *  keyed by the set rather than a list, so a member added to `types.ts` is a type
 *  error here rather than an option that silently stops being offered. */
const GOAL_LABEL: Record<Goal, () => string> = {
	boulder: m.goal_boulder,
	sport: m.goal_sport,
	all: m.goal_all,
};
const FOCUS_LABEL: Record<Focus, () => string> = {
	fingers: m.focus_fingers,
	power: m.focus_power,
	endurance: m.focus_endurance,
	tissue: m.focus_tissue,
};
const LEVEL_LABEL: Record<Level, () => string> = {
	intermediate: m.level_intermediate,
	advanced: m.level_advanced,
	elite: m.level_elite,
};
const LEVEL_DESC: Record<Level, () => string> = {
	intermediate: m.level_desc_intermediate,
	advanced: m.level_desc_advanced,
	elite: m.level_desc_elite,
};
const EQUIPMENT_LABEL: Record<Equipment, () => string> = {
	hangboard: m.equip_hangboard,
	board: m.equip_board,
	rings: m.equip_rings,
	weights: m.equip_weights,
};
const GOAL_NOTE: Record<Goal, () => string> = {
	boulder: m.prop_goal_boulder,
	sport: m.prop_goal_sport,
	all: m.prop_goal_all,
};
const FOCUS_NOTE: Record<Focus, () => string> = {
	fingers: m.prop_focus_fingers,
	power: m.prop_focus_power,
	endurance: m.prop_focus_endurance,
	tissue: m.prop_focus_tissue,
};

/** 1–6. Six and not seven because Sunday is always the rest day, which is why
 *  `generateProgram` clamps the answer to six. */
const DAYS = [1, 2, 3, 4, 5, 6] as const;

function Welcome() {
	const record = useTrainingRecord();
	const locale = getLocale();
	const content = useMemo(() => getContent(locale), [locale]);
	// The draft, and where in the flow it is. Prefilled from the account's own
	// baseline when there is one — a redo starts from the athlete's previous
	// answers, which fabricates nothing.
	const { draft, setDraft, clear } = useBaselineDraft(record.baseline);
	// AND IT WAITS FOR THE RECORD BEFORE ASKING ANYTHING.
	//
	// `record.baseline` is `null` both when there is no baseline and when
	// `/api/state` has not answered yet, and this screen has to tell them apart
	// twice over. A redo opened in that window would seed a *blank* draft, and the
	// first answer typed into it persists — after which the draft is deliberately
	// preferred over the baseline that arrives a moment later, so the athlete's
	// previous answers are gone for good. The same read decides whether the write
	// at the end is an insert or an update.
	//
	// So the flow is held, not guessed at, and held rather than *redirected*: this
	// is a brief blank on a screen nobody is mid-task on, which is what `login`
	// does with its own pending session. Signed out it is never blank — there is
	// no account, so there is nothing to wait for.
	const settled = useRecordSettled();
	const navigate = useNavigate();

	// The proposal is a `Baseline` the athlete has *finished* but not yet stored,
	// held here rather than persisted: nothing about it is account data until they
	// accept it, and going back to change an answer must not have written one.
	const [accepted, setAccepted] = useState<Baseline | null>(null);
	const [saving, setSaving] = useState(false);
	/** The write threw. Kept on screen rather than swallowed: the athlete has just
	 *  answered thirteen questions, the draft still holds every one of them, and a
	 *  primary that visibly does nothing is the worst of the three outcomes. */
	const [failed, setFailed] = useState(false);

	// The program is generated once and both shown and stored, so the week on
	// screen is the week that runs. Re-deriving it for the display is how the two
	// come apart — see `resolveProposal`.
	const program = useMemo(
		() => (accepted ? programFor(content, accepted) : null),
		[content, accepted],
	);
	const proposal = useMemo(
		() => (accepted && program ? resolveProposal(content, program, accepted) : null),
		[content, program, accepted],
	);

	function propose() {
		// Re-checked here rather than trusted from the button's own `disabled`: the
		// gate and the conversion are the same question, and `toBaseline` answering
		// it is what makes an unanswered finger question unable to become a stored
		// `false`.
		const baseline = toBaseline(draft, isoToday());
		if (baseline) setAccepted(baseline);
	}

	async function start(baseline: Baseline, generated: Program) {
		setSaving(true);
		setFailed(false);
		try {
			await accept(baseline, generated, clear, navigate);
		} catch {
			// The draft is untouched — `accept` clears it only after the write
			// resolves — so the answers are still there to try again with.
			setFailed(true);
		} finally {
			setSaving(false);
		}
	}

	// One pane at every width (#52): a stepper is one thing at a time by design,
	// and a second column has nothing to put in it.
	return (
		<Pane>
			{!settled ? (
				// Deliberately content-free, like the root's own pending state: there is
				// nothing true to say yet about an account whose record has not arrived.
				<div className="min-h-[50dvh]" />
			) : accepted && program && proposal ? (
				<ProposalView
					proposal={proposal}
					baseline={accepted}
					saving={saving}
					failed={failed}
					onStart={() => void start(accepted, program)}
					onEdit={() => setAccepted(null)}
				/>
			) : (
				<Flow draft={draft} setDraft={setDraft} onPropose={propose} />
			)}
		</Pane>
	);
}

/**
 * Store the baseline, forget the draft, and go to Today.
 *
 * Three steps in that order, and the order is the whole of it. The draft is the
 * form and the baseline is the record; this is the one moment both exist, and
 * dropping the draft here is what stops a finished onboarding from being offered
 * back to the athlete on Today as unfinished. It is dropped *after* the write
 * resolves, so a write that fails leaves the answers on the device rather than
 * losing them.
 *
 * At module scope so the sequence has a name and the component is left holding
 * only the `saving` flag around it.
 *
 * `react-doctor` reports `tanstack-start-no-navigate-in-render` here, and it is a
 * false positive: the rule matches any `navigate()` that is not lexically inside
 * a JSX handler, and this one runs from a click that has already awaited a write.
 * Moving the call into the component body does not clear it either. The rule
 * behind it is real — a navigation decided during render is a redirect, and
 * ADR 0006 keeps those out of this app entirely — and nothing here is one. It
 * joins the two warnings `index.tsx` and `login.tsx` already carry with their
 * reasons written down.
 */
async function accept(
	baseline: Baseline,
	program: Program,
	clear: () => void,
	navigate: ReturnType<typeof useNavigate>,
): Promise<void> {
	await writeBaseline(baseline, program);
	clear();
	await navigate({ to: '/' });
}

/** The four steps and the shell around them. */
function Flow({
	draft,
	setDraft,
	onPropose,
}: {
	draft: BaselineDraft;
	setDraft: (next: (prev: BaselineDraft) => BaselineDraft) => void;
	onPropose: () => void;
}) {
	const at = draft.step;
	const last = STEP_ANSWERS.length - 1;
	const patch = (fields: Partial<BaselineDraft>) => setDraft((prev) => ({ ...prev, ...fields }));

	// Built at render, not at module scope: every one of these is a message
	// function and has to be *called* after a locale switch re-keys the tree.
	// `tests/welcome.test.ts` holds the length against `STEP_ANSWERS`, so a step
	// cannot be added to the rail without saying what it asks for.
	const steps: Step[] = [
		{ id: 'goals', label: m.welcome_step_goals() },
		{ id: 'level', label: m.welcome_step_level() },
		{ id: 'week', label: m.welcome_step_week() },
		{ id: 'body', label: m.welcome_step_body() },
	];
	const waitingFor = [
		m.welcome_need_goals(),
		m.welcome_need_level(),
		m.welcome_need_week(),
		m.welcome_need_body(),
	];

	// THE LAST STEP IS GATED ON THE WHOLE DRAFT, NOT ON ITSELF — and the reason it
	// shows is the *first* unanswered step's, not this one's. Why, and why that is
	// reachable rather than theoretical, is on `firstIncompleteStep`.
	const gap = firstIncompleteStep(draft);
	const complete = at === last ? gap === -1 : stepComplete(draft, at);
	const reason = waitingFor[at === last && gap !== -1 ? gap : at];

	return (
		<>
			<header className="pt-1.5">
				<h1 className="h-screen-title">{m.welcome_title()}</h1>
				<p className="mt-1.5 text-[13px] leading-snug text-ink-dim">{m.welcome_sub()}</p>
			</header>

			<Stepper
				steps={steps}
				at={at}
				railLabel={m.welcome_progress({ n: at + 1, total: steps.length })}
				{...(at > 0
					? { back: { label: m.btn_back(), onClick: () => patch({ step: at - 1 }) } }
					: {})}
				next={{
					label: at === last ? m.btn_generate() : m.btn_next(),
					onClick: () => (at === last ? onPropose() : patch({ step: at + 1 })),
					disabled: !complete,
					waitingFor: reason,
				}}
			>
				{at === 0 ? <GoalStep draft={draft} patch={patch} /> : null}
				{at === 1 ? <LevelStep draft={draft} patch={patch} /> : null}
				{at === 2 ? <WeekStep draft={draft} patch={patch} setDraft={setDraft} /> : null}
				{at === 3 ? <BodyStep draft={draft} patch={patch} /> : null}
			</Stepper>

			{/* Skippable, and it says so rather than leaving the athlete to discover
			    it by pressing Back. `bare`, because leaving is not an action this
			    screen is for. */}
			<Bare className="flex flex-col items-start gap-2">
				<p className="text-[12.5px] leading-snug text-ink-dim">{m.welcome_skip_note()}</p>
				<Link to="/" className={button({ kind: 'bare', size: 'md', class: 'min-h-11 px-0' })}>
					{m.welcome_skip()}
				</Link>
			</Bare>
		</>
	);
}

type Patch = (fields: Partial<BaselineDraft>) => void;

/**
 * One question, answered from a stacked list of full-width options.
 *
 * A `<fieldset>` and a `<legend>`, which is the one element pairing that says
 * "these buttons answer that question" without a `role` — and `aria-pressed` on
 * each, because a choice is a toggle and the set is the value. Options carry an
 * optional second line, which is what the three experience levels need: the
 * labels alone ("Advanced") do not tell the athlete which one they are.
 */
function Choices<T extends string>({
	label,
	value,
	options,
	onPick,
}: {
	label: string;
	value: T | null;
	options: readonly { id: T; label: string; desc?: string }[];
	onPick: (next: T) => void;
}) {
	return (
		<fieldset className="flex min-w-0 flex-col gap-1.5">
			<legend className="eyebrow mb-1.5">{label}</legend>
			{options.map((o) => (
				<button
					key={o.id}
					type="button"
					aria-pressed={o.id === value}
					onClick={() => onPick(o.id)}
					className={option({ on: o.id === value, width: 'full', class: 'min-h-11' })}
				>
					<span className="block font-semibold">{o.label}</span>
					{o.desc ? (
						<span className="block text-[11px] leading-snug text-ink-faint">{o.desc}</span>
					) : null}
				</button>
			))}
		</fieldset>
	);
}

/**
 * One typed value.
 *
 * A real `<label>` and never a placeholder, for login's reason: a placeholder
 * disappears on focus and is not an accessible name. The 16px floor comes from
 * the `input` recipe — anything smaller makes iOS zoom the viewport on focus.
 */
function TextField({
	label,
	hint,
	value,
	onChange,
	type = 'text',
	inputMode,
}: {
	label: string;
	/** A unit or a format, shown beside the label rather than in the field. */
	hint?: string;
	value: string;
	onChange: (next: string) => void;
	type?: 'text' | 'number' | 'date';
	inputMode?: 'decimal' | 'numeric';
}) {
	const id = useId();
	return (
		<div className="flex min-w-0 flex-1 flex-col gap-1">
			<label className="eyebrow" htmlFor={id}>
				{label}
				{hint ? <span className="text-ink-faint"> {hint}</span> : null}
			</label>
			<input
				id={id}
				type={type}
				{...(inputMode ? { inputMode } : {})}
				value={value}
				onChange={(e) => onChange(e.currentTarget.value)}
				className={input({ align: 'left', class: 'min-h-11' })}
			/>
		</div>
	);
}

/** Step 1 — what you train for. Reorders which weekdays train, and bumps the
 *  focus's signature day to the front of that order. */
function GoalStep({ draft, patch }: { draft: BaselineDraft; patch: Patch }) {
	return (
		<StepBody help={m.welcome_goals_help()}>
			<Choices
				label={m.field_goal()}
				value={draft.goal}
				options={GOALS.map((id) => ({ id, label: GOAL_LABEL[id]() }))}
				onPick={(goal) => patch({ goal })}
			/>
			<Choices
				label={m.field_focus()}
				value={draft.focus}
				options={FOCUSES.map((id) => ({ id, label: FOCUS_LABEL[id]() }))}
				onPick={(focus) => patch({ focus })}
			/>
		</StepBody>
	);
}

/** Step 2 — how hard the block pushes.
 *
 *  The grades are here rather than with the other informational fields because
 *  the hardest boulder does not merely inform: `programGen`'s `calibratedLevel`
 *  reads a V-number out of it and it *wins* over the level chosen above. Asking
 *  the two apart would hide that one overrides the other. Free text and not a
 *  scale picker — `Baseline` types both as strings deliberately, so an athlete
 *  who grades in Font or on a circuit board can still answer. */
function LevelStep({ draft, patch }: { draft: BaselineDraft; patch: Patch }) {
	return (
		<StepBody help={m.welcome_level_help()}>
			<Choices
				label={m.field_level()}
				value={draft.level}
				options={LEVELS.map((id) => ({ id, label: LEVEL_LABEL[id](), desc: LEVEL_DESC[id]() }))}
				onPick={(level) => patch({ level })}
			/>
			<div className="flex flex-col gap-1.5">
				<div className="flex gap-2.5">
					<TextField
						label={m.field_boulder_grade()}
						value={draft.boulderGrade}
						onChange={(boulderGrade) => patch({ boulderGrade })}
					/>
					<TextField
						label={m.field_route_grade()}
						value={draft.routeGrade}
						onChange={(routeGrade) => patch({ routeGrade })}
					/>
				</div>
				<p className="text-[11px] leading-snug text-ink-faint">{m.welcome_grades_help()}</p>
			</div>
		</StepBody>
	);
}

/** Step 3 — what can be prescribed at all: how many days train, how long a
 *  session runs (which caps exercises per day), and which exercises the gear
 *  supports (which filters them). The gear is the one required list on the page:
 *  with nothing on hand the generator has only the exercises that need none, and
 *  the week it produces is not a program anybody asked for. */
function WeekStep({
	draft,
	patch,
	setDraft,
}: {
	draft: BaselineDraft;
	patch: Patch;
	setDraft: (next: (prev: BaselineDraft) => BaselineDraft) => void;
}) {
	// Resolved against the previous draft rather than against `draft.equipment`,
	// so two taps inside one tick cannot both build on the same stale array.
	const toggleGear = (eq: Equipment) =>
		setDraft((prev) => ({
			...prev,
			equipment: prev.equipment.includes(eq)
				? prev.equipment.filter((x) => x !== eq)
				: [...prev.equipment, eq],
		}));

	return (
		<StepBody help={m.welcome_week_help()}>
			{/* Digits, so `Segmented` rather than a stacked list: the measured rule
			    about ragged rows is about label *length*, and `4` is four pixels wide
			    in both languages. */}
			<fieldset className="flex min-w-0 flex-col gap-1.5">
				<legend className="eyebrow mb-1.5">{m.field_days()}</legend>
				<Segmented
					value={draft.daysPerWeek}
					options={DAYS.map((id) => ({ id, label: String(id) }))}
					onChange={(daysPerWeek) => patch({ daysPerWeek })}
					className="num flex gap-1.5"
				/>
			</fieldset>

			<TextField
				label={m.field_session()}
				value={draft.sessionMinutes}
				onChange={(sessionMinutes) => patch({ sessionMinutes })}
				type="number"
				inputMode="numeric"
			/>

			<fieldset className="flex min-w-0 flex-col gap-1.5">
				<legend className="eyebrow mb-1.5">{m.field_equipment()}</legend>
				{EQUIPMENT.map((eq) => {
					const on = draft.equipment.includes(eq);
					return (
						<button
							key={eq}
							type="button"
							aria-pressed={on}
							onClick={() => toggleGear(eq)}
							className={option({ on, width: 'full', class: 'min-h-11 font-semibold' })}
						>
							{EQUIPMENT_LABEL[eq]()}
						</button>
					);
				})}
			</fieldset>
		</StepBody>
	);
}

/**
 * Step 4 — the two finger questions, and the two readings that are only context.
 *
 * The finger questions come first and carry their own heading, because they are
 * not of a kind with the birth date sitting under them: a niggle caps finger
 * effort at RPE 8 in every finger exercise the program prescribes and softens
 * every phase's intensity, and a reported synovitis is what routes the athlete to
 * the fingers self-check. Both are required. Neither has a default, and
 * `false` is an answer rather than the absence of one.
 */
function BodyStep({ draft, patch }: { draft: BaselineDraft; patch: Patch }) {
	return (
		<StepBody help={m.welcome_body_help()}>
			<Section label={m.welcome_fingers_title()}>
				<YesNo
					question={m.field_niggle()}
					help={m.welcome_niggle_help()}
					value={draft.niggle}
					onAnswer={(niggle) => patch({ niggle })}
				/>
				<YesNo
					question={m.field_synovitis()}
					help={m.welcome_synovitis_help()}
					value={draft.synovitis}
					onAnswer={(synovitis) => patch({ synovitis })}
				/>
			</Section>

			<Section label={m.welcome_optional()}>
				<p className="text-[11px] leading-snug text-ink-faint">{m.welcome_context_help()}</p>
				<div className="flex gap-2.5">
					{/* Kilograms, said out loud. Storage is canonical (ADR 0009) and
					    nothing converts for display yet — `prefs.weight` is recorded and
					    `format.ts` is the seam that grows the conversion back — so naming
					    the unit is the honest label rather than a lie in `lb`.
					    `type="text"` with a decimal keypad, not `type="number"`: a
					    number field refuses the comma a pt-BR keyboard offers as the
					    decimal separator, and `71,5` has to reach `positive()` to be
					    read. */}
					<TextField
						label={m.field_bodyweight()}
						hint="(kg)"
						value={draft.bodyweight}
						onChange={(bodyweight) => patch({ bodyweight })}
						inputMode="decimal"
					/>
					{/* A date field's *value* is ISO `YYYY-MM-DD` while what it shows is
					    the browser's own locale format — which is ADR 0003's shape for
					    free: the stored half is never the displayed half. */}
					<TextField
						label={m.field_birthdate()}
						value={draft.birthDate}
						onChange={(birthDate) => patch({ birthDate })}
						type="date"
					/>
				</div>
			</Section>
		</StepBody>
	);
}

/** One step's content: the line saying what this step decides, then the fields.
 *  The line is not decoration — each of the four answers changes something
 *  specific about the generated program, and saying which is what makes an
 *  onboarding question worth answering carefully. */
function StepBody({ help, children }: { help: string; children: ReactNode }) {
	return (
		<div className="flex flex-col gap-5">
			<p className="text-[12.5px] leading-snug text-ink-dim">{help}</p>
			{children}
		</div>
	);
}

/** A required yes-or-no, with `null` for not yet answered. `Segmented` over a
 *  `Switch`: a switch is a preference that is in force or not, and its off state
 *  is indistinguishable from an unanswered one — which is the whole distinction
 *  these two fields need to keep. */
function YesNo({
	question,
	help,
	value,
	onAnswer,
}: {
	question: string;
	help: string;
	value: boolean | null;
	onAnswer: (next: boolean) => void;
}) {
	return (
		<fieldset className="flex min-w-0 flex-col gap-2">
			<legend className="mb-1.5 text-[13px] leading-snug text-ink">{question}</legend>
			<p className="text-[11px] leading-snug text-ink-faint">{help}</p>
			<Segmented
				value={value}
				options={[
					{ id: false, label: m.btn_no() },
					{ id: true, label: m.btn_yes() },
				]}
				onChange={onAnswer}
				className="flex gap-1.5"
			/>
		</fieldset>
	);
}

/**
 * The program the answers generate, before any of it is stored.
 *
 * Not a fifth step, and the rail is gone here: the four steps are questions and
 * this is the answer to them. What it shows is read off the generated `Program`
 * rather than re-derived from the baseline, so the week on screen is the week
 * that will run — including a weekday the gear rested out.
 *
 * The one `primary` is `Start training`, which is the action the screen exists
 * for; changing the answers is `quiet` and keeps the draft, which is still
 * exactly where the athlete left it.
 */
function ProposalView({
	proposal,
	baseline,
	saving,
	failed,
	onStart,
	onEdit,
}: {
	proposal: Proposal;
	baseline: Baseline;
	saving: boolean;
	/** The write threw. Every answer is still on the device. */
	failed: boolean;
	onStart: () => void;
	onEdit: () => void;
}) {
	return (
		<>
			<header className="pt-1.5">
				<h1 className="h-screen-title">{m.prop_title()}</h1>
				<p className="mt-1.5 text-[13px] leading-snug text-ink-dim">
					{m.prop_intro()} <b className="font-semibold text-chalk">{GOAL_LABEL[baseline.goal]()}</b>{' '}
					· <b className="font-semibold text-chalk">{FOCUS_LABEL[baseline.focus]()}</b> ·{' '}
					{LEVEL_LABEL[baseline.level]()}
				</p>
			</header>

			<Section label={m.prop_training_days({ n: proposal.trainingDays })}>
				<div className={card({ pad: 'sm', class: 'flex flex-col gap-3' })}>
					<p className="text-[13px] leading-snug text-ink">
						{m.prop_week({ phase: proposal.firstPhase })}
					</p>
					{/* A list, so the marked days are countable rather than only
					    coloured — the tone reports the state and the hidden word says it,
					    for anyone the colour does not reach. */}
					<ul className="flex flex-wrap gap-1.5">
						{proposal.week.map((day) => (
							<li key={day.key} className={chip({ tone: day.trains ? 'ok' : 'ghost' })}>
								{day.label}
								<span className="sr-only">
									{' '}
									· {day.trains ? m.prop_day_trains() : m.prop_day_rest()}
								</span>
							</li>
						))}
					</ul>
				</div>
			</Section>

			<Bare className="flex flex-col gap-2.5">
				<p className="prose-inline text-[13px] leading-snug text-ink-dim">
					<Prose value={GOAL_NOTE[baseline.goal]()} />
				</p>
				<p className="prose-inline text-[13px] leading-snug text-ink-dim">
					<Prose value={FOCUS_NOTE[baseline.focus]()} />
				</p>
			</Bare>

			{/* What a reported niggle or synovitis actually did, rather than an offer
			    to switch to rehab: the switch lives on Today's injury entry, and the
			    program in front of the athlete has *already* been softened. Warn tone,
			    because it qualifies the plan without stopping it. */}
			{proposal.niggle || proposal.synovitis ? (
				<div className={card({ pad: 'sm', tone: 'warn', class: 'flex flex-col gap-2' })}>
					<Eyebrow>{m.welcome_fingers_title()}</Eyebrow>
					{proposal.niggle ? (
						<p className="text-[12.5px] leading-snug text-ink">{m.prop_niggle_flagged()}</p>
					) : null}
					{proposal.synovitis ? (
						<p className="text-[12.5px] leading-snug text-ink">{m.prop_synovitis_flagged()}</p>
					) : null}
				</div>
			) : null}

			<div className="flex flex-col gap-2">
				<div className="flex gap-2.5">
					<button
						type="button"
						disabled={saving}
						onClick={onStart}
						className={button({ kind: 'primary', size: 'touch', class: 'flex-1' })}
					>
						{m.prop_start()}
					</button>
					<button
						type="button"
						disabled={saving}
						onClick={onEdit}
						className={button({ size: 'lg', class: 'min-h-11' })}
					>
						{m.welcome_edit()}
					</button>
				</div>
				{/* Gold, like Settings' caveats: it is a warning about this device, and
				    the answers are still here to try again with. */}
				{failed ? (
					<p className="text-[12.5px] leading-snug text-gold">{m.welcome_save_failed()}</p>
				) : null}
			</div>
		</>
	);
}
