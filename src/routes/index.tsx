// TODAY — the reading, and what it prescribes.
//
// The screen is one instrument panel scrolled vertically. There is not a card on
// it: every group is opened by a legend line (label · rule · reading) and held
// together by evenly-ruled rows beneath it. Two ground shifts exist — `panel`
// for the primary readout well, `panel-2` for an input well — and they are the
// only fills in the direction.
//
// The reading is live. `computeReadiness` is the app's own function, fed the
// answers currently on screen, so changing an answer moves the score, can move
// the verdict, and therefore moves which of today's work is held back. That is
// the argument for the whole direction: this is a measuring device, and a
// measuring device that ignores its input is a picture of one.
//
// The load signals are rebuilt from the history *behind* today, exactly as the
// fixture does it — today's own part-finished session must not feed the reading
// that decides what today is allowed to contain.
import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import {
	type Answers,
	computeReadiness,
	type FlagArea,
	getContent,
	scoreDeep,
	visibleQuestionsOrdered,
} from '$lib/content';
import type { VerdictId } from '$lib/content/types';
import * as m from '$lib/paraglide/messages';
import { publishReading, usePrototype } from '$lib/prototypeSnapshot';
import { capByVerdict } from '$lib/readinessPlan';
import { acwr, readinessInsights, weekLoad } from '$lib/stats';
import { STUDIES } from '$lib/studies';
import type { RehabArea, RehabStage } from '$lib/types';
import { cn } from '$lib/utils';
import {
	Band,
	Choice,
	Meter,
	Note,
	Prose,
	Readout,
	Row,
	RowButton,
	SubBand,
	Tag,
	Tick,
} from '../components/instrument';
import { Panel, ScreenHead } from '../components/Panel';
import { Trace } from '../components/Trace';

export const Route = createFileRoute('/')({ component: TodayScreen });

const WELLNESS_LABEL: Record<string, () => string> = {
	sleep: m.rd_sleep,
	fatigue: m.rd_fatigue,
	soreness: m.rd_soreness,
	stress: m.rd_stress,
	mood: m.rd_mood,
};

const OUTCOMES = [
	{ v: 3, label: () => m.rd_outcome_strong() },
	{ v: 2, label: () => m.rd_outcome_ok() },
	{ v: 1, label: () => m.rd_outcome_flat() },
	{ v: 0, label: () => m.rd_outcome_bailed() },
];

const REHAB_AREAS: { id: RehabArea; label: () => string }[] = [
	{ id: 'fingers', label: () => m.area_fingers() },
	{ id: 'elbow', label: () => m.area_elbow() },
	{ id: 'shoulder', label: () => m.area_shoulder() },
	{ id: 'wrist', label: () => m.area_wrist() },
];

const REHAB_STAGES: { id: RehabStage; label: () => string; desc: () => string }[] = [
	{ id: 'acute', label: () => m.stage_acute(), desc: () => m.stage_acute_desc() },
	{ id: 'subacute', label: () => m.stage_subacute(), desc: () => m.stage_subacute_desc() },
	{ id: 'returning', label: () => m.stage_returning(), desc: () => m.stage_returning_desc() },
];

const DEEP_BAND_LABEL: Record<string, () => string> = {
	manageable: m.deep_band_manageable,
	moderate: m.deep_band_moderate,
	significant: m.deep_band_significant,
};

const DEEP_REC: Record<string, () => string> = {
	manageable: m.deep_rec_manageable,
	moderate: m.deep_rec_moderate,
	significant: m.deep_rec_significant,
};

const studyUrl = (id?: string) => (id ? STUDIES.find((s) => s.id === id)?.url : undefined);

/** Focus phrases carry inline `<b>` in the content; a tag is one line of mono
 *  and has nowhere to put emphasis. */
const plain = (s: string) => s.replace(/<\/?b>/g, '');

