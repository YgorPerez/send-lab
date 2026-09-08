// The prescription resolver: what a slot runs, and at what numbers.
//
// These are worked examples, not recomputations. Every expected value below is
// either a literal read off `content/en-US.ts` (the built-in week's day types and
// exercise lists) or arithmetic done by hand in the comment beside it — because
// the three functions this ticket flagged as risky (`phaseForWeek`,
// `weekCompletion`, `carryForward`) each return a *plausible* number for the
// wrong reason, and an assertion that recomputes the implementation's own
// arithmetic cannot tell a plausible answer from a right one.
//
// The resolver takes state as an argument rather than reading a store, which is
// the whole reason this file can exist without rendering anything.
import { describe, expect, test } from 'vitest';
import { getContent } from '../src/lib/content/index.ts';
import { exerciseLabel, weekdayLabel } from '../src/lib/format.ts';
import {
	asExerciseId,
	asWeekdayKey,
	asWeekId,
	overrideKey,
	slotKey,
	taskKey,
} from '../src/lib/ids.ts';
import { overwriteGetLocale } from '../src/lib/paraglide/runtime.js';
import {
	builtInDayType,
	carryForward,
	carryForwardFromYesterday,
	dayTemplate,
	effectiveVariant,
	isSlotTrained,
	phaseForWeek,
	programOverride,
	programVariantIndex,
	type ResolverState,
	resolveDayType,
	resolveExerciseIds,
	resolveSwapIndex,
	variantOf,
	weekCompletion,
} from '../src/lib/prescription.ts';
import type { Baseline, Level, Phase, Program } from '../src/lib/types.ts';

// The resolver is locale-blind — it deals in ids — but the content is not.
// `getContent` takes the locale explicitly now (#56), so these suites name the
// one they mean; the day types and exercise ids asserted below are the same
// under either. `overwriteGetLocale` is still needed for `exerciseLabel`, which
// reads the active locale to produce a display string.
overwriteGetLocale(() => 'en-US');
const content = getContent('en-US');

const MON = asWeekdayKey('Mon');
const THU = asWeekdayKey('Thu');
const TUE = asWeekdayKey('Tue');
const WED = asWeekdayKey('Wed');
const SUN = asWeekdayKey('Sun');
const W5 = asWeekId(5);
const W6 = asWeekId(6);

const ex = asExerciseId;

/** A program with nothing customized. */
function program(patch: Partial<Program> = {}): Program {
	return { weeks: 8, template: {}, overrides: {}, phases: [], autoProgress: false, ...patch };
}

/** State with nothing customized: the built-in week, no overrides, no history. */
function state(patch: Partial<ResolverState> = {}): ResolverState {
	return {
		currentWeek: asWeekId(1),
		program: program(),
		swaps: {},
		slotDayType: {},
		slotExercises: {},
		taskSwaps: {},
		workingLoads: {},
		taskDone: {},
		sessions: [],
		baseline: null,
		...patch,
	};
}

/** A baseline, for the one field the resolver reads off it. */
function baseline(level: Level): Baseline {
	return {
		goal: 'all',
		focus: 'fingers',
		level,
		daysPerWeek: 6,
		bodyweight: 72,
		equipment: ['hangboard'],
		boulderGrade: null,
		routeGrade: null,
		niggle: false,
		synovitis: false,
		birthDate: null,
		sessionMinutes: null,
		completedAt: '2026-07-01',
	};
}

