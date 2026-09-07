// What Week reads.
//
// The seven slots of the current training week: what each one runs, what is
// ticked off in it, and how it stands. `CONTEXT.md`'s **slot** is the pairing of
// a `WeekdayKey` with a `WeekId`, and this file is the only place the app turns
// that pairing into something a screen can draw.
//
// WHY THE LABEL AND THE KEY ARE TWO FIELDS
// ----------------------------------------
// `WeekSlot` carries `weekday` (a `WeekdayKey`, minted in `lib/ids.ts`) *and*
// `weekdayLabel` (localized, display only), and nothing collapses them. This is
// the page ADR-0003 is about: the English weekday labels are byte-identical to
// the stable keys, so a screen that stored or matched on the label would work
// perfectly in en-US and orphan every tick the moment the athlete switched to
// pt-BR — `Seg` is not `Mon`. Two fields is what makes that a compile error
// rather than a bug nobody can see in the base locale.
//
// WHY THE DAY TYPE IS RESOLVED HERE AND NOT NAMED BY THE WEEKDAY
// --------------------------------------------------------------
// A weekday is calendar position and says only *when*. What a slot runs is a day
// type, and it keeps its identity wherever it is scheduled (ADR-0002) — so this
// asks `prescription.ts` rather than reading a day off the weekday. The
// fallback chain is that module's: per-slot override → the program's template →
// the weekday's built-in default.

import { phaseId } from '$lib/content/logic';
import type { Content, DayType, PhaseId } from '$lib/content/types';
import { isoDayOf } from '$lib/dates';
import { weekdayLabel } from '$lib/format';
import {
	asWeekdayKey,
	taskKey,
	type WeekdayKey,
	type WeekId,
	weekdayKeyOf,
	weekNumberOf,
} from '$lib/ids';
import { isSlotTrained, resolveDay, trainableExerciseIds, weekCompletion } from '$lib/prescription';
import type { TrainingRecord } from '$lib/store/record';
import type { Task } from './today';

/**
 * How a slot stands.
 *
 * Five states and not three, because `missed` and `ahead` are both "scheduled and
 * not trained" and the page cannot answer *did I miss anything* without telling
 * them apart — which is half of why Week gets opened. `rest` is separate again: a
 * slot with no trainable work is not scheduled, so it cannot be missed and never
 * counts against adherence (`weekCompletion`).
 *
 * `today` outranks `trained` deliberately. A slot part-way through is still the
 * one the athlete is standing in, and drawing it as finished is the more
 * misleading of the two.
 */
export type SlotState = 'trained' | 'today' | 'missed' | 'ahead' | 'rest';

/** One slot of the week — a weekday paired with the training week around it. */
export interface WeekSlot {
	/** The identity. Half of the slot; the other half is the screen's `week`. */
	weekday: WeekdayKey;
	/** Localized. Display only — never stored, never matched on (ADR-0003). */
	weekdayLabel: string;
	/** What this slot runs, after overrides. Its `type` carries the athlete's
	 *  custom focus name where one is set; its `id` is untouched by that. */
	day: DayType;
	/** The slot's tasks, in prescription order. The same shape Today and Train
	 *  use — one task, one `TaskKey`, one tick (ADR-0001). */
	tasks: Task[];
	/** At least one task ticked. One tick is enough (ADR-0001): a slot is trained
	 *  or it is not, and what share of it got done is a different question. */
	trained: boolean;
	state: SlotState;
	/** No trainable work at all. Not the same as "nothing done yet". */
	isRestDay: boolean;
}

export interface WeekScreen {
	week: WeekId;
	weekNumber: number;
	/** The block phase this week falls in, localized. */
	phase: Content['phases'][PhaseId];
	/** The calendar weekday the athlete is standing in, so the page can say which
	 *  slot is now. An identity, not a label. */
	today: WeekdayKey;
	slots: WeekSlot[];
	/** Adherence, in **slots**: how many of the week's scheduled slots were
	 *  trained, and how many there were. Counted by `weekCompletion` rather than
	 *  here, because this is the number progression scales itself against and a
	 *  second implementation of it is a second answer.
	 *
	 *  Named `…Slots` rather than `trained`/`scheduled`, because `WeekSlot.trained`
	 *  is a boolean one field away and `w.trained` beside `slot.trained` read
	 *  identically while meaning different things. */
	trainedSlots: number;
	scheduledSlots: number;
}