function TodayScreen() {
	const { today, state } = usePrototype();
	const content = getContent();

	// ── athlete-held state over the snapshot ────────────────────────────────
	const [answers, setAnswers] = useState<Answers>(today.answers);
	const [done, setDone] = useState<Record<string, boolean>>(() =>
		Object.fromEntries(today.tasks.map((t) => [t.exId, t.done])),
	);
	const [carried, setCarried] = useState(false);
	const [outcome, setOutcome] = useState<number | null>(null);
	const [bwInput, setBwInput] = useState('');
	const [bwLogged, setBwLogged] = useState(false);

	// ── the reading, recomputed from the answers on screen ──────────────────
	const history = useMemo(
		() => state.workouts.filter((w) => w.at !== today.iso),
		[state.workouts, today.iso],
	);
	const insights = useMemo(() => readinessInsights(state.readinessLog), [state.readinessLog]);
	const load = useMemo(
		() => ({
			acwr: acwr(history, Date.now())?.status ?? null,
			monotony: weekLoad(history, Date.now())?.status === 'monotonous' ? ('high' as const) : null,
		}),
		[history],
	);

	const questions = visibleQuestionsOrdered(answers);
	const answered = questions.filter((q) => answers[q.id] != null).length;
	const complete = answered === questions.length;
	const reading = complete ? computeReadiness(answers, load, insights) : null;
	const verdictId: VerdictId | null = reading ? reading.verdict : null;
	const verdict = verdictId ? content.verdicts[verdictId] : null;

	const exKey = today.tasks.map((t) => t.exId).join(',');
	const held = useMemo(
		() => new Set(verdictId ? capByVerdict(exKey.split(','), verdictId).held : []),
		[exKey, verdictId],
	);

	const delta = insights.baseline == null || !reading ? null : reading.score - insights.baseline;
	const vsBaseline =
		delta == null
			? null
			: delta <= -10
				? m.rd_vs_below()
				: delta >= 10
					? m.rd_vs_above()
					: m.rd_vs_usual();

	// The chrome's primary display follows the live reading.
	const readingColor = verdict?.color ?? 'var(--ink-faint)';
	const score = reading?.score ?? null;
	useEffect(() => {
		publishReading({ score, color: readingColor });
	}, [score, readingColor]);

	const tasks = today.tasks.map((t) => ({ ...t, done: !!done[t.exId], held: held.has(t.exId) }));
	const active = tasks.filter((t) => !t.held);
	const heldTasks = tasks.filter((t) => t.held);
	const allDone = active.length > 0 && active.every((t) => t.done);
	const carriedLabels = carried ? (today.missed?.labels ?? []) : [];

	return (
		<Panel>
			<ScreenHead
				title={m.nav_today()}
				context={`${today.dateLabel} · ${m.week_label({ n: today.week })}`}
			/>

			{/* ── READING ─────────────────────────────────────────────────────── */}
			<Band label={m.rd_score()} reading={vsBaseline ?? `${answered}/${questions.length}`}>
				<div className="relative overflow-hidden border-b border-line bg-panel px-4 py-4">
					<span aria-hidden className="inst-grid pointer-events-none absolute inset-0" />
					<div className="relative flex items-start gap-4">
						<Readout
							value={reading ? reading.score : '––'}
							unit="/100"
							caption={insights.baseline != null ? `⌀ ${insights.baseline}` : undefined}
							color={readingColor}
						/>
						<div className="min-w-0 flex-1">
							{verdict ? (
								<>
									<div className="text-[16px] leading-tight font-bold text-ink">
										{verdict.title}
									</div>
									<div className="mt-1.5 flex flex-wrap items-center gap-1.5">
										<Tag tone="ink">{verdict.tag}</Tag>
										{today.trend ? (
											<Tag tone="quiet">
												{today.trend === 'up' ? '↑' : today.trend === 'down' ? '↓' : '→'}
											</Tag>
										) : null}
									</div>
								</>
							) : (
								<div className="inst-label-xs">
									{answered}/{questions.length}
								</div>
							)}
						</div>
					</div>
				</div>

				{verdict ? (
					<>
						<Note className="py-3">
							<Prose value={verdict.text} />
						</Note>
						<div className="flex flex-wrap gap-1.5 border-b border-line px-4 pb-3">
							{verdict.focus.map((f, i) => (
								<Tag key={f} tone={i === 0 ? 'flag' : 'quiet'}>
									{plain(f)}
								</Tag>
							))}
						</div>
					</>
				) : null}

				{/* The five wellness dimensions, as segmented bargraphs. A ten-cell
				    meter can be read as a *number* across a room; a smooth bar cannot. */}
				<SubBand label={m.log_rd_responses()} reading="0–10">
					{today.breakdown.map((b) => (
						<Row key={b.id} size="sm">
							<span className="inst-label-xs w-[84px] shrink-0 truncate">
								{WELLNESS_LABEL[b.id]?.() ?? b.id}
							</span>
							<Meter value={answers[b.id] ?? 0} />
							<span className="w-7 shrink-0 text-right font-mono text-[13px] text-chalk">
								{answers[b.id] ?? '–'}
							</span>
						</Row>
					))}
				</SubBand>

				<p className="border-b border-line px-4 py-3 text-[12px] leading-snug text-ink-faint">
					{today.scoreNote === 'tuned' ? m.rd_note_tuned() : m.rd_note_heuristic()}
				</p>

				{active[0] ? (
					<div className="border-b border-line px-4 py-2.5">
						<div className="inst-label-xs">{m.td_applies()}</div>
						<div className="mt-1 font-mono text-[13px] text-chalk">{active[0].label}</div>
					</div>
				) : null}

				{/* Post-session outcome — the loop that turns a heuristic weighting into
				    a calibrated one. */}
				<SubBand label={m.rd_outcome_q()}>
					{outcome == null ? (
						<div className="grid grid-cols-2">
							{OUTCOMES.map((o) => (
								<button
									key={o.v}
									type="button"
									onClick={() => setOutcome(o.v)}
									className="border-r border-b border-line px-4 py-3 text-left font-mono text-[12px] tracking-[0.06em] text-ink-dim uppercase even:border-r-0 active:bg-panel-2"
								>
									{o.label()}
								</button>
							))}
						</div>
					) : (
						<Row size="sm">
							<span className="min-w-0 flex-1 font-mono text-[12px] text-teal">
								{m.rd_outcome_saved()}
							</span>
						</Row>
					)}
				</SubBand>

				<RowButton size="sm" onClick={() => setAnswers({})}>
					<span className="inst-label-xs flex-1 text-left text-flag">{m.td_recheck()}</span>
					<span className="font-mono text-[12px] text-flag">↻</span>
				</RowButton>
			</Band>

			{/* ── PRESCRIPTION ────────────────────────────────────────────────── */}
			<Band
				label={m.train_target()}
				reading={
					<span style={{ color: today.day.color }}>
						{today.day.type} · {today.day.load}
					</span>
				}
			>
				<Row size="sm">
					<span className="inst-label-xs w-[84px] shrink-0">{m.wk_protocol()}</span>
					<span className="min-w-0 flex-1 text-[13px] text-ink-dim">{today.day.prime}</span>
				</Row>
				<Row size="sm">
					<span className="inst-label-xs w-[84px] shrink-0">{m.prog_phase()}</span>
					<span className="min-w-0 flex-1 text-[13px] text-ink-dim">{today.phase.name}</span>
				</Row>
				<Note className="border-b border-line py-2.5 text-[12.5px]">
					<Prose value={today.phase.banner} />
				</Note>

				{today.isRestDay ? (
					<Note className="border-b border-line py-3 text-teal">{m.td_rest_day()}</Note>
				) : (
					<>
						{active.map((t) => (
							<Row
								key={t.exId}
								tone={t.done ? 'done' : 'plain'}
								channel={content.exercises[t.exId]?.catVar}
							>
								<span aria-hidden className="w-0.5 shrink-0" />
								<Tick
									checked={t.done}
									label={t.label}
									onChange={(next) => setDone((d) => ({ ...d, [t.exId]: next }))}
								/>
								<span
									className={cn(
										'min-w-0 flex-1 text-[14.5px]',
										t.done && 'text-ink-faint line-through',
									)}
								>
									{t.label}
								</span>
								{t.done ? (
									<Tag tone="teal">{m.lbl_done()}</Tag>
								) : (
									<Link
										to="/train"
										className="inst-label-xs shrink-0 text-flag"
										aria-label={`${m.td_open_train()} · ${t.label}`}
									>
										{m.td_open_train()} →
									</Link>
								)}
							</Row>
						))}
						{allDone ? (
							<Note className="border-b border-line py-3 text-teal">{m.td_all_done()}</Note>
						) : null}
					</>
				)}

				{/* Held work: shown, never hidden. The sub-legend carries the reason, so
				    the rows themselves stay legible instead of being dimmed into an
				    unreadable tier. */}
				{heldTasks.length ? (
					<SubBand label={m.td_held()} reading={String(heldTasks.length)}>
						{heldTasks.map((t) => (
							<Row key={t.exId} tone="held" size="sm" channel={content.exercises[t.exId]?.catVar}>
								<span aria-hidden className="w-0.5 shrink-0" />
								<span className="min-w-0 flex-1 text-[14px]">{t.label}</span>
								<span className="inst-label-xs shrink-0 truncate">{verdict?.tag}</span>
							</Row>
						))}
					</SubBand>
				) : null}

				{/* Carry-forward from the untrained day. */}
				{today.missed ? (
					carried ? (
						<SubBand label={m.td_missed_do()} reading={today.missed.weekdayLabel}>
							{carriedLabels.map((label) => (
								<Row key={label} size="sm">
									<span className="min-w-0 flex-1 text-[14px] text-ink-dim">{label}</span>
									<Tag tone="gold">+</Tag>
								</Row>
							))}
						</SubBand>
					) : (
						<div className="border-b border-line px-4 py-3">
							<p className="text-[13px] text-ink-dim">
								{m.td_missed({ day: today.missed.weekdayLabel })}
							</p>
							<button
								type="button"
								onClick={() => setCarried(true)}
								className="mt-2.5 border border-gold/60 px-3 py-1.5 font-mono text-[11px] tracking-[0.1em] text-gold uppercase active:bg-panel-2"
							>
								{m.td_missed_do()}
							</button>
						</div>
					)
				) : null}
			</Band>

			{/* ── THE CHECK ───────────────────────────────────────────────────── */}
			<Band label={m.log_readiness()} reading={`${answered}/${questions.length}`}>
				{questions.map((q, i) => {
					const source = content.quiz.find((x) => x.id === q.id);
					if (!source) return null;
					return (
						<QuestionBlock
							key={q.id}
							index={q.sub ? null : i + 1}
							sub={q.sub}
							question={source.q}
							why={source.why}
							studyHref={studyUrl(source.study)}
							options={source.a.map((o) => ({ label: o.t, value: o.v }))}
							answer={answers[q.id] ?? null}
							onPick={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))}
						/>
					);
				})}
			</Band>

			{/* ── TREND ───────────────────────────────────────────────────────── */}
			<Band label={m.readiness_trend()} reading={`n=${today.trendPoints.length}`}>
				<div className="border-b border-line pt-1 pb-3">
					<Trace points={today.trendPoints} baseline={insights.baseline} color={readingColor} />
				</div>
			</Band>

			{/* ── RECORD ──────────────────────────────────────────────────────── */}
			<Band label={m.log_workouts()} reading={m.week_label({ n: today.week })}>
				<div className="grid grid-cols-3 border-b border-line">
					<StatCell value={String(today.stats.streak)} label={m.stat_streak()} accent />
					<StatCell value={`${today.stats.last7}/7`} label={m.stat_week_sessions()} />
					<StatCell value={String(today.stats.total)} label={m.stat_total()} last />
				</div>

				<SubBand label={m.field_bodyweight()} reading={`${today.bodyweight.latestKg} kg`}>
					{today.bodyweight.promptToday && !bwLogged ? (
						<Row size="sm">
							<span className="min-w-0 flex-1 text-[13px] text-ink-dim">{m.bw_prompt()}</span>
							<input
								type="number"
								inputMode="decimal"
								step="any"
								aria-label={m.field_bodyweight()}
								value={bwInput}
								onChange={(e) => setBwInput(e.currentTarget.value)}
								className="w-14 shrink-0 border-b border-line-2 bg-transparent py-1 text-center font-mono text-[16px] text-ink outline-none focus:border-flag"
							/>
							<span className="inst-label-xs shrink-0">kg</span>
							<button
								type="button"
								onClick={() => {
									if (bwInput !== '') setBwLogged(true);
								}}
								className="shrink-0 border border-line-2 px-2 py-1.5 font-mono text-[11px] tracking-[0.08em] text-ink uppercase active:bg-panel-2"
							>
								{m.btn_save()}
							</button>
						</Row>
					) : (
						<Row size="sm">
							<span className="min-w-0 flex-1 font-mono text-[12px] text-teal">
								{m.toast_metric_saved({ name: m.field_bodyweight() })}
							</span>
						</Row>
					)}
					<div className="flex gap-5 overflow-x-auto border-b border-line px-4 py-2.5">
						{today.bodyweight.series.map((p) => (
							<div key={`${p.at ?? p.date}`} className="shrink-0">
								<div className="font-mono text-[13px] text-chalk">{p.v}</div>
								<div className="inst-label-xs">{p.date}</div>
							</div>
						))}
					</div>
				</SubBand>
			</Band>

			{/* ── WATCH-OUTS ──────────────────────────────────────────────────── */}
			{reading?.flags.length ? (
				<Band label={m.flags_heading()} reading={String(reading.flags.length)}>
					{reading.flags.map((f) => {
						const c = content.flags[f.id];
						if (!c) return null;
						return (
							<div key={f.id} className="border-b border-line">
								<div className="flex items-center gap-2.5 px-4 pt-3">
									<span
										aria-hidden
										className="size-2.5 shrink-0"
										style={{
											background:
												f.severity === 'stop'
													? 'var(--flag)'
													: f.severity === 'warn'
														? 'var(--gold)'
														: 'var(--ink-faint)',
										}}
									/>
									<span className="min-w-0 flex-1 text-[14.5px] font-semibold text-ink">
										{c.title}
									</span>
									<span className="inst-label-xs shrink-0">{f.severity}</span>
								</div>
								<Note className="pt-1.5 text-[13px]">
									<Prose value={c.text} />
								</Note>
								<div className="flex flex-wrap gap-1.5 px-4 pt-2.5 pb-3">
									{c.focus.map((x) => (
										<Tag key={x}>{plain(x)}</Tag>
									))}
								</div>
								{f.area ? (
									<div className="grid grid-cols-3 border-t border-line">
										<FlagAction label={m.flag_deep()} />
										<FlagAction label={m.flag_rehab_today()} />
										<FlagAction label={m.flag_rehab_plan()} last />
									</div>
								) : null}
							</div>
						);
					})}
				</Band>
			) : null}

			{/* ── RECOVERY ────────────────────────────────────────────────────── */}
			<Band label={m.rehab_title()} reading={today.rehab ? m.rehab_active() : '—'}>
				<Note className="border-b border-line py-3 text-[13px]">{m.rehab_desc()}</Note>
				<RehabControl />
				<DeepCheck
					area={today.deep.area}
					assessment={today.deep.assessment}
					last={today.deep.last}
				/>
			</Band>

			<div className="h-8" />
		</Panel>
	);
}

