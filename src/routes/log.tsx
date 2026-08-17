// LOG — the strip chart.
//
// This is the screen that punishes low density: fourteen readiness checks,
// twenty-eight sessions and an activity list, on a 360px phone. The instrument
// answer is a ledger — every entry is one ruled line whose *left* column is the
// reading (a score, a date) and whose right column is the disclosure glyph, with
// the detail unrolling underneath between the same rules. Forty pixels a row,
// no card, no gap, no shadow: roughly twice the entries per screen the old
// card-per-entry list managed.
//
// The disclosure glyph is `+` / `−` rather than a chevron. A chevron is a
// direction; a plus is a state, which is what an expandable ledger line has.
import { Accordion } from '@base-ui/react/accordion';
import { createFileRoute } from '@tanstack/react-router';
import { getContent } from '$lib/content';
import { gripLabel, SET_FIELD_LABEL } from '$lib/formatSpec';
import * as m from '$lib/paraglide/messages';
import { usePrototype } from '$lib/prototypeSnapshot';
import type { WorkoutSet } from '$lib/types';
import { cn } from '$lib/utils';
import { Band, Note, Row, Tag } from '../components/instrument';
import { Panel, ScreenHead } from '../components/Panel';
import type { SetField } from '../prototype-fixtures';

export const Route = createFileRoute('/log')({ component: LogScreen });

/** 0 bailed · 1 flat · 2 as expected · 3 strong. */
const OUTCOME_LABEL = [
	() => m.rd_outcome_bailed(),
	() => m.rd_outcome_flat(),
	() => m.rd_outcome_ok(),
	() => m.rd_outcome_strong(),
];

const TYPE_LABEL: Record<string, () => string> = {
	rec: m.log_type_rec,
	day: m.log_type_day,
	test: m.log_type_test,
};

function LogScreen() {
	const { log } = usePrototype();
	const content = getContent();

	return (
		<Panel>
			<ScreenHead
				title={m.nav_log()}
				context={`${log.sessions.length} · ${log.readiness.length} · ${log.activity.length}`}
			/>

			{/* ── READINESS CHECKS ────────────────────────────────────────────── */}
			<Band label={m.log_readiness()} reading={String(log.readiness.length)}>
				<Accordion.Root className="border-t border-line">
					{log.readiness.map((r) => (
						<Accordion.Item key={r.iso} value={r.iso} className="border-b border-line">
							<Accordion.Header>
								<Accordion.Trigger className="group flex w-full items-center gap-3 px-4 py-2.5 text-left active:bg-panel">
									<span
										className="w-8 shrink-0 font-mono text-[17px] leading-none font-bold"
										style={{ color: r.verdict.color }}
									>
										{r.score}
									</span>
									<span className="min-w-0 flex-1">
										<span className="inst-label-xs block">
											{r.dateLabel} · {r.timeLabel}
										</span>
										<span className="mt-0.5 block truncate text-[13px] text-ink">
											{r.verdict.title}
										</span>
									</span>
									{r.outcome != null ? (
										<Tag tone="quiet">{OUTCOME_LABEL[r.outcome]?.() ?? ''}</Tag>
									) : null}
									<Glyph />
								</Accordion.Trigger>
							</Accordion.Header>
							<Accordion.Panel className="border-t border-line bg-panel/60">
								<div className="px-4 py-2.5">
									<div className="inst-label-xs pb-1.5">{m.log_rd_responses()}</div>
									{r.responses.map((q) => (
										<div
											key={q.question}
											className="flex items-baseline justify-between gap-3 border-b border-line py-1.5 last:border-b-0"
										>
											<span className="min-w-0 flex-1 text-[12.5px] text-ink-dim">
												{q.question}
											</span>
											<span className="shrink-0 font-mono text-[12px] text-chalk">{q.answer}</span>
										</div>
									))}
								</div>
								<div className="border-t border-line px-4 py-2.5">
									<div className="inst-label-xs pb-1.5">{m.log_rd_conclusion()}</div>
									<div className="flex flex-wrap items-center gap-1.5">
										<Tag tone="ink">{r.verdict.tag}</Tag>
										{r.flagTitles.map((t) => (
											<Tag key={t} tone="gold">
												{t}
											</Tag>
										))}
									</div>
								</div>
							</Accordion.Panel>
						</Accordion.Item>
					))}
				</Accordion.Root>
			</Band>

			{/* ── SESSIONS ────────────────────────────────────────────────────── */}
			<Band label={m.log_workouts()} reading={String(log.sessions.length)}>
				<Accordion.Root className="border-t border-line">
					{log.sessions.map((s) => (
						<Accordion.Item key={s.iso} value={s.iso} className="border-b border-line">
							<Accordion.Header>
								<Accordion.Trigger className="group flex w-full items-center gap-3 px-4 py-2.5 text-left active:bg-panel">
									<span className="w-[52px] shrink-0 font-mono text-[12px] text-ink-faint">
										{s.dateLabel}
									</span>
									<span className="min-w-0 flex-1">
										<span className="block truncate text-[13.5px] text-ink">{s.dayType}</span>
										<span className="inst-label-xs mt-0.5 block">
											{s.exercises.length}× · {s.setCount} {m.stats_sets()}
											{s.durationMin != null ? ` · ${s.durationMin}′` : ''}
										</span>
									</span>
									{s.note ? <Tag tone="quiet">≡</Tag> : null}
									<Glyph />
								</Accordion.Trigger>
							</Accordion.Header>
							<Accordion.Panel className="border-t border-line bg-panel/60">
								{s.exercises.map((ex) => (
									<div key={ex.exId} className="border-b border-line px-4 py-2.5 last:border-b-0">
										<div
											className="mb-1.5 pl-2 text-[13px] font-semibold text-chalk"
											style={{
												boxShadow: `inset 3px 0 0 0 var(${content.exercises[ex.exId]?.catVar ?? '--line-2'})`,
											}}
										>
											{ex.name}
										</div>
										<ReadOnlySets fields={ex.fields.filter((f) => f !== 'grip')} sets={ex.sets} />
									</div>
								))}
								{s.note ? (
									<Note className="border-t border-line py-2.5 text-[12.5px] italic">
										“{s.note}”
									</Note>
								) : null}
							</Accordion.Panel>
						</Accordion.Item>
					))}
				</Accordion.Root>
			</Band>

			{/* ── ACTIVITY ────────────────────────────────────────────────────── */}
			<Band label={m.log_activity()} reading={String(log.activity.length)}>
				{log.activity.length === 0 ? (
					<Note className="py-8 text-center">{m.log_empty()}</Note>
				) : (
					log.activity.map((e, i) => (
						<Row
							// biome-ignore lint/suspicious/noArrayIndexKey: the activity list has no id and can repeat a date + type
							key={`${e.date}-${e.type}-${i}`}
							size="sm"
						>
							<span className="inst-label-xs w-[52px] shrink-0">{e.date}</span>
							<span
								className="shrink-0 border px-1.5 py-[3px] font-mono text-[10px] leading-none tracking-[0.08em] uppercase"
								style={{ color: e.color, borderColor: e.color }}
							>
								{TYPE_LABEL[e.type]?.() ?? e.type}
							</span>
							<span className="min-w-0 flex-1">
								<span className="block truncate text-[13px] text-ink">{e.label}</span>
								{e.note ? (
									<span className="mt-0.5 block truncate text-[12px] text-ink-faint">{e.note}</span>
								) : null}
							</span>
						</Row>
					))
				)}
			</Band>

			<div className="h-8" />
		</Panel>
	);
}

