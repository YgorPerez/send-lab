// The last chapter of Train — everything that is about the session rather than
// about a set. Adding an exercise off-script, repeating the last session, the
// note, the duration, and the line that says none of it needs saving.
//
// `repeat last session` is rendered spent rather than hidden: the fixture already
// has work logged today, which is exactly when the control stops being available.
// Hiding it would teach the athlete it does not exist.
import { Select } from '@base-ui/react/select';
import { useId, useMemo, useState } from 'react';
import * as m from '$lib/paraglide/messages';
import type { TrainFixture } from '../../prototype-fixtures';
import { Chapter } from '../Editorial';

export function WrapUp({ train, index }: { train: TrainFixture; index: number }) {
	const noteId = useId();
	const durationId = useId();
	const [note, setNote] = useState(train.note);
	const [duration, setDuration] = useState(train.durationMin);
	const [added, setAdded] = useState<string[]>([]);

	const items = useMemo(() => {
		const taken = new Set(added);
		return train.available.flatMap((a) =>
			taken.has(a.exId) ? [] : [{ label: `${a.name} · ${a.cat}`, value: a.exId }],
		);
	}, [train.available, added]);

	return (
		<Chapter id="wrap" index={index} label={m.c_ch_wrap()}>
			<h2 className="c-display text-[clamp(1.75rem,8vw,2.5rem)]">{m.sec_train()}</h2>
			<p className="mt-3 text-[15px] text-ink-dim">
				{train.weekdayLabel} · {train.items.length}×
			</p>

			<div className="mt-10">
				<p className="c-eyebrow mb-2">{m.wk_add_ex()}</p>
				<Select.Root
					items={items}
					value={null}
					onValueChange={(v) => {
						if (typeof v === 'string') setAdded((a) => [...a, v]);
					}}
				>
					<Select.Trigger className="flex w-full items-center justify-between border-line border-b py-3 text-left font-display text-[19px] text-ink">
						<Select.Value placeholder={m.wk_add_ex()} />
						<Select.Icon aria-hidden="true">↓</Select.Icon>
					</Select.Trigger>
					<Select.Portal>
						<Select.Positioner sideOffset={4} className="z-50 w-[var(--anchor-width)]">
							<Select.Popup className="max-h-[50dvh] overflow-y-auto overscroll-contain border border-line bg-popover py-1 shadow-lg">
								<Select.List>
									{items.map((it) => (
										<Select.Item
											key={it.value}
											value={it.value}
											className="px-4 py-3 text-[15px] text-ink-dim data-highlighted:bg-panel-2 data-highlighted:text-ink"
										>
											<Select.ItemText>{it.label}</Select.ItemText>
										</Select.Item>
									))}
								</Select.List>
							</Select.Popup>
						</Select.Positioner>
					</Select.Portal>
				</Select.Root>
				{added.length > 0 ? (
					<ul className="mt-3 text-[15px] text-ink">
						{added.map((id) => (
							<li key={id} className="py-1">
								{train.available.find((a) => a.exId === id)?.name ?? id}
							</li>
						))}
					</ul>
				) : null}
			</div>

			<div className="mt-10">
				<button
					type="button"
					disabled={!train.canRepeatLast}
					className="border-line border-b font-display text-[17px] text-ink-faint disabled:cursor-not-allowed"
				>
					{m.train_repeat()}
				</button>
			</div>

			<div className="mt-12">
				<label htmlFor={noteId} className="c-eyebrow block">
					{m.train_note()}
				</label>
				<textarea
					id={noteId}
					rows={3}
					value={note}
					onChange={(e) => setNote(e.target.value)}
					className="mt-2 w-full resize-none border-line border-b bg-transparent pb-2 font-display text-[19px] text-ink outline-none focus:border-flag"
				/>
			</div>

			<div className="mt-8">
				<label htmlFor={durationId} className="c-eyebrow block">
					{m.train_duration()}
				</label>
				<input
					id={durationId}
					type="number"
					inputMode="numeric"
					min="1"
					value={duration ?? ''}
					onChange={(e) => setDuration(e.target.value === '' ? null : Number(e.target.value))}
					className="mt-2 w-28 border-line border-b bg-transparent pb-1 font-display text-[26px] tabular-nums text-ink outline-none focus:border-flag"
				/>
				<p className="mt-2 text-[13px] text-ink-faint">{m.train_duration_hint()}</p>
			</div>

			<p className="c-eyebrow mt-12">{m.train_autosave()}</p>
		</Chapter>
	);
}