describe('which day type a slot runs', () => {
	// The built-in week, read off content/en-US.ts: Mon limit-power, Tue
	// pinch-wrist, Wed endurance, Thu pull, Fri max-tissue, Sat performance,
	// Sun rest.
	test('a weekday runs its built-in day type when nothing is customized', () => {
		expect(builtInDayType(content, THU)).toBe('pull');
		expect(builtInDayType(content, SUN)).toBe('rest');
		expect(resolveDayType(content, state(), W5, THU).id).toBe('pull');
	});

	test('looks a day type up by its stable id, not by its calendar position', () => {
		// ADR-0002's whole point: `pull` is the Thursday protocol, but asking for it
		// by id has nothing to do with Thursday.
		expect(dayTemplate(content, 'pull').id).toBe('pull');
		expect(dayTemplate(content, 'max-tissue').id).toBe('max-tissue');
	});

	test('the program template overrides the built-in day type, in every week', () => {
		const s = state({ program: program({ template: { [THU]: { dayType: 'endurance' } } }) });
		expect(resolveDayType(content, s, W5, THU).id).toBe('endurance');
		expect(resolveDayType(content, s, W6, THU).id).toBe('endurance');
	});

	test('a per-slot day type overrides the template, for that one slot', () => {
		const s = state({
			program: program({ template: { [THU]: { dayType: 'endurance' } } }),
			slotDayType: { [slotKey(W5, THU)]: 'max-tissue' },
		});
		expect(resolveDayType(content, s, W5, THU).id).toBe('max-tissue');
		// The same weekday, one week over, is untouched by the slot override.
		expect(resolveDayType(content, s, W6, THU).id).toBe('endurance');
		// And so is a different weekday in the overridden week.
		expect(resolveDayType(content, s, W5, MON).id).toBe('limit-power');
	});

	test("a custom focus name replaces the day type's label but never its identity", () => {
		// ADR-0002 again, from the other side: the name is display, the id is what
		// the protocol *is*. Storing the name over the id is the overload it closed.
		const s = state({
			program: program({ template: { [THU]: { dayType: 'pull', name: 'Board night' } } }),
		});
		const day = resolveDayType(content, s, W5, THU);
		expect(day.type).toBe('Board night');
		expect(day.id).toBe('pull');
	});
});

describe('which exercises a slot runs', () => {
	test("falls back to the day type's own list", () => {
		// content/en-US.ts, the Thu `pull` day.
		expect(resolveExerciseIds(content, state(), W5, THU)).toEqual([
			ex('pull'),
			ex('slopdens'),
			ex('abra'),
			ex('antag'),
		]);
	});

	test('the template list wins over the day type default', () => {
		const s = state({
			program: program({ template: { [THU]: { dayType: 'pull', exercises: [ex('maxhang')] } } }),
		});
		expect(resolveExerciseIds(content, s, W5, THU)).toEqual([ex('maxhang')]);
	});

	test('the per-slot list wins over the template, for that one slot', () => {
		const s = state({
			program: program({ template: { [THU]: { dayType: 'pull', exercises: [ex('maxhang')] } } }),
			slotExercises: { [slotKey(W5, THU)]: [ex('pinch'), ex('antag')] },
		});
		expect(resolveExerciseIds(content, s, W5, THU)).toEqual([ex('pinch'), ex('antag')]);
		expect(resolveExerciseIds(content, s, W6, THU)).toEqual([ex('maxhang')]);
	});

	// This one is asserted because getting it wrong is invisible. `rest` is a real
	// entry in the exercise library — a "Recovery" pseudo-exercise with its own
	// prose and variants — so a filter that keeps "everything the library knows"
	// keeps it, and every rest day then counts as scheduled work. Adherence would
	// read 5/7 on a perfect week, which is plausible enough to ship. The exclusion
	// has to be by id, and this is the fact that makes that necessary.
	test('the rest placeholder is in the library, so it is excluded by id', () => {
		expect(resolveExerciseIds(content, state(), W5, SUN)).toEqual([ex('rest')]);
		expect(content.exercises[ex('rest')]).toBeDefined();
	});

	// A slot key and a task key are one `:exercise` apart, and the resolver reads
	// both records for the same slot. Keying one with the other's shape would read
	// as "not customized" rather than as an error, so the brands are load-bearing
	// here rather than decorative.
	test('reads its two per-slot records under their own key shapes', () => {
		const s = state({
			slotExercises: { [slotKey(W5, THU)]: [ex('pinch')] },
			taskDone: { [taskKey(W5, THU, ex('pinch'))]: true },
		});
		expect(resolveExerciseIds(content, s, W5, THU)).toEqual([ex('pinch')]);
	});
});