function StatCell({
	value,
	label,
	accent,
	last,
}: {
	value: string;
	label: string;
	accent?: boolean;
	last?: boolean;
}) {
	return (
		<div className={cn('px-3 py-3.5', !last && 'border-r border-line')}>
			<div
				className={cn(
					'font-mono text-[26px] leading-none font-bold',
					accent ? 'text-flag' : 'text-chalk',
				)}
			>
				{value}
			</div>
			<div className="inst-label-xs mt-1.5 leading-[1.25] break-words">{label}</div>
		</div>
	);
}

function FlagAction({ label, last }: { label: string; last?: boolean }) {
	return (
		<button
			type="button"
			className={cn(
				'inst-label-xs px-2 py-3 text-center leading-[1.25] text-ink-dim active:bg-panel-2',
				!last && 'border-r border-line',
			)}
		>
			{label}
		</button>
	);
}

/**
 * One question of the readiness check.
 *
 * Options are full-width ruled lines rather than a wrapped grid of chips, and
 * that is the single biggest pt-BR win in the direction: an option never
 * competes for horizontal space, so "Mal consegui dormir" occupies exactly the
 * one line "Barely slept" does. A chip grid reflows into a ragged
 * two-and-a-half rows under Portuguese; a ruled list cannot.
 */
function QuestionBlock({
	index,
	sub,
	question,
	why,
	studyHref,
	options,
	answer,
	onPick,
}: {
	index: number | null;
	sub: boolean;
	question: string;
	why?: string;
	studyHref?: string;
	options: { label: string; value: number }[];
	answer: number | null;
	onPick: (v: number) => void;
}) {
	return (
		<div className={cn('border-b border-line', sub && 'border-l-2 border-l-flag/50 bg-panel/50')}>
			<div className="flex items-baseline gap-2 px-4 pt-3">
				<span className="shrink-0 font-mono text-[11px] text-flag">
					{sub ? '↳' : String(index).padStart(2, '0')}
				</span>
				<span className="min-w-0 flex-1 text-[14.5px] leading-snug font-medium text-ink">
					{question}
				</span>
			</div>
			{why ? (
				<p className="px-4 pt-1.5 pb-2 pl-[34px] text-[12px] leading-snug text-ink-faint">
					{why}
					{studyHref ? (
						<a
							href={studyHref}
							target="_blank"
							rel="noopener noreferrer"
							className="ml-1.5 font-mono text-[11px] whitespace-nowrap text-flag underline underline-offset-2"
						>
							{m.rd_evidence()}
						</a>
					) : null}
				</p>
			) : null}
			<div className="pt-1 pl-[18px]">
				{options.map((o) => (
					<Choice
						key={o.value}
						label={o.label}
						selected={answer === o.value}
						onSelect={() => onPick(o.value)}
					/>
				))}
			</div>
		</div>
	);
}

