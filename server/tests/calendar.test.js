'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { solarToLunar, findEventsByLunar, getTodayFestival } = require('../src/modules/events/calendar');
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
