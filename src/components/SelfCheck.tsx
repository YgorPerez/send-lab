// Injury: the rehab switch and the per-area injury self-check.
//
// `CONTEXT.md` calls it an **injury self-check** and marks "deep assessment" as a
// term to avoid. The whole `Deep*` family was renamed to match in #55's follow-up
// pass — including the `content.deep` key, which is now `content.selfChecks` — so
// the avoided word survives only in the Paraglide message ids (`deep_*`), which
// are i18n keys rather than domain vocabulary.
//
// Both are entry points to something the athlete does rarely and needs to find
// instantly when they do. On a dense screen that is a trap in two directions —
// give them a card each and they compete with today's plan; bury them and the one
// day they matter, they are gone. So they share the screen's last section, each
// as a single row, and the self-check — six questions, a score, a recommendation
// and an attribution — opens in a sheet rather than expanding the screen it was
// launched from.
import { Dialog } from '@base-ui/react/dialog';
import { ExternalLink, X } from 'lucide-react';
import { useState } from 'react';
import { type FlagArea, type SelfCheckBand, scoreSelfCheck } from '$lib/content';
import type { Content } from '$lib/content/types';
import { isoDayOf } from '$lib/dates';
import { displayDate } from '$lib/displayDate';
import * as m from '$lib/paraglide/messages';
import type { SelfCheck } from '$lib/types';
import { Eyebrow, Prose } from './ui/primitives';
import { button, card, option } from './ui/variants';

const BAND_LABEL: Record<SelfCheckBand, () => string> = {
	manageable: m.deep_band_manageable,
	moderate: m.deep_band_moderate,
	significant: m.deep_band_significant,
};
const BAND_REC: Record<SelfCheckBand, () => string> = {
	manageable: m.deep_rec_manageable,
	moderate: m.deep_rec_moderate,
	significant: m.deep_rec_significant,
};
const BAND_COLOR: Record<SelfCheckBand, string> = {
	manageable: 'var(--ok)',
	moderate: 'var(--warn)',
	significant: 'var(--stop)',
};

const AREA_LABEL: Record<string, () => string> = {
	fingers: m.area_fingers,
	elbow: m.area_elbow,
	shoulder: m.area_shoulder,
	wrist: m.area_wrist,
};
const STAGE_LABEL: Record<string, () => string> = {
	acute: m.stage_acute,
	subacute: m.stage_subacute,
	returning: m.stage_returning,
};
const STAGE_DESC: Record<string, () => string> = {
	acute: m.stage_acute_desc,
	subacute: m.stage_subacute_desc,
	returning: m.stage_returning_desc,
};

