'use strict';

// CalendarService: solar -> lunar -> match events.json (plan.md:7, plan.md:15 Phase 3).
// Uses lunar-javascript (single heavy dep). Pure functions, testable.

const { Solar, Lunar } = require('lunar-javascript');

// DEMO_MODE fixed point: lunar 2026-02-02 (Tudigong) = solar 2026-03-20.
const DEMO_LUNAR = { month: 2, day: 2 };
const DEMO_LUNAR_LABEL = '二月初二';

function solarToLunar(date) {
  const solar = Solar.fromDate(date);
  const lunar = solar.getLunar();
  const monthChinese = lunar.getMonthInChinese();
  const dayChinese = lunar.getDayInChinese();
  return {
    month: lunar.getMonth(),
    day: lunar.getDay(),
    lunarDate: `${monthChinese}月${dayChinese}`,
    solarDate: solar.toYmd(),
  };
}

function findEventsByLunar(lunarDate, events) {
  return (events || []).filter((e) => e.lunar_date === lunarDate && e.notification_enabled !== false);
}

function getTodayFestival(now = new Date(), events = [], opts = {}) {
  const demoMode = !!opts.demoMode;
  let lunar;
  let mocked = false;
  if (demoMode) {
    // Fixed festival date so competition venue needs no real calendar.
    lunar = { lunarDate: DEMO_LUNAR_LABEL, solarDate: Lunar.fromYmd(2026, DEMO_LUNAR.month, DEMO_LUNAR.day).getSolar().toYmd() };
    mocked = true;
  } else {
    lunar = solarToLunar(now);
  }
  const matched = findEventsByLunar(lunar.lunarDate, events);
  return {
    solarDate: lunar.solarDate,
    lunarDate: lunar.lunarDate,
    events: matched,
    festivalToday: matched.length > 0,
    mocked,
  };
}

module.exports = { solarToLunar, findEventsByLunar, getTodayFestival, DEMO_LUNAR_LABEL };