describe('which variant an exercise runs', () => {
	// The swap chain, weakest to strongest: library-wide, then per weekday of the
	// program, then the single slot.
	const PULL = ex('pull');

	test('falls back to the default variant when nothing is swapped', () => {
		expect(resolveSwapIndex(state(), W5, THU, PULL)).toBe(0);
	});

	test('a library-wide swap applies in every slot', () => {
		const s = state({ swaps: { [PULL]: 2 } });
		expect(resolveSwapIndex(s, W5, THU, PULL)).toBe(2);
		expect(resolveSwapIndex(s, W6, MON, PULL)).toBe(2);
	});

	test("the program's swap for a weekday beats the library-wide one", () => {
		const s = state({
			swaps: { [PULL]: 2 },
			program: program({ overrides: { [overrideKey(THU, PULL)]: { variant: 1 } } }),
		});
		expect(resolveSwapIndex(s, W5, THU, PULL)).toBe(1);
		// An override is keyed by weekday and carries no week, so it holds across
		// the whole block — and leaves other weekdays on the library-wide swap.
		expect(resolveSwapIndex(s, W6, THU, PULL)).toBe(1);
		expect(resolveSwapIndex(s, W5, MON, PULL)).toBe(2);
	});

	test('a per-slot swap beats both, in that slot alone', () => {
		const s = state({
			swaps: { [PULL]: 2 },
			program: program({ overrides: { [overrideKey(THU, PULL)]: { variant: 1 } } }),
			taskSwaps: { [taskKey(W5, THU, PULL)]: 3 },
		});
		expect(resolveSwapIndex(s, W5, THU, PULL)).toBe(3);
		expect(resolveSwapIndex(s, W6, THU, PULL)).toBe(1);
	});

	// `?? 0` and `!= null` are not the same test, and index 0 is the one value
	// where they disagree. A swap *back* to the default variant is a choice the
	// athlete made and has to beat a weaker swap away from it — under `||` it
	// would silently lose and the stronger swap would look like it did nothing.
	test('a swap to index 0 is a choice, not an absence', () => {
		const s = state({
			swaps: { [PULL]: 2 },
			program: program({ overrides: { [overrideKey(THU, PULL)]: { variant: 0 } } }),
		});
		expect(resolveSwapIndex(s, W5, THU, PULL)).toBe(0);

		const perSlot = state({
			swaps: { [PULL]: 2 },
			program: program({ overrides: { [overrideKey(THU, PULL)]: { variant: 1 } } }),
			taskSwaps: { [taskKey(W5, THU, PULL)]: 0 },
		});
		expect(resolveSwapIndex(perSlot, W5, THU, PULL)).toBe(0);
	});

	test("the program's own variant index ignores per-slot swaps", () => {
		// What the Program editor shows: the weekday's answer for the whole block.
		// A single slot's swap is not a change to the program.
		const s = state({
			swaps: { [PULL]: 2 },
			taskSwaps: { [taskKey(W5, THU, PULL)]: 3 },
		});
		expect(programVariantIndex(s, THU, PULL)).toBe(2);
		expect(programOverride(s, THU, PULL)).toBeUndefined();
	});

	test('an index past the end falls back to the default variant', () => {
		const pull = content.exercises[PULL];
		// content/en-US.ts: `pull` has four variants.
		expect(pull.variants).toHaveLength(4);
		expect(variantOf(pull, 99).name).toBe('Heavy weighted pull-ups + OAP');
		expect(variantOf(pull, 1).name).toBe('One-arm pull-up skill ladder');
	});

	// The reason `LoggedExercise.name` could be deleted (ADR 0012). The stored
	// half is the index; the label is produced at render, in whatever language is
	// active *then* rather than whichever one wrote the session.
	test('the label for a variant index follows the locale, not the write', () => {
		const pull = content.exercises[PULL];
		expect(exerciseLabel(pull, 1)).toBe('One-arm pull-up skill ladder');

		overwriteGetLocale(() => 'pt-BR');
		try {
			expect(exerciseLabel(getContent('pt-BR').exercises[PULL], 1)).toBe(
				'Escada de barra de 1 braço',
			);
		} finally {
			overwriteGetLocale(() => 'en-US');
		}
	});
});

