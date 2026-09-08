// The question asked at first contact with a weighted exercise: what do you
// load this with?
//
// A domain piece rather than a page composition, by the vocabulary's test — it
// names the domain (a **working load**, `CONTEXT.md`) and it owns a decision:
// how the ladder is put, and what the athlete is and is not told about the two
// numbers under it. `TaskCard` is where it is rendered, `lib/workingLoad.ts`
// computes what it offers, and `store/workingLoad.ts` records the answer.
//
// NOTHING IN IT OPENS WITH AN ANSWER
// ----------------------------------
// ADR 0019 binds the intake, and it is the reason this control is shaped the way
// it is even though this is not the intake. The number field starts **empty**
// and neither rung of the top list starts pressed, so an athlete who taps past
// the question has not silently agreed to a load. A default here is a training
// decision made by a form, wearing the athlete's name.
//
// The two suggestions are buttons and **not** prefills for that same reason. A
// tap on `Use` is an answer, recorded as `predicted` or `floor`; a suggestion
// dropped into the input would come back as though the athlete had typed it, and
// #29 grades those differently.
//
// TWO NUMBERS, NEVER ONE — EXCEPT WHERE THERE IS ONLY ONE
// ------------------------------------------------------
// [#40](https://github.com/YgorPerez/send-lab/issues/40) had the athlete ask for
// both, and the point is that they are different claims: the floor is where it
// is safe to begin, the prediction is what we think they can take. Each says
// which it is. Two cases have one number and say so rather than faking a second
// — an account with no bodyweight has nothing to divide by, and a hold where the
// estimate does not clear the floor has nothing to add. Offering a clamped
// estimate as its own rung would file the *floor* under `source: 'predicted'`,
// and the provenance is the point of the collection.
//
// WHY THE TIERS ARE A STACKED LIST AND NOT A `Segmented`
// -----------------------------------------------------
// `docs/component-vocabulary.md` draws that line by label length: `Segmented` is
// for short fixed tokens (`kg`, `Yes`, `4`) that fit on one line, and
// `option({ width: 'full' })` — one choice per row — is what a set whose labels
// are prose needs, "because pt-BR runs 1.4–2× longer and a wrapping grid of them
// reflows into ragged rows". "What I usually use" is prose, and "O que costumo
// usar" is longer.
import type { ReactNode } from 'react';
import { useState } from 'react';
import { confidenceLabel } from '$lib/format';
import type { ExerciseId } from '$lib/ids';
import * as m from '$lib/paraglide/messages';
import { isPinch } from '$lib/strength';
import type { WorkingLoadSource } from '$lib/types';
import type { LoadSuggestion } from '$lib/workingLoad';
import { Eyebrow } from './ui/primitives';
import { button, chip, input, option } from './ui/variants';

/** One suggestion: what it is, what it says, and the button that takes it. */
function Rung({
	label,
	value,
	why,
	note,
	onUse,
}: {
	label: string;
	value: string;
	why: string;
	/** The claim behind the number, where there is one to state. */
	note?: ReactNode;
	/** Absent where the number is stated but not offered — an estimate that does
	 *  not clear the floor is a thing to know, not a thing to take. */
	onUse?: () => void;
}) {
	return (
		<div className="flex items-start gap-2">
			<div className="min-w-0 flex-1">
				<div className="flex flex-wrap items-baseline gap-x-2">
					<span className="eyebrow">{label}</span>
					<span className="num text-[13px] text-chalk">{value}</span>
					{note}
				</div>
				<p className="mt-0.5 text-[11px] leading-snug text-ink-faint">{why}</p>
			</div>
			{onUse ? (
				<button
					type="button"
					onClick={onUse}
					className={button({ size: 'md', class: 'min-h-11 shrink-0' })}
				>
					{m.wl_use()}
				</button>
			) : null}
		</div>
	);
}

