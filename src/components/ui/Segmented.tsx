// A small closed set of choices, all of them on one line.
//
// Promoted out of `routes/settings.tsx` by #64, which is the promotion rule
// working as `docs/component-vocabulary.md` describes it: "a second screen needs
// it". Settings had the only two — units and language — and the intake has three
// more: days per week, and the two finger questions, where the whole set is `Yes`
// and `No`.
//
// WHY IT IS NOT A `Picker`
// -----------------------
// Settings' own reason, unchanged: with a handful of values the whole set fits on
// the line, and a select that opens to show two rows is a control with a step in
// it for nothing. The other side of that line is `option({ width: 'full' })` — a
// stacked list, one choice per row — which is what a set whose *labels* are
// prose needs, because pt-BR runs 1.4–2× longer and a wrapping grid of them
// reflows into ragged rows. So: this for short, fixed tokens (`kg`, `Yes`, `4`),
// a full-width list for anything a sentence long.
//
// `aria-pressed`, because each button is a toggle and the pair is the value.
// `value` may be **null**, which is what an unanswered question looks like:
// nothing is pressed, and no answer is implied by a default (`screens/welcome.ts`
// — an intake question has no default). Settings never passes null; it always has
// a stored preference.
import { option } from './variants';

/**
 * The value type is widened past `string` deliberately. Days per week is a
 * number and the finger questions are booleans, and stringifying either at the
 * call site to satisfy the control means parsing it back on the way out — which
 * is where `'false'` becomes truthy.
 */
export function Segmented<T extends string | number | boolean>({
	value,
	options,
	onChange,
	className,
}: {
	value: T | null;
	options: readonly { id: T; label: string }[];
	onChange: (next: T) => void;
	className: string;
}) {
	return (
		<div className={className}>
			{options.map((o) => (
				<button
					key={String(o.id)}
					type="button"
					aria-pressed={o.id === value}
					onClick={() => {
						if (o.id !== value) onChange(o.id);
					}}
					// `min-h-11` here and not left to the caller: the `option` recipe
					// floors at 36px, this component's only styling prop lands on the
					// wrapper, and "hit areas do not shrink — 44px everywhere touched"
					// is a measured rule (`docs/component-vocabulary.md`), not a
					// per-screen choice. Settings' rows are already 44px, so it changes
					// nothing there; the intake's days-per-week row and both finger
					// questions were 36px without it, which is the whole interaction of
					// two of its four steps.
					className={option({ on: o.id === value, class: 'min-h-11' })}
				>
					{o.label}
				</button>
			))}
		</div>
	);
}