describe('which phase a week falls in', () => {
	// Three phases over seven weeks, inside an eight-week block. Worked out by
	// hand, once, so the assertions below are a table rather than a re-run of the
	// accumulation the implementation does:
	//
	//   Base   3 weeks -> weeks 1, 2, 3
	//   Build  3 weeks -> weeks 4, 5, 6
	//   Peak   1 week  -> week 7
	//   week 8         -> no phase declares it
	const PHASES: Phase[] = [
		{ name: 'Base', weeks: 3, intensity: 90, volume: 110, deload: false },
		{ name: 'Build', weeks: 3, intensity: 105, volume: 100, deload: false },
		{ name: 'Peak', weeks: 1, intensity: 70, volume: 60, deload: true },
	];

	test('no phases means no phase, rather than a default one', () => {
		expect(phaseForWeek(state(), W5)).toBeNull();
	});

	test('maps every declared week to the phase that covers it', () => {
		const s = state({ program: program({ phases: PHASES }) });
		const names = [1, 2, 3, 4, 5, 6, 7].map((w) => phaseForWeek(s, asWeekId(w))?.name);
		expect(names).toEqual(['Base', 'Base', 'Base', 'Build', 'Build', 'Build', 'Peak']);
	});

	// The rule that is invisible in the data, and the one #55 struck a CONTEXT.md
	// sentence over: a block's length is *not* the sum of its phases. These phases
	// span seven weeks of an eight-week block, and week 8 is not phase-less — it
	// holds the last phase. Deleting the fallthrough would return null here, which
	// reads as "no periodization" and silently drops the deload's scaling.
	test('holds the last phase for every week past the declared span', () => {
		const s = state({ program: program({ weeks: 8, phases: PHASES }) });
		expect(phaseForWeek(s, asWeekId(8))?.name).toBe('Peak');
		expect(phaseForWeek(s, asWeekId(52))?.name).toBe('Peak');
	});

	// A phase always occupies at least one week, so a zero-week phase does not
	// vanish and does not swallow its successor's first week.
	test('a phase declared as zero weeks still occupies one', () => {
		const s = state({
			program: program({
				phases: [
					{ name: 'Empty', weeks: 0, intensity: 100, volume: 100, deload: false },
					{ name: 'Base', weeks: 2, intensity: 100, volume: 100, deload: false },
				],
			}),
		});
		expect(phaseForWeek(s, asWeekId(1))?.name).toBe('Empty');
		expect(phaseForWeek(s, asWeekId(2))?.name).toBe('Base');
		expect(phaseForWeek(s, asWeekId(3))?.name).toBe('Base');
	});
});

describe('whether a slot was trained, and how much of a week was', () => {
	// The built-in week, read off content/en-US.ts and counted by hand: Mon 2
	// exercises, Tue 4, Wed 2, Thu 4, Fri 2, Sat 1, Sun the rest placeholder only.
	// Every one of those thirteen ids is in the exercise library (checked), so the
	// scheduled count is **six slots** — six weekdays carrying trainable work,
	// with Sunday excluded because `rest` is filtered by id.
	const SCHEDULED = 6;

	test('a slot with nothing ticked is untrained', () => {
		expect(isSlotTrained(content, state(), W5, THU)).toBe(false);
		expect(weekCompletion(content, state(), W5)).toEqual({ trained: 0, scheduled: SCHEDULED });
	});

	// ADR-0001: one tick is enough. A slot is trained, not partly trained — the
	// share of *tasks* done is a different question, and conflating them is how
	// adherence starts reporting fractions of a day.
	test('one ticked task trains the whole slot', () => {
		const s = state({ taskDone: { [taskKey(W5, THU, ex('pull'))]: true } });
		expect(isSlotTrained(content, s, W5, THU)).toBe(true);
		expect(weekCompletion(content, s, W5)).toEqual({ trained: 1, scheduled: SCHEDULED });
	});

	test('ticking every task in a slot still trains one slot', () => {
		const s = state({
			taskDone: {
				[taskKey(W5, THU, ex('pull'))]: true,
				[taskKey(W5, THU, ex('slopdens'))]: true,
				[taskKey(W5, THU, ex('abra'))]: true,
				[taskKey(W5, THU, ex('antag'))]: true,
			},
		});
		expect(weekCompletion(content, s, W5)).toEqual({ trained: 1, scheduled: SCHEDULED });
	});

	// The one that hides. `rest` is a real library entry, so a tick against it
	// parses, stores and looks exactly like training — and Sunday is not scheduled
	// work, so crediting it would put adherence above 100% on a week where the
	// athlete rested exactly as prescribed.
	test('ticking the rest placeholder earns no credit and schedules nothing', () => {
		const s = state({ taskDone: { [taskKey(W5, SUN, ex('rest'))]: true } });
		expect(isSlotTrained(content, s, W5, SUN)).toBe(false);
		expect(weekCompletion(content, s, W5)).toEqual({ trained: 0, scheduled: SCHEDULED });
	});

	test('completion is per week, so a tick in one week does not carry to another', () => {
		const s = state({ taskDone: { [taskKey(W5, THU, ex('pull'))]: true } });
		expect(weekCompletion(content, s, W6)).toEqual({ trained: 0, scheduled: SCHEDULED });
	});

	test('turning a weekday into a rest day removes it from the scheduled count', () => {
		const s = state({ program: program({ template: { [WED]: { dayType: 'rest' } } }) });
		expect(weekCompletion(content, s, W5)).toEqual({ trained: 0, scheduled: SCHEDULED - 1 });
	});

	test('an exercise the library does not know is not scheduled work', () => {
		// The library closed when #12 dropped athlete-authored exercises, so a
		// stored id can outlive its exercise. A slot left holding only unknown ids
		// is not a training day.
		const s = state({ slotExercises: { [slotKey(W5, THU)]: [ex('no_such_exercise')] } });
		expect(isSlotTrained(content, s, W5, THU)).toBe(false);
		expect(weekCompletion(content, s, W5)).toEqual({ trained: 0, scheduled: SCHEDULED - 1 });
	});
});

