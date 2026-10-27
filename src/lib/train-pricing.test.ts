import test from "node:test";
import assert from "node:assert/strict";
import { chinaDateTime, trainQuoteKey, validTrainQuote, type FlyaiTrainQuote } from "../../shared/flyai";
import { changeTicket, defaultInput, hotelStays, minimumDays, moveDay, reconcileTrainSchedule, replaceCity, schedule, selectFlyaiHotel, selectFlyaiTrain, totals } from "./planner";
import { addDays } from "./format";
import { hotelsIn } from "../data/catalog";
import { isPlan, parseDraft, parseSaved } from "./storage";
import { reconcileCityPlans, validVisits } from "./city-planner";
import type { RoutePlan, TripInput } from "../types";

const input: TripInput = { ...defaultInput(), startDate: "2026-11-02", start: "sha", end: "bei",
  days: 7, interests: ["city"], required: [], seaEnd: false, seaDays: 2 };
const plan: RoutePlan = { id: "balance", cities: ["sha", "bei"], days: [2, 4],
  hotels: [hotelsIn("sha")[0].id, hotelsIn("bei")[0].id], tickets: ["sha-bei-air-0"] };
const sample: FlyaiTrainQuote = { source: "flyai", from: "sha", to: "bei", trainNumber: "G32",
  fromStation: "上海虹桥站", toStation: "北京南站", seatClass: "二等座", departure: "2026-11-04 19:25:00",
  arrival: "2026-11-04 23:49:00", minutes: 264, amount: 598, currency: "CNY",
  priceBasis: "passenger_search_estimate", searchedAt: "2026-10-25T12:00:00Z" };
const overnight: FlyaiTrainQuote = { ...sample, trainNumber: "D10", departure: "2026-11-04 22:30:00", arrival: "2026-11-05 06:30:00", minutes: 480, amount: 499.50 };

function invariant(p: RoutePlan, i: TripInput) {
  assert.equal(isPlan(p, i), true);
  assert.equal(schedule(p, i).at(-1)!.last, i.days - 1);
  assert.equal(p.days.reduce((a, b) => a + b, 0) + totals(p, i).transferDays, i.days);
  p.days.forEach((days, index) => assert.ok(days >= minimumDays(p.cities[index], i)));
}

test("complete train snapshots require consistent China datetimes, class, stations and CNY price", () => {
  assert.equal(validTrainQuote(sample), true);
  assert.equal(chinaDateTime(sample.departure), Date.parse("2026-11-04T11:25:00Z"));
  for (const change of [{ departure: "2026-02-30 19:25:00" }, { departure: "2026-11-04 24:25:00" },
    { arrival: "2026-11-03 23:49:00" }, { arrival: "2026-11-04 23:48:00" }, { minutes: 263 },
    { amount: 0 }, { amount: -1 }, { amount: "5xx" }, { currency: "USD" }, { seatClass: "" },
    { fromStation: "" }, { toStation: "" }, { trainNumber: "" }, { to: "sha" }, { searchedAt: "bad" }]) {
    assert.equal(validTrainQuote({ ...sample, ...change }), false, JSON.stringify(change));
  }
  assert.notEqual(trainQuoteKey(sample), trainQuoteKey({ ...sample, seatClass: "一等座" }));
});

test("selected G32 replaces demo fare and timetable, keeps a late same-day arrival and persists", () => {
  const selected = selectFlyaiTrain(plan, input, 0, sample)!;
  invariant(selected, input);
  const before = totals(plan, input), after = totals(selected, input), row = schedule(selected, input)[0];
  assert.equal(after.transit, 598);
  assert.equal(after.total, before.total - before.transit + 598);
  assert.equal(after.liveTrains, 1);
  assert.equal(after.demoTickets, 0);
  assert.equal(after.minutes, 324); // 264 min in the train, plus an explicit 60-min allowance.
  assert.equal(row.ticket?.mode, "train");
  assert.equal(row.ticket?.service, "G32");
  assert.equal(row.ticket?.departure, 19 * 60 + 25);
  assert.equal(row.transferLength, 1); // 23:49 must not invent a second travel day.
  assert.deepEqual(selected.days, plan.days);
  const draft = parseDraft(JSON.stringify({ version: 1, input, plan: selected, screen: "plan" }));
  assert.deepEqual(draft?.plan, selected);
  const saved = parseSaved(JSON.stringify([{ id: "train", savedAt: sample.searchedAt, input, plan: selected }]));
  assert.deepEqual(saved[0]?.plan, selected);
  assert.equal(plan.trainQuotes, undefined);
});

