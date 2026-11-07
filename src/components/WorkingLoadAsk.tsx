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
// it is even though this is not the intake. No rung starts pressed and the number
// field starts **empty**, so an athlete who taps past the question has not
// silently agreed to a load. A default here is a training decision made by a
// form, wearing the athlete's name.
//
// The two suggestions are rungs and **not** prefills for that same reason. A
// suggestion's rung and Set load is an answer, recorded as `predicted` or
// `floor`; a suggestion dropped into the input would come back as though the
// athlete had typed it, and #29 grades those differently.
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
// ONE CHOICE, THEN ITS NUMBER, THEN ONE ACTION (#118)
// ---------------------------------------------------
// The ask used to be the two typed rungs, a number field and Set, then each
// suggestion with its own Use, its grade and its reason, all open at once: five
// controls and ~520px pushing the task's set grid a screen down. It is a compact
// step now. The ladder comes first, as one choice of four lines with nothing
// pressed (a suggestion's line carries its number, and the estimate's its grade,
// because a number the athlete cannot tell is a guess is what #29 forbids). What
// the chosen rung needs comes after it: a field for a typed rung, its reason for
// a suggestion. Then one row with one `quiet` Set load, so the step spends no
// primary (Train's one is finish-and-log) and a suggestion is still an answer
// only once the athlete says so.
//
// WHY THE TIERS ARE A STACKED LIST AND NOT A `Segmented`
// -----------------------------------------------------
// `docs/component-vocabulary.md` draws that line by label length: `Segmented` is
// for short fixed tokens (`kg`, `Yes`, `4`) that fit on one line, and
// `option({ width: 'full' })` — one choice per row — is what a set whose labels
// are prose needs, "because pt-BR runs 1.4–2× longer and a wrapping grid of them
// reflows into ragged rows". "What I usually use" is prose, and "O que costumo
// usar" is longer.
import { ChevronDown } from 'lucide-react';
import { useId, useState } from 'react';
import { confidenceLabel } from '$lib/format';
import type { ExerciseId } from '$lib/ids';
import * as m from '$lib/paraglide/messages';
import { isPinch } from '$lib/strength';
import type { WorkingLoadSource } from '$lib/types';
import type { LoadSuggestion } from '$lib/workingLoad';
import { Eyebrow } from './ui/primitives';
import { button, input, option } from './ui/variants';

