import test from "node:test";
import assert from "node:assert/strict";
import { cityIds } from "../data/catalog";
import { travelMoments } from "../data/travel-moments";
import { cityPeriod, holidayPeriod, intersectPeriods, isCalendarDate, missingCalendarYears, momentsForPeriod, periodLabel } from "./travel-calendar";
import { defaultInput, generateRoutes, schedule } from "./planner";
import { toJourneyInput, updateJourney } from "./journey";

test("calendar rejects impossible dates and incomplete holiday input without throwing", () => {
  for (const value of ["", "2026-02-29", "2026-02-31", "2026-13-01", "2026-1-01", "not-a-date"]) {
    assert.equal(isCalendarDate(value), false, value);
    assert.equal(holidayPeriod(value, 14), null);
  }
  assert.equal(isCalendarDate("2028-02-29"), true);
  for (const length of [NaN, Infinity, 4, 29, 5.5]) assert.equal(holidayPeriod("2026-11-02", length), null);
  assert.deepEqual(momentsForPeriod({ start: "2026-11-04", end: "2026-11-01" }), []);
});

test("event overlap includes its first and last day, never a neighbouring day", () => {
  const id = "shanghai-arts-2026";
  for (const date of ["2026-10-17", "2026-11-15"]) {
    const match = momentsForPeriod({ start: date, end: date }, "sha").find(item => item.moment.id === id);
    assert.deepEqual(match?.overlap, { start: date, end: date });
  }
  for (const date of ["2026-10-16", "2026-11-16"]) {
    assert.ok(!momentsForPeriod({ start: date, end: date }, "sha").some(item => item.moment.id === id));
  }
  assert.deepEqual(intersectPeriods({ start: "2026-11-04", end: "2026-11-09" }, { start: "2026-11-05", end: "2026-11-10" }), { start: "2026-11-05", end: "2026-11-09" });
});

test("a city sees its own events and nationwide holidays, never another city's programme", () => {
  const period = { start: "2026-11-01", end: "2026-11-08" };
  const sha = momentsForPeriod(period, "sha"), xan = momentsForPeriod(period, "xan");
  assert.ok(sha.some(item => item.moment.id === "shanghai-arts-2026"));
  assert.ok(xan.some(item => item.moment.id === "xian-silk-road-2026"));
  assert.ok(sha.every(item => !item.moment.city || item.moment.city === "sha"));
  assert.ok(xan.every(item => !item.moment.city || item.moment.city === "xan"));
  for (const city of cityIds) assert.ok(momentsForPeriod({ start: "2026-10-07", end: "2026-10-08" }, city).some(item => item.moment.kind === "holiday"));
});

test("confirmed 2026 events and public holidays do not recur in 2027", () => {
  for (const month of [1,2,4,5,6,7,8,9,10,11]) {
    const start = `2027-${String(month).padStart(2, "0")}-01`;
    assert.ok(momentsForPeriod({ start, end: start }).every(item => item.moment.kind === "season"));
  }
});

test("calendar coverage identifies the missing year in a mixed-year holiday, including intermediate years", () => {
  assert.deepEqual(missingCalendarYears({ start: "2026-12-29", end: "2027-01-04" }, [2026]), [2027]);
  assert.deepEqual(missingCalendarYears({ start: "2026-11-02", end: "2026-11-10" }, [2026]), []);
  assert.deepEqual(missingCalendarYears({ start: "2027-01-03", end: "2027-01-10" }, [2026]), [2027]);
  assert.deepEqual(missingCalendarYears({ start: "2026-12-29", end: "2028-01-01" }, [2026, 2028]), [2027]);
  assert.deepEqual(missingCalendarYears({ start: "", end: "" }, [2026]), []);
});