test("overnight journey preserves the selected departure date and reallocates days only after it", () => {
  const selected = selectFlyaiTrain(plan, input, 0, overnight)!;
  invariant(selected, input);
  assert.deepEqual(selected.days, [2, 3]);
  assert.equal(schedule(selected, input)[0].trainQuote?.departure, overnight.departure);
  assert.equal(schedule(selected, input)[0].transferLength, 2);
  assert.equal(totals(selected, input).transit, 499.5);
  assert.equal(totals(selected, input).nights, totals(plan, input).nights - 1);
  assert.equal(hotelStays(selected, input)[1].checkIn, "2026-11-05");
  const back = selectFlyaiTrain(selected, input, 0, sample)!;
  invariant(back, input);
  assert.deepEqual(back.days, plan.days);
});

test("price is replaced on refresh, and returning to demo removes the live snapshot", () => {
  const selected = selectFlyaiTrain(plan, input, 0, sample)!;
  const refreshed = selectFlyaiTrain(selected, input, 0, { ...sample, amount: 612.25 })!;
  assert.equal(totals(refreshed, input).transit, 612.25);
  assert.equal(totals(refreshed, input).liveTrains, 1);
  const demo = changeTicket(refreshed, input, 0, plan.tickets[0])!;
  invariant(demo, input);
  assert.equal(demo.trainQuotes?.sha, undefined);
  assert.equal(totals(demo, input).transit, totals(plan, input).transit);
});

test("overnight train dates stay correct across the year boundary", () => {
  const i = { ...input, startDate: "2026-12-30" };
  const quote = { ...overnight, departure: "2027-01-01 22:30:00", arrival: "2027-01-02 06:30:00" };
  const next = selectFlyaiTrain(plan, i, 0, quote)!;
  invariant(next, i);
  assert.equal(hotelStays(next, i)[1].checkIn, "2027-01-02");
  assert.equal(hotelStays(next, i)[1].checkOut, "2027-01-05");
  assert.equal(schedule(next, i)[0].trainQuote?.departure, quote.departure);
});

test("wrong date, route, air-only mode and insufficient time after departure block selection", () => {
  assert.equal(selectFlyaiTrain(plan, input, 0, { ...sample, from: "gui" }), null);
  assert.equal(selectFlyaiTrain(plan, input, 0, { ...sample, departure: "2026-11-03 19:25:00", arrival: "2026-11-03 23:49:00" }), null);
  assert.equal(selectFlyaiTrain(plan, { ...input, transport: "air" }, 0, sample), null);
  assert.equal(selectFlyaiTrain(plan, input, 1, sample), null);
  const tight = { ...plan, days: [4, 2] };
  invariant(tight, input);
  // Spare days before departure cannot be taken: that would move the searched date.
  assert.equal(selectFlyaiTrain(tight, input, 0, { ...overnight, departure: "2026-11-06 22:30:00", arrival: "2026-11-07 06:30:00" }), null);
});

test("changing days invalidates the old train and repairs the full trip calendar", () => {
  const selected = selectFlyaiTrain(plan, input, 0, overnight)!;
  const moved = moveDay(selected, input, 0, 1)!;
  invariant(moved, input);
  assert.equal(moved.trainQuotes?.sha, undefined);
  assert.deepEqual(moved.outdatedTrains, ["sha"]);
  assert.equal(totals(moved, input).outdatedTrains, 1);
  assert.equal(totals(moved, input).liveTrains, 0);
  assert.equal(totals(moved, input).transit, totals(plan, input).transit);
  const shiftedInput = { ...input, startDate: addDays(input.startDate, 1) };
  assert.equal(isPlan(selected, shiftedInput), false);
  const repaired = reconcileTrainSchedule(selected, shiftedInput)!;
  invariant(repaired, shiftedInput);
  assert.equal(totals(repaired, shiftedInput).outdatedTrains, 1);
});

