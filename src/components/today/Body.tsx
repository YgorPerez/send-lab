// Chapter V — the body.
//
// Flags, the injury self-check, and the rehab entry point. The three things the
// athlete needs least often and must never have to hunt for.
//
// The self-check is the one place this direction opens a layer instead of a
// chapter: it is a nine-question instrument that replaces the screen while it is
// running, and threading it into the page's sequence would make chapter V four
// screens long for something opened once a fortnight. A swipeable sheet cannot be
// a View Transition (csswg #7957), so this is a plain dialog — the gesture would
// be Motion's job and this direction does not need one.
import { Dialog } from '@base-ui/react/dialog';
import { useState } from 'react';
import * as m from '$lib/paraglide/messages';
import type { TodayFixture } from '../../prototype-fixtures';
import { Chapter, Rule } from '../Editorial';
import { Prose } from '../Prose';

const BAND_LABEL: Record<string, () => string> = {
	manageable: () => m.deep_band_manageable(),
	moderate: () => m.deep_band_moderate(),
	significant: () => m.deep_band_significant(),
};

const BAND_ADVICE: Record<string, () => string> = {
	manageable: () => m.deep_rec_manageable(),
	moderate: () => m.deep_rec_moderate(),
	significant: () => m.deep_rec_significant(),
};

function SelfCheck({ deep }: { deep: TodayFixture['deep'] }) {
	const [open, setOpen] = useState(false);
	const [answers, setAnswers] = useState<Record<string, number>>({});
	const band = deep.last.band;

	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
			<Dialog.Trigger className="border-ink border-b font-display text-[17px] text-ink">
				{m.flag_deep()}
			</Dialog.Trigger>
			<Dialog.Portal>
				<Dialog.Backdrop className="fixed inset-0 z-40 bg-ink/20" />
				<Dialog.Popup className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-background px-6 pt-8 pb-24">
					{/* A close at the top as well as the bottom: the instrument is nine
					    questions long, and a dismiss you have to scroll to is a dismiss the
					    athlete does not have. */}
					<Dialog.Close className="c-eyebrow float-right ml-4 py-1 text-ink-dim">
						{m.btn_close()}
					</Dialog.Close>
					<Dialog.Title className="c-display text-[clamp(1.5rem,7vw,2rem)]">
						{deep.assessment.title}
					</Dialog.Title>
					<Dialog.Description className="mt-4 text-[15px] leading-relaxed text-ink-dim">
						{deep.assessment.intro}
					</Dialog.Description>

					<p className="mt-4 text-[13px] text-ink-faint">
						{m.deep_based_on({ source: deep.assessment.source })}{' '}
						<a
							href={deep.assessment.url}
							target="_blank"
							rel="noreferrer"
							className="border-ink-faint border-b"
						>
							{m.deep_source_link()}
						</a>
					</p>

					<Rule className="mt-8" />

					<ul className="divide-y divide-line">
						{deep.assessment.questions.map((q) => (
							<li key={q.id} className="py-6">
								<p className="font-display text-[19px] text-ink">{q.q}</p>
								<ul className="mt-3 divide-y divide-line border-line border-t border-b">
									{q.a.map((o) => {
										const chosen = answers[q.id] === o.v;
										return (
											<li key={o.t}>
												<button
													type="button"
													aria-pressed={chosen}
													onClick={() => setAnswers((a) => ({ ...a, [q.id]: o.v }))}
													className={`flex w-full items-center gap-3 py-3 text-left text-[15px] ${
														chosen ? 'text-flag' : 'text-ink-dim'
													}`}
												>
													<span aria-hidden="true" className="w-4 flex-none">
														{chosen ? '—' : ''}
													</span>
													{o.t}
												</button>
											</li>
										);
									})}
								</ul>
							</li>
						))}
					</ul>

					<div className="mt-8 border-line border-t pt-6">
						<p className="c-eyebrow">{m.deep_result()}</p>
						<p className="mt-2 text-[15px] text-ink">
							{m.deep_last({ score: deep.last.score, date: deep.last.date })} ·{' '}
							{BAND_LABEL[band]?.() ?? band}
						</p>
						<p className="mt-3 text-[13px] leading-relaxed text-ink-dim">
							{BAND_ADVICE[band]?.() ?? ''}
						</p>
					</div>

					<div className="mt-8 flex flex-wrap items-center gap-6">
						<button type="button" className="border-ink border-b font-display text-[17px] text-ink">
							{m.deep_save()}
						</button>
						<button
							type="button"
							className="border-flag border-b font-display text-[17px] text-flag"
						>
							{m.deep_start_rehab()}
						</button>
						<Dialog.Close className="c-eyebrow ml-auto text-ink-dim">{m.btn_close()}</Dialog.Close>
					</div>
				</Dialog.Popup>
			</Dialog.Portal>
		</Dialog.Root>
	);
}

export function Body({ today, index }: { today: TodayFixture; index: number }) {
	return (
		<Chapter id="body" index={index} label={m.c_ch_body()}>
			<h2 className="c-display text-[clamp(1.75rem,8vw,2.5rem)]">{m.flags_heading()}</h2>

			<ul className="mt-8 divide-y divide-line border-line border-t border-b">
				{today.flags.map((f) => (
					<li key={f.id} className="py-6">
						<p
							className="c-eyebrow"
							style={{ color: f.severity === 'high' ? 'var(--flag)' : 'var(--gold)' }}
						>
							{f.severity}
						</p>
						<p className="mt-1 font-display text-[21px] text-ink">{f.title}</p>
						<p className="mt-2 max-w-[42ch] text-[15px] text-ink-dim leading-relaxed">
							<Prose>{f.text}</Prose>
						</p>
						{f.focus.length > 0 ? (
							<ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-ink-faint">
								{f.focus.map((x) => (
									<li key={x} className="border-line border-b pb-0.5">
										{x}
									</li>
								))}
							</ul>
						) : null}
						{f.area && f.area === today.deep.area ? (
							<div className="mt-4">
								<SelfCheck deep={today.deep} />
							</div>
						) : null}
					</li>
				))}
			</ul>

			<div className="mt-12">
				<p className="c-eyebrow">{m.rehab_label()}</p>
				<h3 className="c-display mt-2 text-[clamp(1.5rem,7vw,2rem)]">{m.rehab_title()}</h3>
				<p className="mt-4 max-w-[42ch] text-[15px] leading-relaxed text-ink-dim">
					{m.rehab_desc()}
				</p>
				<button
					type="button"
					className="mt-5 border-ink border-b font-display text-[17px] text-ink"
				>
					{m.rehab_start()}
				</button>
			</div>
		</Chapter>
	);
}