/** The disclosure state, as a glyph that flips rather than a chevron that turns. */
function Glyph() {
	return (
		<span
			aria-hidden
			className="shrink-0 font-mono text-[13px] text-ink-faint group-data-[panel-open]:text-flag"
		>
			<span className="group-data-[panel-open]:hidden">+</span>
			<span className="hidden group-data-[panel-open]:inline">−</span>
		</span>
	);
}

/** A logged session's sets, read-only: the same column grid the Train screen
 *  types into, without the inputs. The point is that the athlete recognises the
 *  shape — the log is the same instrument, in playback. */
function ReadOnlySets({ fields, sets }: { fields: SetField[]; sets: WorkoutSet[] }) {
	const cols = `14px repeat(${fields.length}, minmax(0, 1fr)) 18px`;
	return (
		<div className="min-w-0">
			<div className="grid items-center gap-x-1.5" style={{ gridTemplateColumns: cols }}>
				<span className="inst-label-xs">#</span>
				{fields.map((f) => (
					<span
						key={f}
						className="inst-label-xs min-h-[2.3em] text-center leading-[1.15] [overflow-wrap:anywhere]"
					>
						{SET_FIELD_LABEL[f]?.() ?? f}
					</span>
				))}
				<span className="inst-label-xs text-right">✓</span>
			</div>
			{sets.map((s, i) => (
				<div
					// biome-ignore lint/suspicious/noArrayIndexKey: a logged session is immutable history; the index is the set number
					key={i}
					className="grid items-center gap-x-1.5 border-t border-line py-1"
					style={{ gridTemplateColumns: cols }}
				>
					<span className="font-mono text-[11px] text-ink-faint">{i + 1}</span>
					{fields.map((f) => (
						<span
							key={f}
							className={cn(
								'text-center font-mono text-[13px]',
								s[f as 'weight'] == null ? 'text-ink-faint' : 'text-chalk',
							)}
						>
							{s[f as 'weight'] ?? '–'}
						</span>
					))}
					<span className="text-right font-mono text-[12px]">
						{s.done ? (
							<span className="text-teal">■</span>
						) : (
							<span className="text-ink-faint">□</span>
						)}
					</span>
				</div>
			))}
			{sets[0]?.grip ? (
				<div className="mt-1 flex items-baseline gap-2">
					<span className="inst-label-xs">{m.field_grip()}</span>
					<span className="font-mono text-[12px] text-ink-dim">{gripLabel(sets[0].grip)}</span>
				</div>
			) : null}
		</div>
	);
}