test("overnight selection invalidates only hotel quotes whose stay dates change", () => {
  let quoted = plan;
  for (const [index, stay] of hotelStays(plan, input).entries()) {
    quoted = selectFlyaiHotel(quoted, input, index, { source: "flyai", hotelId: String(123 + index), city: stay.city,
      name: "Test", address: "Address", checkIn: stay.checkIn, checkOut: stay.checkOut, currency: "CNY", nightly: 428,
      priceBasis: "nightly_search_estimate", searchedAt: sample.searchedAt })!;
  }
  const selected = selectFlyaiTrain(quoted, input, 0, overnight)!;
  invariant(selected, input);
  assert.equal(hotelStays(selected, input)[0].quote?.nightly, 428);
  assert.equal(hotelStays(selected, input)[1].quote, undefined);
  assert.equal(totals(selected, input).outdatedHotels, 1);
});

test("a later live train is invalidated when an earlier journey shifts its departure", () => {
  const i = { ...input, end: "gui" as const, days: 12 };
  const p: RoutePlan = { id: "balance", cities: ["sha", "bei", "gui"], days: [3, 3, 4],
    tickets: ["sha-bei-air-0", "bei-gui-air-0"], hotels: ["sha", "bei", "gui"].map(city => hotelsIn(city as never)[0].id) };
  invariant(p, i);
  const later: FlyaiTrainQuote = { ...sample, from: "bei", to: "gui", trainNumber: "G99", departure: "2026-11-09 08:00:00",
    arrival: "2026-11-09 18:00:00", minutes: 600 };
  const withLater = selectFlyaiTrain(p, i, 1, later)!;
  assert.ok(withLater);
  const first = { ...overnight, departure: "2026-11-05 22:30:00", arrival: "2026-11-06 06:30:00" };
  const next = selectFlyaiTrain(withLater, i, 0, first)!;
  invariant(next, i);
  assert.equal(next.trainQuotes?.bei, undefined);
  assert.ok(next.outdatedTrains?.includes("bei"));
  assert.equal(next.trainQuotes?.sha?.departure, first.departure);
});

test("city replacement and visit reconciliation preserve valid train choices and total days", () => {
  const i = { ...input, end: "san" as const, days: 14, interests: ["city", "nature", "sea"] as TripInput["interests"], seaEnd: true, seaDays: 4 };
  const p: RoutePlan = { id: "balance", cities: ["sha", "bei", "gui", "san"], days: [2, 2, 3, 4],
    tickets: ["sha-bei-air-0", "bei-gui-air-0", "gui-san-air-0"], hotels: ["sha", "bei", "gui", "san"].map(city => hotelsIn(city as never)[0].id) };
  const selected = selectFlyaiTrain(p, i, 0, sample)!;
  invariant(selected, i);
  const changed = replaceCity(selected, i, 2, "zjj")!;
  invariant(changed, i);
  assert.deepEqual(changed.trainQuotes?.sha, sample);
  const visits = reconcileCityPlans(plan, input);
  const night = selectFlyaiTrain(visits, input, 0, overnight)!;
  const reconciled = reconcileCityPlans(night, input, visits.visits);
  assert.equal(validVisits(reconciled.visits, reconciled), true);
  invariant(reconciled, input);
});

test("corrupted saved snapshots and stale dates are rejected; legacy trips remain valid", () => {
  assert.ok(parseDraft(JSON.stringify({ version: 1, input, plan, screen: "plan" }))?.plan);
  const selected = selectFlyaiTrain(plan, input, 0, sample)!;
  for (const bad of [{ ...sample, currency: "USD" }, { ...sample, minutes: 12 }, { ...sample, amount: 0 }, { ...sample, seatClass: "" }]) {
    assert.equal(isPlan({ ...selected, trainQuotes: { sha: bad } }, input), false);
  }
  assert.equal(isPlan({ ...selected, outdatedTrains: ["bei"] }, input), false);
});
