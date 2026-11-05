// The saved-protocol editor (#104): a name and the seven numbers, typed in,
// refused beside the field when they cannot run.
//
// A sheet, like the injury self-check, rather than fields opened in the list: a
// protocol is edited once in a while and read every session, so the list stays a
// list, and the sheet can give each field a full label and room for the line that
// says what is wrong with it. pt-BR's "Desaquecimento (s)" does not fit a
// three-column grid at 360px, so the fields go two to a row — paired the way
// the shape string reads them: work and rest, rounds and sets, the set rest and
// the cooldown, then prepare.
//
// The footer says the protocol back in the list's own words — `8 × 20s/10s ·
// 2:00 cooldown · 6:00` — as it is typed, so the sheet is a preview of the row
// it will make. A time field past a minute reads itself back in minutes under
// the input (`= 2:00`): a cooldown is minutes, typed as seconds.
//
// WHAT IT DECIDES, AND WHAT IT DOES NOT
// -------------------------------------
// Whether what was typed is a protocol is `readProtocolForm`'s, in the screen's
// read model, where a test can reach it. What is left here is holding what was
// typed — as text, so a field being cleared is not turned into a `0` under the
// cursor — and when to say what is wrong: a field the athlete has touched says so
// at once, and the rest wait for Save, so a blank new protocol does not open
// covered in complaints about a name nobody has had the chance to type yet.
//
// Writing is the caller's (`onSave`), because a new protocol and an edited one
// are different writes and the screen also has to point the clock at the result.
import { Dialog } from '@base-ui/react/dialog';
import { X } from 'lucide-react';
import { type FormEvent, type ReactNode, useId, useState } from 'react';
import { clock, FIELD_LABEL, protocolShape } from '$lib/format';
import * as m from '$lib/paraglide/messages';
import { PROTOCOL_MINIMUM, type Protocol, type ProtocolField, totalOf } from '$lib/protocol';
import { formOf, type ProtocolForm, readProtocolForm } from '$lib/screens/timer';
import type { NamedProtocol } from '$lib/types';
import { cn } from '$lib/utils';
import { button, input } from './ui/variants';

/** The fields in the order the sheet pairs them, two to a row. */
const EDITOR_ORDER: readonly ProtocolField[] = [
	'work',
	'rest',
	'rounds',
	'sets',
	'setRest',
	'cooldown',
	'prepare',
];

/** The counts, as against the seconds: their refusal says "number", not "seconds". */
const COUNTS: ReadonlySet<ProtocolField> = new Set(['rounds', 'sets']);

/** What the editor is open on: a protocol to make, or one to change. */
export type EditorTarget = { kind: 'new'; protocol: Protocol } | ({ kind: 'edit' } & NamedProtocol);

export function ProtocolEditor({
	open,
	onOpenChange,
	target,
	onSave,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Kept by the caller while the sheet closes, so its title does not change
	 *  under the closing animation. */
	target: EditorTarget | null;
	/** Writes the protocol. The sheet stays up, its Save spent, until it resolves. */
	onSave: (named: NamedProtocol) => Promise<void>;
}) {
	return (
		// Not closed by a tap outside it: on a phone the dimmed clock above the
		// sheet is where a resting thumb lands, and that tap would throw away
		// everything typed. Cancel, the close button and Escape still close it.
		<Dialog.Root open={open} onOpenChange={onOpenChange} disablePointerDismissal>
			<Dialog.Portal>
				<Dialog.Backdrop className="fixed inset-0 z-40 bg-black/70 transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
				<Dialog.Popup className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92dvh] max-w-[520px] flex-col rounded-t-xl border border-line bg-panel transition-transform duration-250 data-[ending-style]:translate-y-full data-[starting-style]:translate-y-full">
					{target ? (
						// Keyed on the opening, so each one starts from the protocol it was
						// opened on rather than from whatever the last one left typed.
						<EditorForm
							key={JSON.stringify(target)}
							target={target}
							onSave={onSave}
							onDone={() => onOpenChange(false)}
						/>
					) : null}
				</Dialog.Popup>
			</Dialog.Portal>
		</Dialog.Root>
	);
}

