// The class recipes: five shapes every screen reuses.
//
// These are `tailwind-variants` and not components, because that is the whole
// point of them — a `<label>`, an `<input>`, a `<button>`, an `<a>` and a
// `<Dialog.Close>` all need to be *the same button*, and a component that owns
// its element cannot do that without an `asChild` escape hatch nobody remembers
// to reach for. A recipe is applied to whatever element the situation needs.
//
// `tv`, never `cva` (#46). shadcn generates `cva`; normalise its output on
// ingest, every time. Two variant systems side by side is the failure mode the
// redesign map exists to avoid.
//
// Animation lives here too, in the variant rather than as a Motion prop (#46).
// There is deliberately very little of it: the whole direction rests on
// repetition, and a dense screen where things move is not a calm one.
import { tv } from 'tailwind-variants';

/**
 * The one surface.
 *
 * A card has to *earn* itself: it carries state colour, or it holds a list whose
 * rows need a shared edge. Everything else groups with `Bare` — a hairline and
 * whitespace. Half the sections on Today used to be a bordered box around a
 * handful of rows, which is what made the screen read as boxes-inside-boxes
 * ("tirar as coisas de caixa, dar mais espaçamento").
 *
 * `flush` (`pad: 'none'`) is for cards that own their own internal rules;
 * `inset` is the recessed step used for inputs and targets.
 */
export const card = tv({
	base: 'rounded-lg border border-line bg-panel',
	variants: {
		pad: { none: '', sm: 'p-3', md: 'p-3.5' },
		tone: {
			plain: '',
			inset: 'border-line-soft bg-panel-2',
			ok: 'border-teal/35 bg-teal/[0.06]',
			warn: 'border-gold/35 bg-gold/[0.06]',
			stop: 'border-flag/40 bg-flag/[0.07]',
		},
	},
	defaultVariants: { pad: 'md', tone: 'plain' },
});

/**
 * Small state token. Colour here always reports state, never decoration.
 *
 * There is no `opacity` variant and there will not be one. A completed set row
 * carried `opacity-55` and took its 9px column labels from 5.13:1 to **2.57:1** —
 * twenty of twenty-four measured contrast failures were that one line, and
 * Direction B hit the identical wall independently. At 9–11px there is no gap
 * between "de-emphasised" and "unreadable", so state is marked with colour.
 */
export const chip = tv({
	base: 'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[10px] leading-[1.4] tracking-wide whitespace-nowrap',
	variants: {
		tone: {
			neutral: 'border-line text-ink-dim',
			ok: 'border-teal/40 text-teal',
			warn: 'border-gold/40 text-gold',
			stop: 'border-flag/45 text-flag',
			ghost: 'border-transparent bg-panel-2 text-ink-faint',
		},
	},
	defaultVariants: { tone: 'neutral' },
});

/**
 * Every text and number input on every screen.
 *
 * `text-base` is not a style choice: a computed font-size under 16px makes iOS
 * zoom the viewport on focus (#43, #54). iOS is best-effort here — the athlete
 * trains on Android — but the rule also sets the floor for how narrow a set-row
 * column can get, which is the single tightest constraint on the Train screen.
 * Honoured everywhere for that reason.
 */
export const input = tv({
	// `outline-none` removes the UA outline and `focus:border-ink-faint` replaces
	// it, which is enough for a finger and not enough for a keyboard: the border
	// step is small and it says nothing about *which* of four columns in a set row
	// has the caret. `app.css` puts a real ring back on `:focus-visible`, which a
	// touch focus never matches — so this costs the phone nothing (#52, question 6).
	base: 'w-full min-w-0 rounded-md border border-line bg-panel-2 px-2 py-1.5 text-base text-ink tabular-nums outline-none transition-colors hover:border-line-soft focus:border-ink-faint',
	variants: {
		align: { left: 'text-left', center: 'text-center' },
	},
	defaultVariants: { align: 'center' },
});

/**
 * Buttons. `quiet` is the default — a dense screen with loud buttons is not calm
 * — and `primary` is rationed to one per screen.
 */
