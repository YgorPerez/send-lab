// The stepper shell: a progress rail, one step's worth of content, and the two
// controls that move between them.
//
// A primitive rather than page composition, though onboarding is the only screen
// that uses it, because it owns a decision rather than an arrangement (ADR 0010):
// it owns the one `primary` on the screen. That is the rule's hardest case and
// the reason this file exists at all.
//
// WHERE THE ONE `primary` GOES, DECIDED ONCE
// ------------------------------------------
// `docs/component-vocabulary.md` rations `primary` to one per screen, and a
// stepper wants one on every step. The two are only in conflict if a step is a
// screen. It is not: a stepper renders **one step at a time**, so there is one
// advance button in the tree at any moment, and it is the thing the athlete came
// to do on every one of them. So the advance is the primary, `back` is `quiet`,
// and the ration is kept by construction rather than by counting.
//
// Settings answered the same question the other way — no primary on the page, one
// inside the dialog that guards the irreversible thing (#62) — and the two
// answers are consistent: the primary marks the action the screen exists for, and
// a settings page does not have one.
//
// A DISABLED ADVANCE SAYS WHAT IT IS WAITING FOR
// ----------------------------------------------
// `waitingFor` is not a tooltip and not optional politeness. Train's empty state
// established the rule — the primary is disabled with the line that says what it
// needs, "disabled, not hidden, because a hidden button leaves the athlete
// looking for it" — and a stepper is where an athlete most needs it, because the
// missing answer is somewhere above the fold. The disabled button drops its fill
// rather than its opacity, which the `button` recipe already handles.
import type { ReactNode } from 'react';
import { cn } from '$lib/utils';
import { button } from './variants';

/** One step of the flow. Domain-blind: an id to key on and a label to show. */
export interface Step {
	id: string;
	label: string;
}

export function Stepper({
	steps,
	at,
	railLabel,
	back,
	next,
	children,
}: {
	steps: readonly Step[];
	/** Which step is showing, 0-based. */
	at: number;
	/** What the rail is called to a screen reader — "Step 2 of 4", which the
	 *  visual rail carries as fill and cannot say. Localized by the caller, like
	 *  every other label a primitive takes. */
	railLabel: string;
	/** The way back, or nothing on the first step. */
	back?: { label: string; onClick: () => void };
	/** The way forward — the screen's one `primary`. */
	next: {
		label: string;
		onClick: () => void;
		/** Held, because the step is not answered. */
		disabled?: boolean;
		/** The line under it saying what it is waiting for. Shown only while
		 *  `disabled`, so a held button and its reason cannot come apart. */
		waitingFor?: string;
	};
	children: ReactNode;
}) {
	return (
		<div className="flex flex-col gap-5">
			{/* The rail. One segment per step, and the labels under them — pt-BR runs
			    1.4–2× longer, so they wrap rather than truncate and the segments stay
			    equal. `flex-1` and not a grid: four equal segments are what a flex row
			    of equal children already is. */}
			<ol aria-label={railLabel} className="flex items-start gap-1.5">
				{steps.map((step, index) => {
					const reached = index <= at;
					return (
						<li
							key={step.id}
							className="min-w-0 flex-1"
							{...(index === at ? { 'aria-current': 'step' as const } : {})}
						>
							{/* The progress bar carries no text, so an accent fill on it is free
							    — the contrast rule that keeps white off `--flag` is about a
							    text/background pair, and there is none here. */}
							<div className={cn('h-1.5 rounded-full', reached ? 'bg-flag' : 'bg-line')} />
							<div
								className={cn(
									'eyebrow mt-1.5 normal-case',
									reached ? 'text-ink-dim' : 'text-ink-faint',
								)}
							>
								{step.label}
							</div>
						</li>
					);
				})}
			</ol>

			{children}

			<div className="flex flex-col gap-2">
				<div className="flex gap-2.5">
					{back ? (
						<button
							type="button"
							onClick={back.onClick}
							className={button({ size: 'lg', class: 'min-h-11' })}
						>
							{back.label}
						</button>
					) : null}
					<button
						type="button"
						disabled={next.disabled}
						onClick={next.onClick}
						className={button({ kind: 'primary', size: 'touch', class: 'flex-1' })}
					>
						{next.label}
					</button>
				</div>
				{next.disabled && next.waitingFor ? (
					<p className="text-[12.5px] leading-snug text-gold">{next.waitingFor}</p>
				) : null}
			</div>
		</div>
	);
}
