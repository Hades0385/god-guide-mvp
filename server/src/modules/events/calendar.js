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

function toYmd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Next solar occurrence (YYYY-MM-DD) of a lunar month/day on/after fromDate.
// Returns null when the event has no numeric lunar fields or no valid date.
function nextSolarForLunar(month, day, fromDate = new Date()) {
  if (!Number.isInteger(month) || !Number.isInteger(day) || month < 1 || month > 12 || day < 1 || day > 30) return null;
  const today = toYmd(fromDate);
  for (const year of [fromDate.getFullYear(), fromDate.getFullYear() + 1]) {
    try {
      const solar = Lunar.fromYmd(year, month, day).getSolar();
      const ymd = solar.toYmd();
      if (ymd >= today) return ymd;
    } catch { /* invalid lunar date (e.g. short month), try next year */ }
  }
  return null;
}

function daysBetween(fromYmd, toYmd) {
  const [fy, fm, fd] = fromYmd.split('-').map(Number);
  const [ty, tm, td] = toYmd.split('-').map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86400000);
}

// Nearest upcoming festival (including today). Null when nothing resolves.
function getUpcomingFestival(now = new Date(), events = []) {
  const today = toYmd(now);
  let best = null;
  for (const e of events || []) {
    if (e.notification_enabled === false) continue;
    const solarDate = nextSolarForLunar(e.lunar_month, e.lunar_day, now);
    if (!solarDate) continue;
    if (!best || solarDate < best.solarDate) {
      best = { event: e, solarDate, daysUntil: daysBetween(today, solarDate) };
    }
  }
  return best;
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
    upcoming: matched.length > 0 ? null : getUpcomingFestival(now, events),
    mocked,
  };
}

module.exports = { solarToLunar, findEventsByLunar, getTodayFestival, getUpcomingFestival, nextSolarForLunar, DEMO_LUNAR_LABEL };
