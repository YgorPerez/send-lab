// The saved-protocol editor (#104): a name and the seven numbers, typed in,
// refused beside the field when they cannot run.
//
// A sheet, like the injury self-check, rather than fields opened in the list: a
// protocol is edited once in a while and read every session, so the list stays a
// list, and the sheet can give each field a full label and room for the line that
// says what is wrong with it. pt-BR's "Desaquecimento (s)" does not fit a
// three-column grid at 360px, so the fields go two to a row.
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
import { clock } from '$lib/format';
import * as m from '$lib/paraglide/messages';
import {
	PROTOCOL_FIELDS,
	PROTOCOL_MINIMUM,
	type Protocol,
	type ProtocolField,
	totalOf,
} from '$lib/protocol';
import { formOf, type ProtocolForm, readProtocolForm } from '$lib/screens/timer';
import { FIELD_LABEL } from './Timer';
import { button, input } from './ui/variants';

/** What the editor is open on: a protocol to make, or one to change. */
export type EditorTarget =
	| { kind: 'new'; protocol: Protocol }
	| { kind: 'edit'; name: string; protocol: Protocol };

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
	onSave: (draft: { name: string; protocol: Protocol }) => Promise<void>;
}) {
	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
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
	onSave: (draft: { name: string; protocol: Protocol }) => Promise<void>;
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
		await onSave({ name: reading.name, protocol: reading.protocol });
		setSaving(false);
		onDone();
	};

	const title = target.kind === 'new' ? m.timer_editor_new() : m.timer_editor_edit();
	// The total of what is typed, while it is a protocol; a dash while it is not,
	// rather than the total of the numbers that happen to parse.
	const total = reading.ok ? clock(totalOf(reading.protocol)) : '–';

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
							placeholder={m.timer_name_placeholder()}
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
					{PROTOCOL_FIELDS.map((f) => (
						<Field
							key={f}
							id={`${id}-${f}`}
							label={FIELD_LABEL[f]()}
							problem={shown(f) ? m.timer_field_min({ min: PROTOCOL_MINIMUM[f] }) : null}
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

			<div className="flex flex-wrap items-center gap-2 border-t border-line px-3 py-2.5">
				<p className="num min-w-0 flex-1 text-[12px] text-ink-faint">
					{m.timer_total()} <span className="text-chalk">{total}</span>
				</p>
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
		</form>
	);
}

/** One labelled input and, under it, what is wrong with it if anything is. */
function Field({
	id,
	label,
	problem,
	children,
}: {
	id: string;
	label: string;
	problem: string | null;
	children: (props: {
		id: string;
		'aria-invalid': boolean;
		'aria-describedby': string | undefined;
	}) => ReactNode;
}) {
	const problemId = `${id}-problem`;
	return (
		<div className="flex min-w-0 flex-col gap-1">
			{/* Wraps rather than truncates: pt-BR runs longer. */}
			<label htmlFor={id} className="text-[12px] leading-snug text-ink-dim">
				{label}
			</label>
			{children({
				id,
				'aria-invalid': problem !== null,
				'aria-describedby': problem ? problemId : undefined,
			})}
			{problem ? (
				<p id={problemId} className="text-[11px] leading-snug text-stop">
					{problem}
				</p>
			) : null}
		</div>
	);
}
