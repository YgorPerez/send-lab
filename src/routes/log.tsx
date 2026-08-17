// LOG — Direction D.
//
// The screen that argues with the direction. 28 sessions, 14 readiness checks
// and 8 activity rows, at sizes chosen for chalky hands: 28 accordion headers at
// 76px is over five screens of scrolling before anything is even opened, and
// that is with the bodies closed.
//
// Two things absorb it, and both are compromises worth naming on the ticket:
//
//  • The three lists are separated by a rocker rather than stacked, so the
//    screen is one list deep instead of three. That is navigation added to buy
//    back density — the exact move the redesign is supposed to be removing.
//  • Inside an opened session, a set is a single mono line rather than the field
//    grid Train uses. The set grid does not survive at log density. Reading and
//    editing are not the same job, and this direction only makes the editing one
//    big.
import { Accordion } from '@base-ui/react/accordion';
import { Tabs } from '@base-ui/react/tabs';
import { createFileRoute } from '@tanstack/react-router';
import { ChevronDown } from 'lucide-react';
import { useMemo, useState } from 'react';
import * as m from '$lib/paraglide/messages';
import type { WorkoutSet } from '$lib/types';
import { Head, Panel, pill } from '../components/physical';
import {
	getPrototypeFixtures,
	type LoggedSessionFixture,
	type SetField,
} from '../prototype-fixtures';

export const Route = createFileRoute('/log')({ component: Log });

/** Units, not copy — they read the same in both locales. */
const UNIT: Partial<Record<SetField, string>> = {
	weight: 'kg',
	edge: 'mm',
	time: 's',
	rest: 's',
	reps: '×',
	rpe: 'RPE',
};

/** One logged set on one line. The dense form; Train has the big one. */
function setLine(set: WorkoutSet, fields: SetField[]): string {
	return fields
		.map((field) => {
			if (field === 'grip') return set.grip ?? null;
			const value = set[field];
			if (value == null) return null;
			return field === 'rpe' ? `RPE ${value}` : `${value}${UNIT[field] ?? ''}`;
		})
		.filter(Boolean)
		.join(' · ');
}

const OUTCOME_LABEL: Record<number, () => string> = {
	0: () => m.rd_outcome_bailed(),
	1: () => m.rd_outcome_flat(),
	2: () => m.rd_outcome_ok(),
	3: () => m.rd_outcome_strong(),
};

const ACTIVITY_LABEL: Record<string, () => string> = {
	rec: () => m.log_type_rec(),
	day: () => m.log_type_day(),
	test: () => m.log_type_test(),
};

function Log() {
	const fx = useMemo(() => getPrototypeFixtures(), []);
	const log = fx.log;
	const [tab, setTab] = useState('workouts');

	const tabs = [
		{ value: 'workouts', label: m.log_workouts(), count: log.sessions.length },
		{ value: 'readiness', label: m.log_readiness(), count: log.readiness.length },
		{ value: 'activity', label: m.log_activity(), count: log.activity.length },
	];

	return (
		<Tabs.Root value={tab} onValueChange={(next) => setTab(String(next))} className="mt-3">
			{/* A rocker, not a row of text tabs: three 64px slabs, thumb-sized. */}
			<Tabs.List className="well flex gap-1 rounded-lg p-1">
				{tabs.map((entry) => (
					<Tabs.Tab
						key={entry.value}
						value={entry.value}
						// The selected slab is computed here rather than through a
						// `data-selected:` variant: `slab` is a custom utility and the
						// variant would have to generate it, which is fragile enough to
						// be worth not relying on for the direction's core surface.
						className={`flex h-16 flex-1 flex-col items-center justify-center gap-0.5 rounded-md transition-transform duration-75 active:translate-y-[1px] ${
							tab === entry.value ? 'slab text-ink' : 'text-ink-faint'
						}`}
					>
						<span className="max-w-full truncate px-1 text-[13px] leading-tight font-semibold tracking-tight">
							{entry.label}
						</span>
						<span className="font-mono text-[11px] leading-none">{entry.count}</span>
					</Tabs.Tab>
				))}
			</Tabs.List>

			<Tabs.Panel value="workouts">
				<Head right={<span>{m.sessions_count({ n: log.sessions.length })}</span>}>
					{m.log_workouts()}
				</Head>
				<Accordion.Root multiple={false} className="flex flex-col gap-2">
					{log.sessions.map((session) => (
						<SessionRow key={session.iso} session={session} />
					))}
				</Accordion.Root>
			</Tabs.Panel>

			<Tabs.Panel value="readiness">
				<Head right={<span>{log.readiness.length}</span>}>{m.log_readiness()}</Head>
				<Accordion.Root multiple={false} className="flex flex-col gap-2">
					{log.readiness.map((entry) => (
						<Accordion.Item
							key={entry.iso}
							value={entry.iso}
							className="slab overflow-hidden rounded-lg"
						>
							<Accordion.Header>
								<Accordion.Trigger className="group flex w-full items-center gap-3 px-3 py-3 text-left transition-transform duration-75 active:translate-y-[1px]">
									<span className="well flex size-14 shrink-0 flex-col items-center justify-center rounded-md">
										<span className="font-mono text-[20px] leading-none font-bold text-flag">
											{entry.score}
										</span>
									</span>
									<span className="min-w-0 flex-1">
										<span className="block text-[16px] leading-tight font-bold tracking-tight text-ink">
											{entry.verdict.title}
										</span>
										<span className="mt-0.5 block font-mono text-[11px] tracking-wider text-ink-faint uppercase">
											{entry.dateLabel} · {entry.timeLabel}
										</span>
									</span>
									<ChevronDown
										className="size-6 shrink-0 text-ink-faint transition-transform group-data-[panel-open]:rotate-180"
										strokeWidth={2.5}
									/>
								</Accordion.Trigger>
							</Accordion.Header>
							<Accordion.Panel className="px-3 pb-3">
								<p className="font-mono text-[10px] tracking-wider text-ink-faint uppercase">
									{m.log_rd_responses()}
								</p>
								<dl className="mt-1">
									{entry.responses.map((response) => (
										<div
											key={response.question}
											className="flex gap-2 border-b border-line py-1.5 last:border-0"
										>
											<dt className="min-w-0 flex-1 text-[13px] leading-snug text-ink-dim">
												{response.question}
											</dt>
											<dd className="shrink-0 text-[13px] leading-snug font-semibold text-ink">
												{response.answer}
											</dd>
										</div>
									))}
								</dl>
								<p className="mt-2 font-mono text-[10px] tracking-wider text-ink-faint uppercase">
									{m.log_rd_conclusion()}
								</p>
								<div className="mt-1 flex flex-wrap gap-1.5">
									<span className={pill({ tone: 'gold' })}>{entry.verdict.tag}</span>
									{entry.flagTitles.map((title) => (
										<span key={title} className={pill({ tone: 'hot' })}>
											{title}
										</span>
									))}
									{entry.outcome == null ? null : (
										<span className={pill({ tone: 'teal' })}>
											{OUTCOME_LABEL[entry.outcome]?.() ?? entry.outcome}
										</span>
									)}
								</div>
							</Accordion.Panel>
						</Accordion.Item>
					))}
				</Accordion.Root>
			</Tabs.Panel>

			<Tabs.Panel value="activity">
				<Head right={<span>{log.activity.length}</span>}>{m.log_activity()}</Head>
				<div className="flex flex-col gap-2">
					{log.activity.map((entry, index) => (
						<Panel
							// Activity rows carry no id and repeat dates, so position is the
							// only identity the fixture offers.
							// biome-ignore lint/suspicious/noArrayIndexKey: fixture rows have no id
							key={index}
							accent={entry.color}
							className="flex items-center gap-3 py-3 pr-3 pl-5"
						>
							<span className={pill({ tone: 'chalk' })}>
								{ACTIVITY_LABEL[entry.type]?.() ?? entry.type}
							</span>
							<span className="min-w-0 flex-1">
								<span className="block text-[15px] leading-tight font-semibold text-ink">
									{entry.label}
								</span>
								{entry.note ? (
									<span className="mt-0.5 block text-[12px] leading-snug text-ink-dim">
										{entry.note}
									</span>
								) : null}
							</span>
							<span className="shrink-0 font-mono text-[11px] text-ink-faint">{entry.date}</span>
						</Panel>
					))}
				</div>
			</Tabs.Panel>
		</Tabs.Root>
	);
}