/** Everything Week reads, resolved against the record. */
export function resolveWeek(content: Content, record: TrainingRecord, now: number): WeekScreen {
	const week = record.currentWeek;
	const weekNumber = weekNumberOf(week);
	const today = weekdayKeyOf(isoDayOf(now));

	// Position within the week, so a slot behind today can be told from one ahead
	// of it. Taken from the content's own ordering rather than from a literal
	// list: `builtInWeek` is what every other reader of the week walks, and a
	// second copy of "the days, in order" is a second thing to keep in step.
	const order = content.builtInWeek.map((d) => d.k);
	const todayIndex = order.indexOf(today);
	const completion = weekCompletion(content, record, week);

	// HAS THE ATHLETE EVER TRAINED?
	//
	// `missed` claims the athlete had the chance to train a slot and did not, and
	// on a brand-new account that claim is false for every past day of week 1 —
	// the first visit rendered three days in `--stop` before the athlete had done
	// anything at all.
	//
	// There is no block start date to test against, and that absence is recorded
	// rather than accidental: ADR-0001 hit the same wall ("slots are keyed by
	// *(week, weekday)* and sessions by *calendar date*, and the app has no anchor
	// between the two: there is no start date"). Adding one is a schema change
	// across the store, the wire and the server — not a screen's decision.
	//
	// So the honest proxy is whether the record holds any evidence of training at
	// all. Before the first tick and the first session, nothing has been missed and
	// every scheduled slot is simply still to come. The known limit: an athlete who
	// logs their first session on a Thursday does see that week's Monday as missed.
	// That is a weaker claim than a start date would support and a much better one
	// than accusing every new account on sight.
	const hasStarted =
		record.sessions.length > 0 || Object.values(record.taskDone).some((done) => done === true);

	const slots = content.builtInWeek.map((entry, index): WeekSlot => {
		// The boundary where calendar position becomes an identity. `entry.k` is
		// plain `string` down in the content layer because ADR-0013 forbids that
		// layer importing upward into `lib/ids.ts`; this is where it is vouched for.
		const weekday = asWeekdayKey(entry.k);
		const scheduled = trainableExerciseIds(content, record, week, weekday);
		const trained = isSlotTrained(content, record, week, weekday);

		const tasks: Task[] = scheduled.map((exercise) => ({
			key: taskKey(week, weekday, exercise),
			exercise,
			// Derived at render, never stored (ADR 0012). A session logged in English
			// shows Portuguese names after a switch, because the name was never the
			// thing that was kept.
			exName: content.exercises[exercise].name,
			done: record.taskDone[taskKey(week, weekday, exercise)] === true,
		}));

		return {
			weekday,
			weekdayLabel: weekdayLabel(content, weekday),
			day: resolveDay(content, record, week, weekday),
			tasks,
			trained,
			state: slotState({
				isRest: scheduled.length === 0,
				trained,
				index,
				todayIndex,
				hasStarted,
			}),
			isRestDay: scheduled.length === 0,
		};
	});

	return {
		week,
		weekNumber,
		phase: content.phases[phaseId(weekNumber, record.program.weeks)],
		today,
		slots,
		trainedSlots: completion.trained,
		scheduledSlots: completion.scheduled,
	};
}

/** What `slotState` needs to place one slot. An object rather than four
 *  positional arguments, two of which are booleans — `slotState(true, false, …)`
 *  at the call site says nothing about which flag is which. */
interface Placement {
	isRest: boolean;
	trained: boolean;
	/** The slot's position in the built-in week. */
	index: number;
	/** Today's position in it, or `-1` if today is somehow not in the week. */
	todayIndex: number;
	/** Whether the record holds any evidence of training at all. */
	hasStarted: boolean;
}

/**
 * Which of the five a slot is in.
 *
 * Two guards on `missed`, and both are about not accusing the athlete of
 * something the record cannot support. `hasStarted` is the first: nothing is
 * missed on an account that has never trained. `todayIndex >= 0` is the second —
 * it is `-1` only if the calendar weekday is not in the built-in week, which
 * cannot happen through `weekdayKeyOf` but is cheap to survive, and every
 * scheduled slot then reads `ahead`, the honest answer when the page does not
 * know where "now" sits.
 */
function slotState({ isRest, trained, index, todayIndex, hasStarted }: Placement): SlotState {
	if (isRest) return 'rest';
	if (index === todayIndex) return 'today';
	if (trained) return 'trained';
	const behindToday = todayIndex >= 0 && index < todayIndex;
	return behindToday && hasStarted ? 'missed' : 'ahead';
}