describe('the prescription a slot actually runs', () => {
	const PULL = ex('pull');
	const ABRA = ex('abra');
	const FRI = asWeekdayKey('Fri');
	const base = () => content.exercises[PULL].variants[0];

	// Every expected number below was worked out by hand from progression.ts:
	//   weeklyRate = weeklyPct x LEVEL_FACTOR[level] x (synergy ? 2 : 1) / 100
	//   progressionFactor(rate, buildWeeks) = (1 + rate) ^ (buildWeeks - 1)
	//   buildWeeksThrough(week) = 1 + the sum of each earlier week's adherence,
	//                             deload weeks skipped
	// and from adherenceRatio in readinessPlan.ts, whose two special cases matter
	// here: a week with nothing ticked scores **1**, not 0, and a partly-trained
	// week never scores below 0.5.
	//
	//   pull  weeklyPct 2, advanced x0.7 -> rate 0.014
	//   pull  weeklyPct 2, elite    x0.5 -> rate 0.010
	//   abra  weeklyPct 3, advanced x0.7 -> rate 0.021, doubled to 0.042 by synergy

	test('returns the built-in variant untouched when nothing modifies it', () => {
		const b = base();
		expect(effectiveVariant(content, state(), b, 0, W5, THU, PULL)).toBe(b);
	});

	test('an override collapses a prescribed range to a fixed value', () => {
		const s = state({
			program: program({ overrides: { [overrideKey(THU, PULL)]: { sets: 5, reps: 3 } } }),
		});
		const v = effectiveVariant(content, s, base(), 0, W5, THU, PULL);
		expect(v.sets).toEqual({ min: 5, max: 5 });
		expect(v.reps).toEqual({ min: 3, max: 3 });
		// A field with no override keeps the built-in range.
		expect(v.rpe).toEqual({ min: 8, max: 9 });
	});

	test('a phase scales the load by its intensity and the sets by its volume', () => {
		const s = state({
			program: program({
				autoProgress: false,
				phases: [{ name: 'Base', weeks: 8, intensity: 90, volume: 50, deload: false }],
				overrides: { [overrideKey(THU, PULL)]: { loadKg: 60 } },
			}),
		});
		const v = effectiveVariant(content, s, base(), 0, W5, THU, PULL);
		// 60 x 0.90 = 54.
		expect(v.loadKg).toEqual({ min: 54, max: 54 });
		// pull prescribes 4-6 sets; x 0.50 = 2-3.
		expect(v.sets).toEqual({ min: 2, max: 3 });
	});

	test('volume scaling never takes a set count below one', () => {
		const s = state({
			program: program({
				autoProgress: false,
				phases: [{ name: 'Taper', weeks: 8, intensity: 100, volume: 10, deload: false }],
			}),
		});
		expect(effectiveVariant(content, state(), base(), 0, W5, THU, PULL).sets).toEqual({
			min: 4,
			max: 6,
		});
		// 4 x 0.10 rounds to 0, and no sets at all is not a prescription.
		expect(effectiveVariant(content, s, base(), 0, W5, THU, PULL).sets).toEqual({ min: 1, max: 1 });
	});

	test('week 1 progresses nothing, because no week has been built yet', () => {
		const s = state({ program: program({ autoProgress: true }) });
		// buildWeeksThrough(1) = 1, so the exponent is 0 and the factor is exactly 1.
		const v = effectiveVariant(content, s, base(), 0, asWeekId(1), THU, PULL);
		expect(v.loadKg).toEqual({ min: 30, max: 45 });
	});

	test('auto-progression compounds over the weeks already built', () => {
		const s = state({
			program: program({
				autoProgress: true,
				overrides: { [overrideKey(THU, PULL)]: { loadKg: 60 } },
			}),
		});
		// Nothing ticked, so weeks 1 and 2 each score adherence 1 and
		// buildWeeksThrough(3) = 3. 1.014 ^ 2 = 1.028196; 60 x that = 61.69 -> 62.
		const v = effectiveVariant(content, s, base(), 0, asWeekId(3), THU, PULL);
		expect(v.loadKg).toEqual({ min: 62, max: 62 });
	});

	// The point of routing progression through adherence: the load climbs only as
	// far as the athlete actually trained. Getting this wrong still gives a climb,
	// which is why it needs a number worked out independently rather than a
	// direction.
	test('a half-trained week carries less progression into the next one', () => {
		const half = state({
			program: program({
				autoProgress: true,
				overrides: { [overrideKey(THU, PULL)]: { loadKg: 60 } },
			}),
			// Three of week 1's six scheduled slots.
			taskDone: {
				[taskKey(asWeekId(1), MON, ex('recruit'))]: true,
				[taskKey(asWeekId(1), TUE, ex('pinch'))]: true,
				[taskKey(asWeekId(1), WED, ex('repeaters'))]: true,
			},
		});
		expect(weekCompletion(content, half, asWeekId(1))).toEqual({ trained: 3, scheduled: 6 });
		// adherence 3/6 = 0.5, so buildWeeksThrough(3) = 1 + 0.5 + 1 = 2.5.
		// 1.014 ^ 1.5 = 1.0210733; 60 x that = 61.26 -> 61, a kilo short of the
		// fully-adherent 62 above.
		const v = effectiveVariant(content, half, base(), 0, asWeekId(3), THU, PULL);
		expect(v.loadKg).toEqual({ min: 61, max: 61 });
	});

	test('a deload week cuts to the phase intensity instead of progressing', () => {
		const s = state({
			program: program({
				autoProgress: true,
				phases: [
					{ name: 'Build', weeks: 2, intensity: 100, volume: 100, deload: false },
					{ name: 'Deload', weeks: 1, intensity: 70, volume: 60, deload: true },
				],
				overrides: { [overrideKey(THU, PULL)]: { loadKg: 60, sets: 5 } },
			}),
		});
		// Week 3 is the deload, and auto-progression must not apply to it: 60 x 0.70
		// = 42, and the fixed 5 sets scale by volume to 5 x 0.60 = 3.
		const v = effectiveVariant(content, s, base(), 0, asWeekId(3), THU, PULL);
		expect(v.loadKg).toEqual({ min: 42, max: 42 });
		expect(v.sets).toEqual({ min: 3, max: 3 });
	});

	test('the progression rate is scaled by the level in the baseline', () => {
		const s = state({
			program: program({
				autoProgress: true,
				overrides: { [overrideKey(THU, PULL)]: { loadKg: 60 } },
			}),
			baseline: baseline('elite'),
		});
		// elite halves the base rate: 2 x 0.5 / 100 = 0.010.
		// 1.010 ^ 2 = 1.0201; 60 x that = 61.21 -> 61.
		expect(effectiveVariant(content, s, base(), 0, asWeekId(3), THU, PULL).loadKg).toEqual({
			min: 61,
			max: 61,
		});
	});

	// progression.ts pairs Abrahangs with max hangs: programming both roughly
	// doubles the tissue effect (Baar). The built-in week runs maxhang on Friday,
	// so the synergy is on by default and turning Friday into a rest day is what
	// removes it.
	test('a synergy partner in the same week doubles the rate', () => {
		const overrides = { [overrideKey(THU, ABRA)]: { loadKg: 60 } };
		const withPartner = state({ program: program({ autoProgress: true, overrides }) });
		const without = state({
			program: program({
				autoProgress: true,
				overrides,
				template: { [FRI]: { dayType: 'rest' } },
			}),
		});
		const abraBase = content.exercises[ABRA].variants[0];
		// With maxhang: rate 0.042, 1.042 ^ 2 = 1.085764, 60 x that = 65.15 -> 65.
		expect(
			effectiveVariant(content, withPartner, abraBase, 0, asWeekId(3), THU, ABRA).loadKg,
		).toEqual({ min: 65, max: 65 });
		// Without it: rate 0.021, 1.021 ^ 2 = 1.042441, 60 x that = 62.55 -> 63.
		expect(effectiveVariant(content, without, abraBase, 0, asWeekId(3), THU, ABRA).loadKg).toEqual({
			min: 63,
			max: 63,
		});
	});
});

