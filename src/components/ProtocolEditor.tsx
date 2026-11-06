// The saved-protocol editor (#104, redrawn by #112): a name if the athlete wants
// one, and the seven numbers as rows, refused under their row when they cannot
// run.
//
// ITS OWN SCREEN
// --------------
// It was a bottom sheet over a blacked-out list. #112 made it a screen: the
// whole viewport, ✕ and Save at the top where a thumb finds them before the
// keyboard covers the bottom half, and nothing behind it to tap by mistake. It
// is still a dialog underneath — a modal that takes focus, closes on Escape and
// gives it back — because that is what a screen opened over the list and
// dismissed back to it is; only the host's shape changed, not how it is opened.
// `EditorTarget` stays the way in: new or edit, from the list.
//
// The rows are `ProtocolRows`, in the order a run goes, with − / + beside each
// value; `/train`'s Adjust uses the same rows. The name is optional: left
// empty, the protocol is listed under its shape, and the empty field says so by
// showing that shape as its placeholder. The total sits under the rows, said
// the way the clock's ready state says it.
//
// WHAT IT DECIDES, AND WHAT IT DOES NOT
// -------------------------------------
// Whether what was typed is a protocol is `readProtocolForm`'s, in the screen's
// read model, where a test can reach it. What is left here is holding what was
// typed — as text, so a field being cleared is not turned into a `0` under the
// cursor — and when to say what is wrong: a field the athlete has touched says so
// at once, and the rest wait for Save.
//
// Writing is the caller's (`onSave`), because a new protocol and an edited one
// are different writes and the screen also has to point the clock at the result.
import { Dialog } from '@base-ui/react/dialog';
import { X } from 'lucide-react';
import { type FormEvent, useId, useState } from 'react';
import { clock, protocolShape } from '$lib/format';
import * as m from '$lib/paraglide/messages';
import { getLocale } from '$lib/paraglide/runtime';
import { type Protocol, type ProtocolField, totalOf } from '$lib/protocol';
import { formOf, type ProtocolForm, readProtocolForm } from '$lib/screens/timer';
import type { NamedProtocol } from '$lib/types';
import { ProtocolRows } from './ProtocolRows';
import { button, input } from './ui/variants';

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
	/** Kept by the caller while the screen closes, so its title does not change
	 *  under the closing animation. */
	target: EditorTarget | null;
	/** Writes the protocol. The screen stays up, its Save spent, until it resolves. */
	onSave: (named: NamedProtocol) => Promise<void>;
}) {
	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Portal>
				{/* The whole viewport, opaque, so there is no backdrop to dim and nothing
				    behind it to tap. It rises a little as it opens, rather than sliding
				    the full height a sheet did. */}
				<Dialog.Popup className="fixed inset-0 z-50 flex h-dvh w-dvw flex-col bg-bg text-ink transition-[opacity,translate] duration-200 data-[ending-style]:translate-y-4 data-[ending-style]:opacity-0 data-[starting-style]:translate-y-4 data-[starting-style]:opacity-0">
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
	const [touched, setTouched] = useState<ReadonlySet<ProtocolField>>(new Set());
	const [attempted, setAttempted] = useState(false);
	const [saving, setSaving] = useState(false);
	const reading = readProtocolForm(form);
	const refused = new Set(
		reading.ok ? [] : reading.refused.filter((f) => attempted || touched.has(f)),
	);
	const id = useId();

	const change = (f: ProtocolField, text: string) => {
		setForm((prev) => ({ ...prev, fields: { ...prev.fields, [f]: text } }));
		setTouched((prev) => (prev.has(f) ? prev : new Set(prev).add(f)));
	};

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
	// The total while the numbers make a protocol; a dash while they do not,
	// rather than the total of whichever numbers happen to parse.
	const protocol = reading.ok ? reading.protocol : null;
	// What an unnamed protocol is listed under, as the empty name's placeholder.
	// The numbers it was opened on while the typed ones do not read.
	const shape = protocolShape(protocol ?? target.protocol, getLocale());

	return (
		<form noValidate onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
			{/* Three columns, the outer two equal, so the title sits on the screen's
			    centre whatever width "Save" or "Salvar" takes. */}
			<header className="mx-auto grid w-full max-w-pane grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 pt-4 pb-2">
				<Dialog.Close
					aria-label={m.btn_close()}
					className={button({ size: 'touch', class: 'size-12 justify-self-start px-0' })}
				>
					<X size={22} />
				</Dialog.Close>
				<Dialog.Title className="text-center text-[17px] leading-tight font-semibold text-ink">
					{title}
				</Dialog.Title>
				<button
					type="submit"
					disabled={saving}
					className={button({ kind: 'primary', size: 'touch', class: 'justify-self-end' })}
				>
					{m.btn_save()}
				</button>
			</header>

			<div className="flex-1 overflow-y-auto">
				<div className="mx-auto flex w-full max-w-pane flex-col gap-4 px-5 pt-2 pb-6">
					<div className="flex flex-col gap-1.5">
						<label htmlFor={`${id}-name`} className="h-section-sans">
							{m.timer_name()}
						</label>
						<input
							id={`${id}-name`}
							type="text"
							autoComplete="off"
							enterKeyHint="done"
							placeholder={shape}
							value={form.name}
							onChange={(e) => {
								const name = e.currentTarget.value;
								setForm((prev) => ({ ...prev, name }));
							}}
							className={input({
								align: 'left',
								// Proportional figures: the recipe's tabular ones are for numbers,
								// and in a name they space "Warm-up" out as "Warm - up".
								class: 'min-h-12 rounded-xl bg-panel px-3.5 normal-nums placeholder:text-ink-faint',
							})}
						/>
					</div>
					<ProtocolRows id={id} fields={form.fields} refused={refused} onChange={change} />
				</div>
			</div>

			<footer className="mx-auto flex w-full max-w-pane items-baseline justify-between gap-3 border-t border-line-soft px-5 pt-2 pb-4">
				<span className="text-[14px] font-medium text-ink-dim">{m.timer_total()}</span>
				{protocol ? (
					<span className="display text-[36px] leading-none font-semibold">
						{clock(totalOf(protocol))}
					</span>
				) : (
					// No total while a field cannot run, rather than the total of
					// whichever numbers parse — a dash to the eye, words to a reader.
					<span className="display text-[36px] leading-none font-semibold text-ink-faint">
						<span aria-hidden="true">–</span>
						<span className="sr-only">{m.timer_total_none()}</span>
					</span>
				)}
			</footer>
		</form>
	);
}
