import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isoDay, isoDayOf, isoToday } from '../src/lib/dates';

test('isoDay reads local calendar parts, not UTC', () => {
	// A training day is a local calendar day. Late-evening local times are the
	// regression case: toISOString() would roll these forward for anyone behind
	// UTC, filing an evening session under tomorrow.
	const late = new Date(2026, 6, 26, 23, 30); // 26 Jul 2026, 23:30 local
	assert.equal(isoDay(late), '2026-07-26');

	const early = new Date(2026, 6, 26, 0, 15); // 00:15 local — the other edge
	assert.equal(isoDay(early), '2026-07-26');
});

test('isoDay zero-pads month and day', () => {
	assert.equal(isoDay(new Date(2026, 0, 5)), '2026-01-05');
	assert.equal(isoDay(new Date(2026, 11, 31)), '2026-12-31');
});

test('isoDayOf agrees with isoDay for the same instant', () => {
	const d = new Date(2026, 6, 26, 23, 30);
	assert.equal(isoDayOf(d.getTime()), isoDay(d));
});

test('isoToday matches isoDay of now', () => {
	assert.equal(isoToday(), isoDay(new Date()));
});

test('a same-day timestamp and its display string agree on the day', () => {
	// What isTodayEntry relies on: two entries logged the same local day resolve to
	// the same ISO day regardless of the hour, so a locale switch can't split them.
	const morning = new Date(2026, 6, 26, 8, 0).getTime();
	const night = new Date(2026, 6, 26, 22, 45).getTime();
	assert.equal(isoDayOf(morning), isoDayOf(night));
});