test("seasonal ideas handle winter, a year boundary and partial-month overlap", () => {
  const winter = momentsForPeriod({ start: "2026-12-25", end: "2027-01-10" });
  assert.ok(winter.some(item => item.moment.city === "san"));
  assert.ok(!winter.some(item => item.moment.city === "qin"));
  const beihai = momentsForPeriod({ start: "2026-11-25", end: "2026-12-05" }, "bha").find(item => item.moment.kind === "season");
  assert.deepEqual(beihai?.overlap, { start: "2026-11-25", end: "2026-11-30" });
  const summer = momentsForPeriod({ start: "2027-07-01", end: "2027-07-01" }, "qin");
  assert.ok(summer.some(item => item.moment.kind === "season"));
  assert.match(periodLabel({ start: "2026-12-30", end: "2027-01-04" }), /2026.*2027/);
  assert.match(periodLabel({ start: "2027-01-03", end: "2027-01-12" }), /2027/);
  assert.match(periodLabel({ start: "2027-01-03", end: "2027-01-03" }), /2027/);
});

test("international departure and return days do not create false event matches", () => {
  const period = holidayPeriod("2026-11-15", 5)!;
  assert.deepEqual(period, { start: "2026-11-16", end: "2026-11-18" });
  assert.ok(!momentsForPeriod(period, "sha").some(item => item.moment.id === "shanghai-arts-2026"));
  assert.deepEqual(holidayPeriod("2026-12-28", 7), { start: "2026-12-29", end: "2027-01-02" });
  assert.deepEqual(holidayPeriod("2026-11-15", 5, false), { start: "2026-11-15", end: "2026-11-19" });
});

test("a late-November holiday includes the flower display but not the marathon on its return day", () => {
  const period = holidayPeriod("2026-11-24", 12)!;
  const matches = momentsForPeriod(period, "sha");
  assert.deepEqual(matches.find(match => match.moment.id === "shanghai-chrysanthemums-2026")?.overlap, { start: "2026-11-25", end: "2026-11-29" });
  assert.ok(!matches.some(match => match.moment.id === "shanghai-marathon-2026"));
  const december = momentsForPeriod(holidayPeriod("2026-12-04", 5), "sha");
  assert.deepEqual(december.find(match => match.moment.id === "shanghai-marathon-2026")?.overlap, { start: "2026-12-05", end: "2026-12-06" });
});

test("plan events follow the actual city stop and exclude transfer days", () => {
  const initial = { ...toJourneyInput(defaultInput()), startDate: "2026-11-02", days: 12, required: ["sha", "han"] as const };
  const input = updateJourney({ ...initial, required: [...initial.required], seaEnd: false }, { ...initial.journey!, minStops: 2, maxStops: 2, daysByInterest: { city: 3, nature: 3, sea: 0 } });
  const result = generateRoutes(input);
  assert.equal(result.errors.length, 0);
  const plan = result.plans[0], rows = schedule(plan, input);
  rows.forEach((row, index) => {
    const period = cityPeriod(plan, input, index);
    assert.equal(period.start, row.date);
    assert.equal(period.end, row.endDate);
    assert.ok(period.start > input.startDate);
    const matches = momentsForPeriod(period, row.city);
    assert.ok(matches.every(match => match.overlap.start >= row.date && match.overlap.end <= row.endDate));
    if (row.city === "han") assert.ok(matches.every(match => !match.moment.id.startsWith("shanghai-")));
  });
});

test("calendar data has unique identities, valid city references, dates and source provenance", () => {
  assert.equal(new Set(travelMoments.map(item => item.id)).size, travelMoments.length);
  for (const moment of travelMoments) {
    assert.ok(!moment.city || cityIds.includes(moment.city));
    assert.ok(moment.source.url.startsWith("https://"));
    assert.ok(isCalendarDate(moment.checkedAt));
    if (moment.kind === "season") {
      assert.ok(moment.months?.length);
      assert.ok(moment.months!.every(month => Number.isInteger(month) && month >= 1 && month <= 12));
      assert.equal(moment.dates, undefined);
    } else {
      assert.ok(isCalendarDate(moment.dates!.start) && isCalendarDate(moment.dates!.end));
      assert.ok(moment.dates!.start <= moment.dates!.end);
      assert.equal(moment.months, undefined);
    }
  }
});