/** The rehab entry point: pick an area and a stage, switch the program over,
 *  switch it back. Ruled option lists for the same reason the readiness options
 *  are — the stage descriptions are full sentences in both locales and there is
 *  no chip that holds one. */
function RehabControl() {
	const [open, setOpen] = useState(false);
	const [active, setActive] = useState(false);
	const [area, setArea] = useState<RehabArea>('fingers');
	const [stage, setStage] = useState<RehabStage>('acute');

	if (active) {
		return (
			<>
				<Row size="sm">
					<span className="min-w-0 flex-1 font-mono text-[12px] tracking-[0.06em] text-gold uppercase">
						{m.rehab_banner({
							area: REHAB_AREAS.find((a) => a.id === area)?.label() ?? area,
							stage: REHAB_STAGES.find((s) => s.id === stage)?.label() ?? stage,
						})}
					</span>
				</Row>
				<RowButton size="sm" onClick={() => setActive(false)}>
					<span className="inst-label-xs flex-1 text-left text-flag">{m.rehab_end()}</span>
				</RowButton>
			</>
		);
	}

	if (!open) {
		return (
			<RowButton size="sm" onClick={() => setOpen(true)}>
				<span className="inst-label-xs flex-1 text-left text-flag">{m.rehab_start()}</span>
				<span className="font-mono text-[12px] text-flag">+</span>
			</RowButton>
		);
	}

	return (
		<>
			<SubBand label={m.rehab_area()}>
				{REHAB_AREAS.map((a) => (
					<Choice
						key={a.id}
						label={a.label()}
						selected={area === a.id}
						onSelect={() => setArea(a.id)}
					/>
				))}
			</SubBand>
			<SubBand label={m.rehab_stage()}>
				{REHAB_STAGES.map((s) => (
					<div key={s.id}>
						<Choice label={s.label()} selected={stage === s.id} onSelect={() => setStage(s.id)} />
						<p className="border-b border-line px-4 pb-2 pl-[30px] text-[12px] text-ink-faint">
							{s.desc()}
						</p>
					</div>
				))}
			</SubBand>
			<RowButton
				size="sm"
				onClick={() => {
					setActive(true);
					setOpen(false);
				}}
			>
				<span className="inst-label-xs flex-1 text-left text-flag">{m.rehab_apply()}</span>
				<span className="font-mono text-[12px] text-flag">→</span>
			</RowButton>
		</>
	);
}