export function WorkingLoadAsk({
	exercise,
	prescribesLoad,
	suggestion,
	onAnswer,
}: {
	/** Which exercise is being asked about — read to say what the estimate solved
	 *  for, since a pinch index is kilograms on a block and an edge index is a
	 *  share of bodyweight. Branded, because every component prop that carries an
	 *  identity carries a branded one (`docs/component-vocabulary.md`). */
	exercise: ExerciseId;
	/** The variant already carries a built-in `loadKg`, so ignoring the question
	 *  leaves the library's number in the set row rather than an empty field. True
	 *  for exactly one variant in the library (`pull`), and the copy has to tell
	 *  the truth on both sides of that. */
	prescribesLoad: boolean;
	suggestion: LoadSuggestion;
	onAnswer: (addedKg: number, source: WorkingLoadSource) => void;
}) {
	const [tier, setTier] = useState<WorkingLoadSource | null>(null);
	const [typed, setTyped] = useState('');

	// Built in the render and not at module scope: a message resolved once at
	// import freezes the locale the module happened to load in, which is the bug
	// that only shows up after a switch to pt-BR.
	const tiers: readonly { id: WorkingLoadSource; label: string }[] = [
		{ id: 'tested', label: m.wl_tested() },
		{ id: 'usual', label: m.wl_usual() },
	];

	const entered = Number(typed);
	// Both halves required, and `tier` is the half that is easy to forget: a
	// number with no rung is a number with no evidence, which is the one thing
	// this whole collection exists to avoid storing.
	const canSet = tier !== null && typed.trim() !== '' && Number.isFinite(entered) && entered >= 0;
	const predicted = suggestion.predicted;
	const basis = (index: number) =>
		isPinch(exercise) ? m.wl_basis_pinch({ index }) : m.wl_basis_edge({ index });

	return (
		<div className="flex flex-col gap-2.5">
			<div>
				<Eyebrow>{m.wl_title()}</Eyebrow>
				<p className="mt-0.5 text-[12px] leading-snug text-ink-dim">{m.wl_first()}</p>
			</div>

			<div className="flex flex-col gap-1.5">
				{tiers.map((t) => (
					<button
						key={t.id}
						type="button"
						aria-pressed={t.id === tier}
						onClick={() => setTier(t.id)}
						className={option({ on: t.id === tier, width: 'full', class: 'min-h-11' })}
					>
						{t.label}
					</button>
				))}
			</div>
			<div className="flex items-center gap-2">
				<label className="sr-only" htmlFor={`wl-${exercise}`}>
					{m.wl_added()}
				</label>
				<input
					id={`wl-${exercise}`}
					className={input({ class: 'h-11 w-20 shrink-0' })}
					type="number"
					inputMode="decimal"
					min={0}
					step={0.5}
					placeholder={m.wl_added()}
					value={typed}
					onChange={(e) => setTyped(e.currentTarget.value)}
				/>
				<button
					type="button"
					disabled={!canSet}
					onClick={() => {
						if (tier !== null && canSet) onAnswer(entered, tier);
					}}
					className={button({ size: 'md', class: 'min-h-11' })}
				>
					{m.wl_set()}
				</button>
			</div>

			<Rung
				label={m.wl_floor()}
				value={`+${suggestion.floorKg}kg`}
				why={m.wl_floor_why()}
				onUse={() => onAnswer(suggestion.floorKg, 'floor')}
			/>

			{predicted ? (
				<Rung
					label={m.wl_predicted()}
					value={`+${predicted.addedKg}kg`}
					// Where the estimate did not clear the floor it is stated and not
					// offered: the floor's own button is the honest way to take that
					// number, and it records `floor`.
					why={suggestion.atFloor ? m.wl_at_floor() : m.wl_predicted_why()}
					note={
						<>
							{/* The estimate's own grade, shown rather than swallowed: the
							    conversion behind it is Amca-anchored and its trustworthiness
							    depends on how far the hold is from the validated band. */}
							<span className={chip({ tone: 'ghost' })}>
								{confidenceLabel(predicted.confidence)}
							</span>
							{/* And the target index it solved for, which is our judgment and
							    is labelled as such. A number with nothing attached is what
							    #29 forbids; a number graded "no evidence" is allowed. */}
							<span className={chip({ tone: 'ghost' })}>
								{basis(predicted.index)}
								{' · '}
								{m.wl_judgment()}
							</span>
						</>
					}
					onUse={suggestion.atFloor ? undefined : () => onAnswer(predicted.addedKg, 'predicted')}
				/>
			) : (
				// No estimate at all, which is a different thing from an estimate that
				// came out low. ADR 0009 kept bodyweight because other numbers are
				// expressed against it; with none there is nothing to divide by, and
				// this says so rather than showing a number made up in the gap.
				<p className="text-[11px] leading-snug text-ink-faint">{m.wl_no_estimate()}</p>
			)}

			<p className="text-[11px] leading-snug text-ink-faint">
				{prescribesLoad ? m.wl_later_builtin() : m.wl_later()}
			</p>
		</div>
	);
}