describe('carrying missed work forward', () => {
	// The Thursday `pull` day, read off content/en-US.ts.
	const THURSDAY = [ex('pull'), ex('slopdens'), ex('abra'), ex('antag')];

	test('appends the carried work after what the slot already runs', () => {
		expect(carryForward(content, state(), W5, THU, [ex('maxhang')])).toEqual([
			...THURSDAY,
			ex('maxhang'),
		]);
	});

	test('never duplicates work the slot already runs', () => {
		// `abra` is already on Thursday, so carrying it forward is a no-op for that
		// id — the athlete would otherwise get the same exercise listed twice on a
		// day they simply also owed something else.
		expect(carryForward(content, state(), W5, THU, [ex('abra'), ex('maxhang')])).toEqual([
			...THURSDAY,
			ex('maxhang'),
		]);
	});

	test('carrying nothing leaves the slot exactly as it resolved', () => {
		expect(carryForward(content, state(), W5, THU, [])).toEqual(THURSDAY);
	});

	test('carries onto a slot that has already been customized', () => {
		const s = state({ slotExercises: { [slotKey(W5, THU)]: [ex('pinch')] } });
		expect(carryForward(content, s, W5, THU, [ex('maxhang')])).toEqual([
			ex('pinch'),
			ex('maxhang'),
		]);
	});
});