export const button = tv({
	// `min-h` rather than `h`, and no `whitespace-nowrap`. Both are pt-BR
	// decisions: "Como esperado", "Mudar para protocolo de reabilitação" and
	// "Concluir e registrar treino" run 1.4–2× their English labels, and a fixed
	// height with nowrap turns every one of them into horizontal overflow. Labels
	// wrap and the button grows.
	//
	// A disabled button drops its fill and its border rather than fading out.
	// `opacity-40` put "Repeat last session" at 2.46:1 and a disabled primary at
	// 3.75:1. WCAG exempts inactive controls, so neither was a violation — but at
	// 2.46:1 a control reads as *broken* rather than as unavailable, which is a
	// worse outcome than the rule was protecting against. Losing the fill says
	// "not now" just as clearly and keeps the label readable at 7.14:1.
	base: 'inline-flex items-center justify-center gap-1.5 rounded-md border text-center text-[13px] leading-tight font-medium transition-colors select-none disabled:border-line-soft disabled:bg-transparent disabled:text-ink-faint',
	variants: {
		kind: {
			// Dark ink on the vermilion, not white. White measured **3.11:1** on
			// `--flag` — the signature colour is bright enough that white sits under
			// the floor on it, which is the trap with any saturated warm accent. The
			// ground gives 6.44:1 and, at these sizes, reads as more emphatic rather
			// than less. Missed entirely by the first version of `check:contrast`,
			// which resolved a filled button's backdrop from its parent instead of
			// from the button itself.
			//
			// HOVER MOVES THE SURFACE OR THE BORDER, NEVER THE MEASURED PAIR (#52).
			// `active:bg-flag-deep` is fine as a press: it lasts as long as the finger
			// is down. As a *hover* it would not be — the ground on `--flag-deep`
			// measures **3.91:1**, under the floor, and a pointer can rest there for as
			// long as it likes. `check:contrast` would never see it, because it measures
			// a page nobody is hovering. So the primary's hover is its border, and the
			// other two raise the panel a step and take their text *lighter*, which can
			// only improve a ratio.
			primary: 'border-flag bg-flag text-bg hover:border-chalk active:bg-flag-deep',
			quiet:
				'border-line bg-panel-2 text-ink-dim hover:bg-panel-3 hover:text-ink active:bg-panel-3 active:text-ink',
			bare: 'border-transparent bg-transparent text-ink-faint hover:text-ink active:text-ink',
		},
		size: {
			sm: 'min-h-8 px-2 py-1',
			md: 'min-h-9 px-3 py-1.5',
			lg: 'min-h-11 px-4 py-2 text-[15px]',
			// 48px, for a control operated mid-set with chalk on the fingers. The
			// athlete's call after finding the full-screen entry button on the device:
			// "make it 48px if possible". It is the only size above the 44px touch
			// floor, and it is deliberately not the default — spending 48px on every
			// control is how a dense screen stops being dense.
			touch: 'min-h-12 px-4 py-2 text-[15px]',
		},
	},
	defaultVariants: { kind: 'quiet', size: 'sm' },
});

/**
 * One option in a picker — the readiness check, the injury self-check, the rehab
 * area and stage.
 *
 * Selected state is carried by weight and a border, not by a fill: a screen of
 * filled pills stops being restful, and there are up to nine of these stacked on
 * Today.
 *
 * `full` is Direction B's finding, kept even though its direction lost. A
 * ruled full-width line costs the same in both languages, where a chip grid
 * reflows into ragged rows — pt-BR runs 1.4–2× longer and is where a two-column
 * option grid breaks first.
 */
export const option = tv({
	base: 'min-h-9 rounded-md border px-2 py-1.5 text-left text-[13px] leading-tight transition-colors',
	variants: {
		on: {
			true: 'border-chalk/60 bg-panel-3 font-semibold text-chalk',
			false: 'border-line bg-panel-2 text-ink-dim hover:border-chalk/40 hover:text-ink',
		},
		width: {
			/** Shares a wrapping row with its siblings. */
			auto: 'flex-1',
			/** Its own line, whatever the label's length. */
			full: 'w-full',
		},
	},
	defaultVariants: { on: false, width: 'auto' },
});