function EditorForm({
	target,
	onSave,
	onDone,
}: {
	target: EditorTarget;
	onSave: (named: NamedProtocol) => Promise<void>;
	onDone: () => void;
}) {
	const [form, setForm] = useState<ProtocolForm>(() =>
		formOf(target.kind === 'edit' ? target.name : '', target.protocol),
	);
	const [touched, setTouched] = useState<ReadonlySet<ProtocolField | 'name'>>(new Set());
	const [attempted, setAttempted] = useState(false);
	const [saving, setSaving] = useState(false);
	const reading = readProtocolForm(form);
	const refused = new Set(reading.ok ? [] : reading.refused);
	const shown = (f: ProtocolField | 'name') => refused.has(f) && (attempted || touched.has(f));
	const id = useId();

	const touch = (f: ProtocolField | 'name') =>
		setTouched((prev) => (prev.has(f) ? prev : new Set(prev).add(f)));

	const submit = async (e: FormEvent) => {
		e.preventDefault();
		if (saving) return;
		if (!reading.ok) {
			setAttempted(true);
			// To the first field that stops it, so a keyboard or a screen reader
			// lands where the fix is rather than on a Save that did nothing.
			document.getElementById(`${id}-${reading.refused[0]}`)?.focus();
			return;
		}
		setSaving(true);
		try {
			await onSave({ name: reading.name, protocol: reading.protocol });
		} finally {
			setSaving(false);
		}
		onDone();
	};

	const title = target.kind === 'new' ? m.timer_editor_new() : m.timer_editor_edit();
	// What is typed, said back, while the numbers make a protocol — with or
	// without a name yet; a dash while they do not, rather than the total of
	// whichever numbers happen to parse.
	const protocol = reading.protocol;
	const summary = protocol ? `${protocolShape(protocol)} · ${clock(totalOf(protocol))}` : '–';

	return (
		<form noValidate onSubmit={submit} className="flex min-h-0 flex-col">
			<div className="flex items-start gap-2 border-b border-line px-3 py-2.5">
				<Dialog.Title className="min-w-0 flex-1 pt-2.5 text-[15px] font-semibold text-ink">
					{title}
				</Dialog.Title>
				<Dialog.Close
					aria-label={m.btn_close()}
					className={button({ kind: 'quiet', class: 'size-11 shrink-0 px-0' })}
				>
					<X size={17} />
				</Dialog.Close>
			</div>

			<div className="flex flex-1 flex-col gap-3.5 overflow-y-auto px-3 py-3">
				<Field
					id={`${id}-name`}
					label={m.timer_name()}
					problem={shown('name') ? m.timer_name_missing() : null}
				>
					{(props) => (
						<input
							{...props}
							type="text"
							autoComplete="off"
							enterKeyHint="next"
							value={form.name}
							onChange={(e) => {
								const name = e.currentTarget.value;
								setForm((prev) => ({ ...prev, name }));
							}}
							onBlur={() => touch('name')}
							className={input({ align: 'left', class: 'aria-invalid:border-stop' })}
						/>
					)}
				</Field>

				<div className="grid grid-cols-2 gap-x-2.5 gap-y-3">
					{EDITOR_ORDER.map((f) => (
						<Field
							key={f}
							id={`${id}-${f}`}
							label={FIELD_LABEL[f]()}
							problem={shown(f) ? refusalOf(f) : null}
							hint={COUNTS.has(f) ? null : minutesOf(form.fields[f])}
						>
							{(props) => (
								<input
									{...props}
									// Text rather than `number`: a number input reports "" for a
									// stray minus and swallows "7.5" on some keyboards, and the
									// athlete should see exactly what they typed beside the line
									// that says what is wrong with it.
									type="text"
									inputMode="numeric"
									autoComplete="off"
									value={form.fields[f]}
									onChange={(e) => {
										const value = e.currentTarget.value;
										setForm((prev) => ({ ...prev, fields: { ...prev.fields, [f]: value } }));
										touch(f);
									}}
									className={input({ class: 'aria-invalid:border-stop' })}
								/>
							)}
						</Field>
					))}
				</div>
			</div>

			<div className="flex flex-col gap-2 border-t border-line px-3 py-2.5">
				<p className="num text-[12px] leading-snug text-ink-dim">
					{m.timer_total()} <span className="text-chalk">{summary}</span>
				</p>
				<div className="flex flex-wrap justify-end gap-2">
					<Dialog.Close className={button({ size: 'md', class: 'min-h-11' })}>
						{m.btn_cancel()}
					</Dialog.Close>
					<button
						type="submit"
						disabled={saving}
						className={button({ kind: 'primary', size: 'md', class: 'min-h-11' })}
					>
						{m.btn_save()}
					</button>
				</div>
			</div>
		</form>
	);
}

/** What a refused field is told: a count is a number, everything else seconds. */
function refusalOf(f: ProtocolField): string {
	const min = PROTOCOL_MINIMUM[f];
	return COUNTS.has(f) ? m.timer_field_count_min({ min }) : m.timer_field_seconds_min({ min });
}

/** `= 2:00` for a time field typed past a minute, or nothing. */
function minutesOf(typed: string): string | null {
	const t = typed.trim();
	if (!/^\d+$/.test(t)) return null;
	const seconds = Number(t);
	return seconds >= 60 ? `= ${clock(seconds)}` : null;
}

/** One labelled input and, under it, what is wrong with it if anything is —
 *  otherwise the hint, if it has one. */
function Field({
	id,
	label,
	problem,
	hint,
	children,
}: {
	id: string;
	label: string;
	problem: string | null;
	hint?: string | null;
	children: (props: {
		id: string;
		'aria-invalid': boolean;
		'aria-describedby': string | undefined;
	}) => ReactNode;
}) {
	const problemId = `${id}-problem`;
	const note = problem ?? hint ?? null;
	return (
		<div className="flex min-w-0 flex-col gap-1">
			{/* Wraps rather than truncates: pt-BR runs longer. */}
			<label htmlFor={id} className="text-[12px] leading-snug text-ink-dim">
				{label}
			</label>
			{children({
				id,
				'aria-invalid': problem !== null,
				'aria-describedby': note ? problemId : undefined,
			})}
			{note ? (
				<p
					id={problemId}
					className={cn('text-[12px] leading-snug', problem ? 'text-stop' : 'num text-ink-dim')}
				>
					{note}
				</p>
			) : null}
		</div>
	);
}