/** The injury self-check. Expands in place rather than opening a sheet: nothing
 *  in this direction floats, and a modal would have been the one rounded surface
 *  hovering over a design whose whole argument is that the panel is flat. */
function DeepCheck({
	area,
	assessment,
	last,
}: {
	area: FlagArea;
	assessment: ReturnType<typeof getContent>['deep'][string];
	last: { date: string; score: number; band: string };
}) {
	const [open, setOpen] = useState(false);
	const [values, setValues] = useState<Record<string, number>>({});

	const given = assessment.questions.map((q) => values[q.id]).filter((v) => v != null);
	const result = given.length === assessment.questions.length ? scoreDeep(given) : null;

	return (
		<SubBand
			label={m.flag_deep()}
			reading={REHAB_AREAS.find((a) => a.id === area)?.label() ?? area}
		>
			{/* The title row is the trigger. A separate "open" row underneath would
			    have repeated the legend three times over on one screen — the cost of
			    a design whose only grouping device is a label. */}
			<RowButton size="sm" onClick={() => setOpen((o) => !o)}>
				<span className="min-w-0 flex-1 text-[13px] text-ink-dim">{assessment.title}</span>
				<span className="inst-label-xs shrink-0">
					{m.deep_last({ score: last.score, date: last.date })}
				</span>
				<span className="shrink-0 font-mono text-[13px] text-flag">{open ? '−' : '+'}</span>
			</RowButton>
			{open ? (
				<>
					<Note className="border-b border-line py-2.5 text-[12.5px]">{assessment.intro}</Note>
					{assessment.questions.map((q) => (
						<div key={q.id} className="border-b border-line">
							<div className="px-4 pt-2.5 text-[14px] font-medium text-ink">{q.q}</div>
							<div className="pt-1 pl-[18px]">
								{q.a.map((o) => (
									<Choice
										key={o.t}
										label={o.t}
										selected={values[q.id] === o.v}
										onSelect={() => setValues((v) => ({ ...v, [q.id]: o.v }))}
									/>
								))}
							</div>
						</div>
					))}
					{result ? (
						<>
							<div className="flex items-center gap-4 border-b border-line bg-panel px-4 py-3">
								<Readout value={result.score} unit="/100" size="md" />
								<div className="min-w-0 flex-1">
									<Tag
										tone={
											result.band === 'manageable'
												? 'teal'
												: result.band === 'moderate'
													? 'gold'
													: 'flag'
										}
									>
										{DEEP_BAND_LABEL[result.band]?.() ?? result.band}
									</Tag>
									<div className="inst-label-xs mt-1.5">{m.deep_result()}</div>
								</div>
							</div>
							<Note className="border-b border-line py-3 text-[13px]">
								{DEEP_REC[result.band]?.() ?? ''}
							</Note>
							<div className="grid grid-cols-2 border-b border-line">
								<button
									type="button"
									className="inst-label-xs border-r border-line px-2 py-3 text-center text-flag active:bg-panel-2"
								>
									{m.deep_start_rehab()}
								</button>
								<button
									type="button"
									className="inst-label-xs px-2 py-3 text-center text-ink-dim active:bg-panel-2"
								>
									{m.deep_save()}
								</button>
							</div>
						</>
					) : null}
					<Row size="sm">
						<span className="min-w-0 flex-1 text-[11.5px] leading-snug text-ink-faint">
							{m.deep_based_on({ source: assessment.source })}
						</span>
						<a
							href={assessment.url}
							target="_blank"
							rel="noopener noreferrer"
							className="inst-label-xs shrink-0 text-flag underline underline-offset-2"
						>
							{m.deep_source_link()}
						</a>
					</Row>
				</>
			) : null}
		</SubBand>
	);
}