export function WorkingLoadAsk({
	exercise,
	prescribesLoad,
	suggestion,
	folded = false,
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
	/** Opens folded to its title line: the task has a set ticked, so the athlete
	 *  has trained past the question. One tap opens it in place. */
	folded?: boolean;
	onAnswer: (addedKg: number, source: WorkingLoadSource) => void;
}) {
	const [open, setOpen] = useState(!folded);
	const bodyId = useId();
	const [rung, setRung] = useState<WorkingLoadSource | null>(null);
	const [typed, setTyped] = useState('');

	const predicted = suggestion.predicted;
	// Where the estimate did not clear the floor it is stated and not offered:
	// the floor's own line is the honest way to take that number, and it records
	// `floor`. Offering a clamped estimate as its own rung would file the floor
	// under `source: 'predicted'`.
	const offered = predicted && !suggestion.atFloor ? predicted : null;
	const basis = (index: number) =>
		isPinch(exercise) ? m.wl_basis_pinch({ index }) : m.wl_basis_edge({ index });

	const typedRung = rung === 'tested' || rung === 'usual';
	const entered = Number(typed);
	// Both halves required for a typed rung, and the rung is the half that is
	// easy to forget: a number with no rung is a number with no evidence, which
	// is the one thing this whole collection exists to avoid storing.
	const answer: number | null =
		rung === 'floor'
			? suggestion.floorKg
			: rung === 'predicted'
				? (offered?.addedKg ?? null)
				: typedRung && typed.trim() !== '' && Number.isFinite(entered) && entered >= 0
					? entered
					: null;

	// Built in the render and not at module scope: a message resolved once at
	// import freezes the locale the module happened to load in, which is the bug
	// that only shows up after a switch to pt-BR.
	const rungs: { id: WorkingLoadSource; label: string; value?: string; grade?: string }[] = [
		{ id: 'tested', label: m.wl_tested() },
		{ id: 'usual', label: m.wl_usual() },
		{ id: 'floor', label: m.wl_floor(), value: `+${suggestion.floorKg}kg` },
		...(offered
			? [
					{
						id: 'predicted' as const,
						label: m.wl_predicted(),
						value: `+${offered.addedKg}kg`,
						// The estimate's own grade, and the index it solved for, which is
						// our judgment and labelled as such. The conversion behind it is
						// Amca-anchored, and how far the hold is from the validated band
						// is how far to trust it.
						grade: `${confidenceLabel(offered.confidence)} · ${basis(offered.index)} · ${m.wl_judgment()}`,
					},
				]
			: []),
	];
	const fieldId = `wl-${exercise}`;

	return (
		<div className="flex flex-col gap-2.5">
			{/* The title line is the disclosure: the ask can be put away and taken
			    up again, and folded it still says the load is not set, so a skipped
			    question is a visible one. */}
			<button
				type="button"
				aria-expanded={open}
				aria-controls={open ? bodyId : undefined}
				onClick={() => setOpen((o) => !o)}
				className="-my-1 flex min-h-11 w-full items-center gap-2 text-left"
			>
				<span className="min-w-0 flex-1">
					<Eyebrow>{m.wl_title()}</Eyebrow>
					<span className="mt-0.5 block text-[13px] leading-snug text-ink-dim">
						{open ? m.wl_first() : m.wl_unset()}
					</span>
				</span>
				<ChevronDown
					size={18}
					aria-hidden="true"
					className={open ? 'shrink-0 rotate-180 text-ink-faint' : 'shrink-0 text-ink-faint'}
				/>
			</button>
			{open ? (
				<div id={bodyId} className="flex flex-col gap-2.5">
					<div className="flex flex-col gap-1.5">
						{rungs.map((r) =>
							r.value ? (
								<button
									key={r.id}
									type="button"
									aria-pressed={r.id === rung}
									onClick={() => setRung(r.id)}
									className={option({ on: r.id === rung, width: 'full', class: 'min-h-11' })}
								>
									<span className="flex items-baseline justify-between gap-2">
										<span>{r.label}</span>
										<span className="num shrink-0 text-chalk">{r.value}</span>
									</span>
									{r.grade ? (
										// Dim ink, not faint: on the pressed option's raised panel the
										// faint ink measured 4.27:1 (#118's audit).
										<span className="mt-0.5 block text-[11px] leading-snug font-normal text-ink-dim">
											{r.grade}
										</span>
									) : null}
								</button>
							) : (
								<button
									key={r.id}
									type="button"
									aria-pressed={r.id === rung}
									onClick={() => setRung(r.id)}
									className={option({ on: r.id === rung, width: 'full', class: 'min-h-11' })}
								>
									{r.label}
								</button>
							),
						)}
					</div>

					{/* An estimate that is stated and not offered, or none at all. No estimate
			    is a different thing from one that came out low: ADR 0009 kept
			    bodyweight because other numbers are expressed against it, and with
			    none there is nothing to divide by. */}
					{predicted && !offered ? (
						<p className="text-[11px] leading-snug text-pretty text-ink-faint">
							{m.wl_predicted()} <span className="num text-ink-dim">+{predicted.addedKg}kg</span> ·{' '}
							{m.wl_at_floor()}
						</p>
					) : predicted ? null : (
						<p className="text-[11px] leading-snug text-pretty text-ink-faint">
							{m.wl_no_estimate()}
						</p>
					)}

					{/* What the chosen rung needs, then the one action. A typed rung gets its
			    field, labelled above it rather than by a placeholder (the pt-BR one
			    clipped to "Kg adici" in an 80px field); a suggestion, the reason for
			    its number. */}
					{rung === 'floor' || rung === 'predicted' ? (
						<p className="text-[11px] leading-snug text-pretty text-ink-faint">
							{rung === 'floor' ? m.wl_floor_why() : m.wl_predicted_why()}
						</p>
					) : null}
					<div className="flex items-end gap-2">
						{typedRung ? (
							<div className="flex flex-col gap-0.5">
								<label className="microlabel" htmlFor={fieldId}>
									{m.wl_added()}
								</label>
								<input
									id={fieldId}
									className={input({ class: 'h-11 w-24 shrink-0' })}
									type="number"
									inputMode="decimal"
									min={0}
									step={0.5}
									value={typed}
									onChange={(e) => setTyped(e.currentTarget.value)}
								/>
							</div>
						) : null}
						<button
							type="button"
							disabled={answer === null}
							onClick={() => {
								if (rung !== null && answer !== null) onAnswer(answer, rung);
							}}
							className={button({ size: 'md', class: 'min-h-11' })}
						>
							{m.wl_set()}
						</button>
					</div>

					{/* Disabled with the line saying what it waits for (ADR 0019's rule,
			    and Train's own for the finish). */}
					{answer === null ? (
						<p className="-mt-1 text-[11px] leading-snug text-pretty text-ink-faint">
							{typedRung ? m.wl_type() : m.wl_pick()}
						</p>
					) : null}

					<p className="text-[11px] leading-snug text-pretty text-ink-faint">
						{prescribesLoad ? m.wl_later_builtin() : m.wl_later()}
					</p>
				</div>
			) : null}
		</div>
	);
}
