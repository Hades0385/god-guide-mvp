'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { solarToLunar, findEventsByLunar, getTodayFestival, getUpcomingFestival, nextSolarForLunar } = require('../src/modules/events/calendar');
const events = require('../data/events.json');

test('solarToLunar: 2026-03-20 is 二月初二', () => {
  const r = solarToLunar(new Date(2026, 2, 20));
  assert.equal(r.lunarDate, '二月初二');
});

test('findEventsByLunar: matches tudigong event', () => {
  const found = findEventsByLunar('二月初二', events);
  assert.equal(found.length, 1);
  assert.equal(found[0].deity_id, 'tudigong');
});

test('getTodayFestival: demoMode forces tudigong festival', () => {
  const r = getTodayFestival(new Date(2026, 0, 1), events, { demoMode: true });
  assert.equal(r.festivalToday, true);
  assert.equal(r.lunarDate, '二月初二');
  assert.equal(r.mocked, true);
});

test('getTodayFestival: real date 2026-03-20 matches', () => {
  const r = getTodayFestival(new Date(2026, 2, 20), events, { demoMode: false });
  assert.equal(r.festivalToday, true);
});

test('nextSolarForLunar: 2026 二月初二 is 2026-03-20', () => {
  assert.equal(nextSolarForLunar(2, 2, new Date(2026, 0, 1)), '2026-03-20');
});

test('getUpcomingFestival: day after tudigong birthday points to guanyin', () => {
  const r = getUpcomingFestival(new Date(2026, 2, 21), events);
  assert.ok(r);
  assert.equal(r.event.deity_id, 'guanyin');
  assert.ok(r.daysUntil >= 1);
});

test('getTodayFestival: no festival today returns upcoming, not null', () => {
  const r = getTodayFestival(new Date(2026, 5, 1), events, { demoMode: false });
  assert.equal(r.festivalToday, false);
  assert.ok(r.upcoming);
  assert.ok(r.upcoming.event.deity_id);
});
