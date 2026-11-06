// The protocol's seven numbers as rows (#112): the saved-protocol editor's body,
// and `/train`'s Adjust in the clock's ready state.
//
// In the order a run goes, not the order the model lists them: prepare, then the
// block (work, rest, rounds), then the sets (how many, and the rest between),
// then the cooldown. The grid of seven equal boxes it replaced was in model
// order, so the first thing a run does sat orphaned at the bottom.
//
// Each row is its label, a large value, and a − and a + of 48px either side of
// it — the timer's size (`component-vocabulary.md`, the measured rules), since a
// number here is usually changed by one step between two hangs. The value is
// the field itself: a tap opens the numeric keyboard on it. Not being typed, a
// time reads the way the clock shows it, m:ss from a minute up; being typed it
// is whole seconds, since a phone's numeric keypad has no colon.
//
// WHAT IT DECIDES, AND WHAT IT DOES NOT
// -------------------------------------
// The step each press takes, how a value is shown and whether what was typed is
// a number are `screens/timer.ts`'s (`nudged`, `shownOf`, `readProtocolForm`),
// where a test reaches them. The rows hold no state but whether one is being
// typed into: the text is the caller's, because the editor keeps what was typed
// until Save and Train applies each number as it becomes one.
import { Minus, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { clock } from '$lib/format';
import * as m from '$lib/paraglide/messages';
import { PROTOCOL_MINIMUM, type ProtocolField } from '$lib/protocol';
import { COUNTS, nudged, shownOf, typedValue } from '$lib/screens/timer';
import { cn } from '$lib/utils';
import { button } from './ui/variants';

/** The rows in the order a run goes, grouped as the run is. */
const GROUPS: readonly { heading: (() => string) | null; fields: readonly ProtocolField[] }[] = [
	{ heading: null, fields: ['prepare'] },
	{ heading: m.timer_block, fields: ['work', 'rest', 'rounds'] },
	{ heading: m.timer_sets, fields: ['sets', 'setRest'] },
	{ heading: null, fields: ['cooldown'] },
];

const ROW_LABEL: Record<ProtocolField, () => string> = {
	prepare: m.timer_prepare,
	work: m.timer_work,
	rest: m.timer_rest,
	rounds: m.timer_rounds,
	sets: m.timer_sets,
	setRest: m.timer_rest_between,
	cooldown: m.timer_cooldown_row,
};

/** The segment colour each time runs in, as a dot beside its label — the clock's
 *  colours, so a row is recognised by the field it will fill. A count runs in
 *  none. A mark carries a colour a label cannot (`component-vocabulary.md`). */
const ROW_COLOR: Record<ProtocolField, string | null> = {
	prepare: 'var(--warn)',
	work: 'var(--stop)',
	rest: 'var(--ok)',
	rounds: null,
	sets: null,
	setRest: 'var(--ok)',
	cooldown: 'var(--cooldown)',
};

/** Every field in the order the rows show them — where Enter goes next. */
const RUN_ORDER: readonly ProtocolField[] = GROUPS.flatMap((g) => g.fields);

export function ProtocolRows({
	id,
	fields,
	refused,
	onChange,
	onSettle,
}: {
	/** Prefix of each value's element id: `${id}-${field}`, so a caller can move
	 *  focus to the field that stops a save. */
	id: string;
	fields: Record<ProtocolField, string>;
	/** The fields to say are wrong, under their rows. Which ones, and when, is the
	 *  caller's: the editor waits for a touch or a Save. */
	refused: ReadonlySet<ProtocolField>;
	onChange: (field: ProtocolField, text: string) => void;
	/** A value was left — the field lost focus. Train puts a value it cannot run
	 *  back to the one the clock is running; the editor keeps what was typed for
	 *  Save to refuse. */
	onSettle?: (field: ProtocolField) => void;
}) {
	// What the last − or + did, said: the focus is on the button, not the value,
	// so the value changing under it is not announced by itself.
	const [said, setSaid] = useState('');
	const press = (f: ProtocolField, by: 1 | -1) => {
		const text = nudged(f, fields[f], by);
		onChange(f, text);
		setSaid(`${ROW_LABEL[f]()}: ${spokenOf(f, text)}`);
	};
	return (
		<div className="flex flex-col gap-3">
			<p aria-live="polite" className="sr-only">
				{said}
			</p>
			{GROUPS.map((group) => {
				const headingId = `${id}-${group.fields[0]}-group`;
				const rows = group.fields.map((f) => {
					const next = RUN_ORDER[RUN_ORDER.indexOf(f) + 1];
					return (
						<Row
							key={f}
							id={`${id}-${f}`}
							nextId={next ? `${id}-${next}` : null}
							field={f}
							text={fields[f]}
							refused={refused.has(f)}
							onChange={(text) => onChange(f, text)}
							onPress={(by) => press(f, by)}
							onSettle={() => onSettle?.(f)}
						/>
					);
				});
				return group.heading ? (
					<fieldset key={headingId} aria-labelledby={headingId} className="min-w-0">
						<h3 id={headingId} className="text-[13px] font-semibold text-ink-dim">
							{group.heading()}
						</h3>
						{rows}
					</fieldset>
				) : (
					<div key={headingId}>{rows}</div>
				);
			})}
		</div>
	);
}

function Row({
	id,
	nextId,
	field,
	text,
	refused,
	onChange,
	onPress,
	onSettle,
}: {
	id: string;
	/** The next row's value, where Enter goes; `null` on the last row. */
	nextId: string | null;
	field: ProtocolField;
	text: string;
	refused: boolean;
	onChange: (text: string) => void;
	onPress: (by: 1 | -1) => void;
	onSettle: () => void;
}) {
	const [typing, setTyping] = useState(false);
	const valueRef = useRef<HTMLInputElement>(null);
	// The value swaps from `3:00` to `180` as the field takes focus, which puts
	// the caret at its end; selected instead, the first digit typed replaces it.
	useEffect(() => {
		if (typing) valueRef.current?.select();
	}, [typing]);

	const label = ROW_LABEL[field]();
	const color = ROW_COLOR[field];
	const value = typedValue(field, text);
	const readable = !Number.isNaN(value);
	const noteId = `${id}-note`;
	const note = refused ? refusalOf(field) : typing && !COUNTS.has(field) ? minutesOf(value) : null;
	// The last row needs no rule under it: what follows it (the total, Start)
	// draws its own edge.
	const last = nextId === null;

	return (
		<div className={cn('py-1.5', !last && 'border-b border-line-soft')}>
			<div className="flex min-h-12 items-center gap-2">
				<span
					aria-hidden="true"
					className="size-2.5 shrink-0 rounded-full"
					style={{ background: color ?? 'transparent' }}
				/>
				{/* Wraps rather than truncates: pt-BR's "Desaquecimento" is more than
				    is left beside the controls at 360px. Its row label carries a soft
				    hyphen, so it breaks as "Desaque-cimento": `hyphens: auto` would
				    need the page in pt-BR and a dictionary the browser may not have. */}
				<label
					htmlFor={id}
					className="min-w-0 flex-1 text-[15px] leading-tight font-medium [overflow-wrap:anywhere]"
				>
					{label}
				</label>
				<button
					type="button"
					aria-label={m.timer_decrease({ field: label })}
					onClick={() => onPress(-1)}
					disabled={value <= PROTOCOL_MINIMUM[field]}
					className={button({ size: 'touch', class: 'size-12 shrink-0 px-0' })}
				>
					<Minus size={20} aria-hidden="true" />
				</button>
				<input
					ref={valueRef}
					id={id}
					// Text rather than `number`: a number input reports "" for a stray
					// minus and swallows "7.5" on some keyboards, and the athlete should
					// see exactly what they typed beside the line that says what is wrong
					// with it. `numeric` is what opens the digits. To a screen reader it is
					// still a number — a spin button with its value in words — rather than
					// the text "10s", which reads as "tens", or "1:00", read as a time of
					// day.
					type="text"
					role="spinbutton"
					inputMode="numeric"
					enterKeyHint={nextId ? 'next' : 'done'}
					autoComplete="off"
					spellCheck={false}
					aria-valuenow={readable ? value : undefined}
					aria-valuemin={PROTOCOL_MINIMUM[field]}
					aria-valuetext={readable ? spokenOf(field, text) : undefined}
					aria-invalid={refused}
					aria-describedby={note ? noteId : undefined}
					value={typing ? text : shownOf(field, text)}
					onFocus={() => setTyping(true)}
					onBlur={() => {
						setTyping(false);
						onSettle();
					}}
					onChange={(e) => onChange(e.currentTarget.value)}
					onKeyDown={(e) => {
						// The arrows step, as a spin button's do.
						if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
							e.preventDefault();
							onChange(nudged(field, text, e.key === 'ArrowUp' ? 1 : -1));
						}
						// Enter is the key beside the digits on a phone's keypad, and in
						// the editor's form it would save and close it mid-edit. It goes
						// to the next value instead, and from the last one, away.
						if (e.key === 'Enter') {
							e.preventDefault();
							const next = nextId ? document.getElementById(nextId) : null;
							if (next) next.focus();
							else e.currentTarget.blur();
						}
					}}
					// A bottom rule, as a field has: a number that opens a keyboard has
					// to look like one. In `--ink-faint`, because the rule is what says
					// it is a field, and `--line` measured 2.31:1 against the ground,
					// under the 3:1 a control's edge needs. A zero — no rest, no
					// cooldown — reads dimmer than a number that runs.
					className={cn(
						'display h-12 w-[4.5rem] shrink-0 rounded-none border-b-2 border-ink-faint bg-transparent text-center text-[30px] leading-none font-semibold text-ink outline-none focus:border-ink',
						!typing && !refused && value === 0 && 'text-ink-dim',
						refused && 'border-stop focus:border-stop',
					)}
				/>
				<button
					type="button"
					aria-label={m.timer_increase({ field: label })}
					onClick={() => onPress(1)}
					className={button({ size: 'touch', class: 'size-12 shrink-0 px-0' })}
				>
					<Plus size={20} aria-hidden="true" />
				</button>
			</div>
			{note ? (
				<p
					id={noteId}
					className={cn(
						'pb-1 pl-[1.125rem] text-[12px] leading-snug',
						refused ? 'text-stop' : 'num text-ink-dim',
					)}
				>
					{note}
				</p>
			) : null}
		</div>
	);
}

/** A value in words, for a screen reader: `4`, `10 seconds`, `3 minutes 0
 *  seconds`. */
function spokenOf(f: ProtocolField, text: string): string {
	const value = typedValue(f, text);
	if (COUNTS.has(f)) return String(value);
	return value >= 60
		? m.timer_minutes_seconds({ min: Math.floor(value / 60), sec: value % 60 })
		: m.timer_seconds({ n: value });
}

/** What a refused field is told, under its own row: a count is a number,
 *  everything else seconds. */
function refusalOf(f: ProtocolField): string {
	const min = PROTOCOL_MINIMUM[f];
	return COUNTS.has(f) ? m.timer_field_count_min({ min }) : m.timer_field_seconds_min({ min });
}

/** `= 3:00` while seconds past a minute are being typed, or nothing. */
function minutesOf(seconds: number): string | null {
	return seconds >= 60 ? `= ${clock(seconds)}` : null;
}