describe('what went untrained yesterday', () => {
	// 2026-08-13 is a Thursday, as tests/ids.test.ts also pins. So a Friday
	// morning looks back at the Thursday `pull` day, and the Monday further down
	// looks back at Sunday, which is the rest day.
	const FRIDAY = new Date(2026, 7, 14, 9, 0).getTime();
	const MONDAY = new Date(2026, 7, 17, 9, 0).getTime();
	const THURSDAY = [ex('pull'), ex('slopdens'), ex('abra'), ex('antag')];

	test('offers everything yesterday scheduled and nothing trained', () => {
		expect(carryForwardFromYesterday(content, state({ currentWeek: W5 }), FRIDAY)).toEqual({
			weekday: THU,
			exerciseIds: THURSDAY,
		});
	});

	// CONTEXT.md's Carry-forward is 'scheduled work that went untrained — skipped
	// or held'. One mechanism for both, so a day that was trained but left work
	// behind still owes that work.
	test('offers only the unfinished part of a day that was partly trained', () => {
		const s = state({
			currentWeek: W5,
			taskDone: { [taskKey(W5, THU, ex('pull'))]: true },
		});
		expect(carryForwardFromYesterday(content, s, FRIDAY)).toEqual({
			weekday: THU,
			exerciseIds: [ex('slopdens'), ex('abra'), ex('antag')],
		});
	});

	test('offers nothing when yesterday was finished', () => {
		const s = state({
			currentWeek: W5,
			taskDone: Object.fromEntries(THURSDAY.map((id) => [taskKey(W5, THU, id), true])),
		});
		expect(carryForwardFromYesterday(content, s, FRIDAY)).toBeNull();
	});

	// A rest day scheduled nothing, so nothing about it was missed. Offering it
	// would ask the athlete to catch up on resting.
	test('offers nothing when yesterday was a rest day', () => {
		expect(carryForwardFromYesterday(content, state({ currentWeek: W5 }), MONDAY)).toBeNull();
	});

	// ADR-0003. `main` returned `{ label, exIds }`, where `label` was the day's
	// localized name — a display string travelling as data, out of a function whose
	// result feeds a key. The weekday key is what comes back, in either locale.
	test('returns the weekday key, never its localized label', () => {
		const s = state({ currentWeek: W5 });
		expect(carryForwardFromYesterday(content, s, FRIDAY)?.weekday).toBe('Thu');

		overwriteGetLocale(() => 'pt-BR');
		try {
			// Under pt-BR the Thursday label is 'Qui'; the key does not move. Asked of
			// the weekday rather than of the day type: ADR 0016 split them, and a
			// weekday label reached through a day type was the conflation itself.
			expect(weekdayLabel(getContent('pt-BR'), asWeekdayKey('Thu'))).toBe('Qui');
			expect(carryForwardFromYesterday(getContent('pt-BR'), s, FRIDAY)?.weekday).toBe('Thu');
		} finally {
			overwriteGetLocale(() => 'en-US');
		}
	});
});
