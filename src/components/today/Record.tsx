// Chapter IV — the record.
//
// Three stat cards in the dark app; three numerals here. The cards were a grid
// because a grid is what you build when three numbers have to share a strip with
// everything else. Given a chapter of their own they do not need boxes, and the
// numbers get to be the size they deserve.
//
// The bodyweight nudge (ADR 0009 — it survived the marker cull because nothing is
// tested and nothing is expended) lives here rather than on chapter I, where it
// used to sit above the plan and ask for a number before the athlete had been
// told what to do.
import { useId, useState } from 'react';
import * as m from '$lib/paraglide/messages';
import type { TodayFixture } from '../../prototype-fixtures';
import { Chapter, Rule } from '../Editorial';
import { Sparkline } from '../Sparkline';

function Stat({ value, suffix, label }: { value: number; suffix?: string; label: string }) {
	return (
		<div className="flex items-baseline gap-4 py-5">
			<span className="c-numeral w-24 flex-none text-[2.75rem] text-ink">
				{value}
				{suffix ? <span className="text-[1.25rem] text-ink-faint">{suffix}</span> : null}
			</span>
			<span className="text-[15px] text-ink-dim">{label}</span>
		</div>
	);
}

export function Record({ today, index }: { today: TodayFixture; index: number }) {
	const bwId = useId();
	const [logged, setLogged] = useState<number | null>(null);
	const [draft, setDraft] = useState('');

	const bwPoints = today.bodyweight.series.map((e) => ({ value: e.v, label: e.date }));

	return (
		<Chapter id="record" index={index} label={m.c_ch_record()}>
			<div className="divide-y divide-line border-line border-t border-b">
				<Stat value={today.stats.streak} label={m.stat_streak()} />
				<Stat value={today.stats.last7} suffix="/7" label={m.stat_week_sessions()} />
				<Stat value={today.stats.total} label={m.stat_total()} />
			</div>

			<div className="mt-12">
				<p className="c-eyebrow mb-3">{m.readiness_trend()}</p>
				<Sparkline
					points={today.trendPoints}
					color="var(--teal)"
					title={m.readiness_trend()}
					format={(v) => String(Math.round(v))}
				/>
			</div>

			<Rule className="mt-12" />

			<div className="mt-8">
				<label htmlFor={bwId} className="block font-display text-[21px] text-ink">
					{m.bw_prompt()}
				</label>
				{logged == null ? (
					<div className="mt-4 flex items-center gap-3">
						{/* 16px is the floor for an input's computed size — an iOS zoom
						    guard, and iOS is best-effort (#54), but it costs nothing here
						    where the type is large anyway. */}
						<input
							id={bwId}
							type="number"
							inputMode="decimal"
							step="0.1"
							value={draft}
							placeholder={String(today.bodyweight.latestKg)}
							onChange={(e) => setDraft(e.target.value)}
							className="w-28 border-line border-b bg-transparent pb-1 font-display text-[26px] text-ink outline-none focus:border-flag"
						/>
						<span className="text-[15px] text-ink-faint">kg</span>
						<button
							type="button"
							onClick={() => {
								const v = Number.parseFloat(draft);
								setLogged(Number.isFinite(v) ? v : today.bodyweight.latestKg);
							}}
							className="ml-auto border-ink border-b font-display text-[17px] text-ink"
						>
							{m.btn_save()}
						</button>
					</div>
				) : (
					<p className="mt-4 font-display text-[26px] text-flag">
						{logged} <span className="text-[15px]">kg</span>
					</p>
				)}
				<div className="mt-6">
					<Sparkline
						points={bwPoints}
						color="var(--violet)"
						title={m.bw_prompt()}
						format={(v) => `${v} kg`}
					/>
				</div>
			</div>
		</Chapter>
	);
}