function SessionRow({ session }: { session: LoggedSessionFixture }) {
	return (
		<Accordion.Item value={session.iso} className="slab overflow-hidden rounded-lg">
			<Accordion.Header>
				<Accordion.Trigger className="group flex w-full items-center gap-3 px-3 py-3 text-left transition-transform duration-75 active:translate-y-[1px]">
					<span className="well flex size-14 shrink-0 flex-col items-center justify-center rounded-md">
						<span className="font-mono text-[11px] leading-none tracking-wider text-ink-faint uppercase">
							{session.weekdayLabel}
						</span>
						<span className="mt-1 font-mono text-[13px] leading-none font-bold text-chalk">
							{session.dateLabel}
						</span>
					</span>
					<span className="min-w-0 flex-1">
						<span className="block text-[16px] leading-tight font-bold tracking-tight text-ink">
							{session.dayType}
						</span>
						<span className="mt-0.5 block font-mono text-[11px] tracking-wider text-ink-faint uppercase">
							{m.sets_count({ n: session.setCount })}
							{session.durationMin == null ? '' : ` · ${session.durationMin} min`}
						</span>
					</span>
					<ChevronDown
						className="size-6 shrink-0 text-ink-faint transition-transform group-data-[panel-open]:rotate-180"
						strokeWidth={2.5}
					/>
				</Accordion.Trigger>
			</Accordion.Header>
			<Accordion.Panel className="px-3 pb-3">
				{session.exercises.map((exercise) => (
					<div key={exercise.exId} className="mt-2 first:mt-0">
						<p className="text-[14px] leading-tight font-semibold text-ink">{exercise.name}</p>
						<ul className="mt-1">
							{exercise.sets.map((set, index) => (
								<li
									// biome-ignore lint/suspicious/noArrayIndexKey: append-only list, no stable id in the fixture
									key={index}
									className="flex items-center gap-2 border-b border-line py-1 last:border-0"
								>
									<span className="w-6 shrink-0 font-mono text-[11px] text-ink-faint">
										{index + 1}
									</span>
									<span className="min-w-0 flex-1 truncate font-mono text-[12px] text-ink-dim">
										{setLine(set, exercise.fields)}
									</span>
									<span
										className="size-2.5 shrink-0 rounded-full"
										style={{ background: set.done ? 'var(--teal)' : 'var(--line)' }}
									/>
								</li>
							))}
						</ul>
					</div>
				))}
				{session.note ? (
					<p className="mt-3 border-t border-line pt-2 text-[13px] leading-snug text-ink-dim">
						{session.note}
					</p>
				) : null}
			</Accordion.Panel>
		</Accordion.Item>
	);
}