export function SelfCheckSheet({
	area,
	instrument,
	last,
	open,
	onOpenChange,
}: {
	area: FlagArea;
	instrument: Content['selfChecks'][string];
	last: SelfCheck | undefined;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const [answers, setAnswers] = useState<Record<string, number>>({});
	const complete = Object.keys(answers).length === instrument.questions.length;
	const result = complete ? scoreSelfCheck(instrument.questions.map((q) => answers[q.id])) : null;

	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Portal>
				<Dialog.Backdrop className="fixed inset-0 z-40 bg-black/70 transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
				<Dialog.Popup className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92dvh] max-w-[520px] flex-col rounded-t-xl border border-line bg-panel transition-transform duration-250 data-[ending-style]:translate-y-full data-[starting-style]:translate-y-full">
					<div className="flex items-start gap-2 border-b border-line px-3 py-2.5">
						<div className="min-w-0 flex-1">
							<Dialog.Title className="text-[15px] font-semibold text-ink">
								{instrument.title}
							</Dialog.Title>
							<Eyebrow className="mt-0.5">{AREA_LABEL[area]?.() ?? area}</Eyebrow>
						</div>
						<Dialog.Close
							aria-label={m.btn_close()}
							className={button({ kind: 'quiet', class: 'size-11 shrink-0 px-0' })}
						>
							<X size={17} />
						</Dialog.Close>
					</div>

					<div className="flex-1 overflow-y-auto px-3 py-3">
						<p className="text-[12.5px] leading-snug text-ink-dim">{instrument.intro}</p>
						{last ? (
							<p className="num mt-1.5 text-[11px] text-ink-faint">
								{m.deep_last({ score: last.score, date: displayDate(isoDayOf(last.at)) })}
							</p>
						) : null}

						<div className="mt-3.5 flex flex-col gap-3.5">
							{instrument.questions.map((q, i) => (
								<div key={q.id}>
									<div className="flex gap-1.5 text-[13.5px] leading-snug font-medium text-ink">
										<span className="num shrink-0 pt-px text-[11px] text-ink-faint">
											{String(i + 1).padStart(2, '0')}
										</span>
										<span className="min-w-0">{q.q}</span>
									</div>
									<div className="mt-1.5 flex flex-col gap-1 pl-[22px]">
										{q.a.map((a) => (
											<button
												key={a.t}
												type="button"
												aria-pressed={answers[q.id] === a.v}
												onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: a.v }))}
												className={option({
													on: answers[q.id] === a.v,
													width: 'full',
													class: 'min-h-11',
												})}
											>
												{a.t}
											</button>
										))}
									</div>
								</div>
							))}
						</div>

						{result ? (
							<div className={card({ pad: 'sm', class: 'mt-4' })}>
								<div className="flex items-baseline gap-2">
									<Eyebrow>{m.deep_result()}</Eyebrow>
									<span
										className="num text-[20px] leading-none font-bold"
										style={{ color: BAND_COLOR[result.band] }}
									>
										{result.score}
										<span className="text-[12px] text-ink-faint">/100</span>
									</span>
									<span
										className="text-[13px] font-semibold"
										style={{ color: BAND_COLOR[result.band] }}
									>
										{BAND_LABEL[result.band]()}
									</span>
								</div>
								<p className="mt-1.5 text-[12.5px] leading-snug text-ink-dim">
									{BAND_REC[result.band]()}
								</p>
								<div className="mt-2.5 flex flex-wrap gap-1.5">
									<button type="button" className={button({ kind: 'primary', size: 'md' })}>
										{m.deep_save()}
									</button>
									<button type="button" className={button({ size: 'md' })}>
										{m.deep_start_rehab()} · {STAGE_LABEL[result.stage]()}
									</button>
								</div>
							</div>
						) : null}

						<p className="mt-3 text-[11px] leading-snug text-ink-faint">
							{m.deep_based_on({ source: instrument.source })}{' '}
							<a
								href={instrument.url}
								target="_blank"
								rel="noopener noreferrer"
								className="inline-flex items-center gap-0.5 whitespace-nowrap text-ink-dim underline decoration-line underline-offset-2"
							>
								{m.deep_source_link()}
								<ExternalLink size={9} />
							</a>
						</p>
					</div>
				</Dialog.Popup>
			</Dialog.Portal>
		</Dialog.Root>
	);
}

export function RehabStarter() {
	const [open, setOpen] = useState(false);
	const [area, setArea] = useState('fingers');
	const [stage, setStage] = useState('acute');

	if (!open) {
		return (
			<div className="flex items-center gap-2">
				<p className="min-w-0 flex-1 text-[12px] leading-snug text-ink-dim">{m.rehab_desc()}</p>
				<button
					type="button"
					onClick={() => setOpen(true)}
					className={button({ size: 'md', class: 'min-h-11 shrink-0' })}
				>
					{m.rehab_start()}
				</button>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-2.5">
			<div className="flex flex-col gap-1.5">
				<Eyebrow>{m.rehab_area()}</Eyebrow>
				<div className="grid grid-cols-2 gap-1.5">
					{['fingers', 'elbow', 'shoulder', 'wrist'].map((a) => (
						<button
							key={a}
							type="button"
							aria-pressed={a === area}
							onClick={() => setArea(a)}
							className={option({ on: a === area, class: 'min-h-11' })}
						>
							{AREA_LABEL[a]()}
						</button>
					))}
				</div>
			</div>
			<div className="flex flex-col gap-1.5">
				<Eyebrow>{m.rehab_stage()}</Eyebrow>
				<div className="flex flex-col gap-1.5">
					{['acute', 'subacute', 'returning'].map((s) => (
						<button
							key={s}
							type="button"
							aria-pressed={s === stage}
							onClick={() => setStage(s)}
							className={option({ on: s === stage, width: 'full' })}
						>
							<span className="block font-semibold">{STAGE_LABEL[s]()}</span>
							<span className="prose-inline block text-[11px] leading-snug text-ink-faint">
								<Prose value={STAGE_DESC[s]()} />
							</span>
						</button>
					))}
				</div>
			</div>
			<div className="flex gap-1.5">
				<button
					type="button"
					className={button({ kind: 'primary', size: 'md', class: 'min-h-11' })}
				>
					{m.rehab_apply()}
				</button>
				<button
					type="button"
					className={button({ size: 'md', class: 'min-h-11' })}
					onClick={() => setOpen(false)}
				>
					{m.btn_close()}
				</button>
			</div>
		</div>
	);
}
