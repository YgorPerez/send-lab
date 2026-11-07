// The readiness check one question at a time (#116, spec #113 stories 22–29).
//
// Which question the sheet shows is a pure function of the answers so far, so it
// is asserted here without rendering anything: the order the questions come in,
// the follow-ups that join it only when an answer calls for them, where a
// reopened check resumes, and when it is over. The sheet that renders it is
// asserted in `tests/readinessSheet.test.ts`.
import { describe, expect, test } from 'vitest';
import {
	checkSteps,
	followsFrom,
	openingStep,
	stepAfter,
	stepBefore,
} from '../src/lib/readinessFlow';

const CORE = ['sleep', 'fatigue', 'soreness', 'body', 'illness', 'time'];

/** Walk the check from its first step, the way picking an answer on each does. */
function walk(answers: Record<string, number>): string[] {
	const seen: string[] = [];
	for (let id: string | null = checkSteps(answers)[0]; id; id = stepAfter(answers, id)) {
		seen.push(id);
	}
	return seen;
}

describe('the order', () => {
	test('an unanswered check asks the six core questions, sleep first', () => {
		expect(checkSteps({})).toEqual(CORE);
		expect(walk({})).toEqual(CORE);
	});

	test('back goes one step up, and the first step has none', () => {
		expect(stepBefore({}, 'fatigue')).toBe('sleep');
		expect(stepBefore({}, 'sleep')).toBeNull();
	});
});

describe('the follow-ups', () => {
	test('something hurting asks how it feels, straight after the body question', () => {
		expect(stepAfter({ body: 1 }, 'body')).toBe('pain');
		expect(stepAfter({ body: 1 }, 'pain')).toBe('illness');
		// Nothing hurting: no severity question.
		expect(stepAfter({ body: 0 }, 'body')).toBe('illness');
	});

	test('poor sleep asks about stress and drive after recovery', () => {
		const answers = { sleep: 3 };
		expect(checkSteps(answers).slice(0, 4)).toEqual(['sleep', 'fatigue', 'stress', 'mood']);
		expect(stepAfter(answers, 'fatigue')).toBe('stress');
		expect(stepAfter(answers, 'mood')).toBe('soreness');
	});

	test('skin is asked last, and only on a day still pointing hard', () => {
		const fresh = { sleep: 10, fatigue: 10, soreness: 10, body: 0, illness: 0, time: 10 };
		expect(stepAfter(fresh, 'time')).toBe('skin');
		expect(stepAfter(fresh, 'skin')).toBeNull();
		// A flat day does not get asked about skin: the check ends at time.
		const flat = { ...fresh, sleep: 7, fatigue: 7, soreness: 3 };
		expect(stepAfter(flat, 'time')).toBeNull();
	});

	// The sheet shows a follow-up with the answer it asks about, because that
	// answer is one step back and off screen. Only the severity question asks
	// about one answer: stress and drive follow poor sleep *or* low recovery, and
	// skin follows the whole wellness read, so naming the question above them
	// would name the wrong reason (#116 critique).
	test('only the severity question names the answer it asks about', () => {
		expect(followsFrom('pain')).toBe('body');
		for (const id of ['stress', 'mood', 'skin', 'sleep', 'time'])
			expect(followsFrom(id)).toBeNull();
	});

	test('changing an answer withdraws the follow-up it had called for', () => {
		expect(checkSteps({ body: 2 })).toContain('pain');
		expect(checkSteps({ body: 0, pain: 2 })).not.toContain('pain');
	});
});

describe('resuming', () => {
	test('a fresh check opens on its first question', () => {
		expect(openingStep({})).toBe('sleep');
	});

	test('a check closed halfway reopens on the first question still unanswered', () => {
		expect(openingStep({ sleep: 7, fatigue: 7 })).toBe('soreness');
		// A follow-up the answers called for counts as a question to answer.
		expect(openingStep({ sleep: 7, fatigue: 7, soreness: 7, body: 1 })).toBe('pain');
	});

	test('an answer to a withdrawn follow-up does not stand in for a visible one', () => {
		expect(openingStep({ sleep: 7, fatigue: 7, soreness: 7, body: 0, pain: 1 })).toBe('illness');
	});
});

describe('the end', () => {
	const done = { sleep: 7, fatigue: 7, soreness: 7, body: 0, illness: 0, time: 7 };

	test('the last step has nothing after it', () => {
		expect(stepAfter(done, 'time')).toBeNull();
	});

	test('a finished check reopens on its first question, to be edited', () => {
		expect(openingStep(done)).toBe('sleep');
	});

	test('a step the answers no longer ask for has nothing either side of it', () => {
		expect(stepAfter(done, 'pain')).toBeNull();
		expect(stepBefore(done, 'pain')).toBeNull();
	});
});
