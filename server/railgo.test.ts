import test from "node:test";
import assert from "node:assert/strict";
import { createRailgoSearch, normalizeRailgo, validateRailgoQuery, couldHaveShortTrain } from "./railgo.ts";
import { createRailgoRouteSearch } from "./railgo-routes.ts";
import { addDays } from "../src/lib/format.ts";
import { defaultInput, hotelStays, schedule, selectFlyaiTrain, totals } from "../src/lib/planner.ts";
import { parseDraft, isPlan } from "../src/lib/storage.ts";
import { validateLiveResult } from "../src/lib/live-route-search.ts";
import { validTrainQuote, type FlyaiQuery, type FlyaiResult } from "../shared/flyai.ts";
import type { RailgoQuery } from "../shared/railgo.ts";
import type { TripInput } from "../src/types.ts";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import PlanScreen from "../src/components/PlanScreen.tsx";
import CompareScreen from "../src/components/CompareScreen.tsx";

const now = new Date("2026-10-25T12:00:00Z");
const q: RailgoQuery = { from: "sha", to: "han", date: "2026-11-02" };
function row(date = q.date, minutes = 65, originDay = 0, departure = "09:00") {
  const start = Number(departure.slice(0, 2)) * 60 + Number(departure.slice(3));
  const end = start + minutes, arrival = `${String(Math.floor(end / 60) % 24).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
  return { number: "G123", fromStationTelecode: "AOH", toStationTelecode: "HGH", fromDepart: departure, toArrive: arrival,
    rundays: [addDays(date, -originDay).replaceAll("-", "")],
    timetable: [
      { station: "上海虹桥", stationTelecode: "AOH", day: originDay, arrive: departure, depart: departure },
      { station: "杭州东", stationTelecode: "HGH", day: originDay + Math.floor(end / 1440), arrive: arrival, depart: arrival },
    ] };
}
const input: TripInput = { ...defaultInput(), start: "sha", end: "han", startDate: q.date, days: 7, interests: ["city", "nature"], required: [], seaEnd: false, seaDays: 2, maxTrainMinutes: 120 };
const hotelCalls: FlyaiQuery[] = [];
async function hotels(query: FlyaiQuery): Promise<FlyaiResult> {
  assert.equal(query.kind, "hotel", "the new route search never asks FlyAI for trains");
  hotelCalls.push(query);
  if (query.kind !== "hotel") throw new Error("Not a hotel");
  return { source: "flyai", query, searchedAt: now.toISOString(), access: "personal_key", limited: false,
    offers: [{ id: "123", name: "Hotel", description: "Address", url: null, priceLabel: "100", hotelQuote: {
      source: "flyai", hotelId: "123", city: query.city, name: "Hotel", address: "Address", checkIn: query.checkIn, checkOut: query.checkOut,
      currency: "CNY", nightly: 100, priceBasis: "nightly_search_estimate", distanceKm: 2, searchedAt: now.toISOString(),
    } }] };
}

test("RailGo accepts 120 minutes inclusively, rejects longer trains and never invents provider fares", () => {
  const result = normalizeRailgo([row(q.date, 120), { ...row(q.date, 121), number: "G124" }], q, now);
  assert.equal(result.trains.length, 1);
  const quote = result.trains[0];
  assert.equal(quote.minutes, 120);
  assert.equal(quote.priceBasis, "catalogue_estimate");
  assert.equal(quote.source, "railgo");
  assert.equal(quote.amount, 80);
  assert.equal(validTrainQuote(quote), true);
  assert.equal(validTrainQuote({ ...quote, priceBasis: "passenger_search_estimate" }), false);
});

test("dated operating days account for boarding after the train's first day, and reject stale schedules", () => {
  assert.equal(normalizeRailgo([row(q.date, 65, 2)], q, now).trains.length, 1);
  assert.equal(normalizeRailgo([{ ...row(), rundays: ["20261001"] }], q, now).trains.length, 0);
  assert.equal(normalizeRailgo([{ ...row(), rundays: [] }], q, now).trains.length, 0);
  assert.equal(normalizeRailgo([{ ...row(), timetable: [] }], q, now).trains.length, 0);
});

test("RailGo rejects corrupt times, reverse station order, mismatched stations and malformed envelopes", () => {
  const data = row();
  assert.equal(normalizeRailgo([{ ...data, timetable: [...data.timetable].reverse() }], q, now).trains.length, 0);
  assert.equal(normalizeRailgo([{ ...data, fromStationTelecode: "MISSING" }], q, now).trains.length, 0);
  assert.equal(normalizeRailgo([{ ...data, fromDepart: "25:00" }], q, now).trains.length, 0);
  assert.equal(normalizeRailgo([{ ...data, timetable: [data.timetable[0], { ...data.timetable[1], station: "临平南" }] }], q, now).trains.length, 0, "a remote same-city station must not masquerade as a central Hangzhou arrival");
  assert.throws(() => normalizeRailgo({ data: [] }, q, now), { code: "RAILGO_BAD_RESPONSE" });
  assert.equal(normalizeRailgo([data, data], q, now).trains.length, 1);
});

test("short overnight trains preserve the actual arrival date without extending time by the station buffer", () => {
  const quote = normalizeRailgo([row(q.date, 60, 0, "23:30")], q, now).trains[0];
  assert.equal(quote.departure, "2026-11-02 23:30:00");
  assert.equal(quote.arrival, "2026-11-03 00:30:00");
  assert.equal(quote.minutes, 60);
});

test("RailGo validation uses China's calendar, rejects invalid inputs, and strips extra fields", () => {
  assert.deepEqual(validateRailgoQuery({ ...q, apiKey: "ignored", url: "ignored" }, now), q);
  for (const patch of [{ from: "unknown" }, { to: "sha" }, { date: "2026-02-30" }, { date: "2026-10-24" }, { date: "2027-12-01" }]) {
    assert.throws(() => validateRailgoQuery({ ...q, ...patch }, now), { code: "INVALID_RAILGO_QUERY" });
  }
  assert.throws(() => validateRailgoQuery({ ...q, date: "2026-10-25" }, new Date("2026-10-25T16:30:00Z")), { code: "INVALID_RAILGO_QUERY" });
  assert.equal(couldHaveShortTrain("sha", "han"), true);
  assert.equal(couldHaveShortTrain("sha", "san"), false);
});

test("RailGo caches ten minutes, coalesces identical requests and retries failures without recording a false empty result", async () => {
  let calls = 0, date = now;
  const search = createRailgoSearch(async query => { calls++; return [row(query.date)]; }, () => date);
  const [a, b] = await Promise.all([search(q), search(q)]);
  assert.deepEqual(a, b); assert.equal(calls, 1);
  date = new Date(now.getTime() + 9 * 60000); await search(q); assert.equal(calls, 1);
  date = new Date(now.getTime() + 10 * 60000); await search(q); assert.equal(calls, 2);
  let failed = true;
  const retry = createRailgoSearch(async () => { if (failed) throw new Error("Unavailable"); return []; }, () => now);
  await assert.rejects(retry(q)); failed = false;
  assert.equal((await retry(q)).trains.length, 0);
});

test("automatic routes combine dated short RailGo trains with online hotel estimates and survive saving", async () => {
  const trains = createRailgoSearch(async query => [row(query.date)], () => now);
  const result = await createRailgoRouteSearch(hotels, trains, () => now)(input);
  assert.equal(result.source, "railgo"); assert.deepEqual(result.errors, []); assert.equal(result.plans.length, 3);
  for (const plan of result.plans) {
    assert.equal(isPlan(plan, input), true);
    assert.equal(totals(plan, input).railgoTrains, 1);
    assert.equal(totals(plan, input).estimatedTickets, 1);
    assert.equal(totals(plan, input).liveHotels, 2);
    assert.equal(schedule(plan, input)[0].trainQuote?.minutes, 65);
    assert.deepEqual(parseDraft(JSON.stringify({ version: 1, input, plan, screen: "plan", routeSource: "flyai" }))?.plan, plan);
  }
  assert.equal(validateLiveResult(result, input), true);
  const noop = () => {};
  const markup = renderToStaticMarkup(createElement(PlanScreen, { input, plan: result.plans[0], saved: false,
    onBack: noop, onSave: noop, onChange: noop, onHotel: noop, onTicket: noop, notice: "" }));
  assert.match(markup, /RailGo/); assert.match(markup, /наличие мест неизвестны/); assert.match(markup, /цены билетов оценочные/);
  const comparison = renderToStaticMarkup(createElement(CompareScreen, { input, plans: result.plans, errors: [], routeSource: "flyai",
    onRouteSource: noop, liveStatus: "done", liveResult: { ...result, warnings: ["A", "B"] }, onSearch: noop, onCancel: noop, onEdit: noop, onSelect: noop }));
  assert.match(comparison, /Что входит в расчёт/); assert.match(comparison, /Тарифы поездов пока оценочные/);
  const plan = result.plans[0], quote = { ...plan.trainQuotes!.sha!, trainNumber: "G456", departure: `${plan.trainQuotes!.sha!.departure.slice(0, 10)} 10:00:00`, arrival: `${plan.trainQuotes!.sha!.departure.slice(0, 10)} 11:05:00` };
  const changed = selectFlyaiTrain(plan, input, 0, quote)!;
  assert.ok(changed); assert.equal(changed.trainQuotes?.sha?.trainNumber, "G456");
  assert.equal(totals(changed, input).tripDays, input.days);
  assert.deepEqual(hotelStays(changed, input).map(s => s.checkIn), hotelStays(plan, input).map(s => s.checkIn));
});

test("distant legs use clearly estimated flights, never a long train or FlyAI train search", async () => {
  const distant = { ...input, end: "bei" as const, interests: ["city" as const] };
  let trainCalls = 0;
  const trains = async (query: RailgoQuery) => { trainCalls++; return normalizeRailgo([], query, now); };
  const result = await createRailgoRouteSearch(hotels, trains, () => now)(distant);
  assert.equal(result.plans.length, 3); assert.equal(trainCalls, 0);
  assert.equal(validateLiveResult(result, distant), true);
  assert.equal(schedule(result.plans[0], distant)[0].ticket?.mode, "air");
  const railOnly = await createRailgoRouteSearch(hotels, trains, () => now)({ ...distant, transport: "train" });
  assert.equal(railOnly.plans.length, 0); assert.match(railOnly.errors[0], /до 2 часов/);
});

test("missing and unavailable short trains stay distinct; warnings are aggregated and no fictional short train is inserted", async () => {
  const empty = await createRailgoRouteSearch(hotels, async query => normalizeRailgo([], query, now), () => now)(input);
  assert.equal(empty.plans.length, 0); assert.equal(empty.warnings.length, 0);
  const failed = await createRailgoRouteSearch(hotels, async () => { throw new Error("private diagnostic"); }, () => now)(input);
  assert.equal(failed.plans.length, 0); assert.equal(failed.warnings.length, 1);
  assert.match(failed.warnings[0], /не означает отсутствия поездов/);
  assert.equal(JSON.stringify(failed).includes("private diagnostic"), false);
});

test("unavailable hotel prices are never silently replaced, and trial access cannot claim online prices", async () => {
  const trains = createRailgoSearch(async query => [row(query.date)], () => now);
  const missing = await createRailgoRouteSearch(async () => { throw new Error("Unavailable"); }, trains, () => now)(input);
  assert.equal(missing.plans.length, 0); assert.equal(missing.partial, true); assert.match(missing.warnings[0], /гостиничных/);
  await assert.rejects(createRailgoRouteSearch(async query => ({ ...await hotels(query), access: "trial" }), trains, () => now)(input), { code: "PERSONAL_KEY_REQUIRED" });
});

test("cancelling a RailGo route stops later calls and releases the running search", async () => {
  const controller = new AbortController();
  let cancel = true, calls = 0;
  const run = createRailgoRouteSearch(hotels, async query => {
    calls++; if (cancel) controller.abort(); return normalizeRailgo([row(query.date)], query, now);
  }, () => now);
  await assert.rejects(run(input, { signal: controller.signal }), { name: "AbortError" });
  assert.equal(calls, 1);
  cancel = false;
  assert.equal((await run(input)).plans.length, 3);
});

test("the new route search limits concurrent work and preserves request and budget limits", async () => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const run = createRailgoRouteSearch(hotels, async query => { await gate; return normalizeRailgo([row(query.date)], query, now); }, () => now);
  const pending = run(input);
  await assert.rejects(run(input), { code: "ROUTE_SEARCH_BUSY" });
  release(); assert.equal((await pending).plans.length, 3);
  const limited = await createRailgoRouteSearch(hotels, async query => normalizeRailgo([row(query.date)], query, now), () => now,
    { requests: 2, candidates: 10000, milliseconds: 180000 })(input);
  assert.equal(limited.stats.requests, 2); assert.equal(limited.partial, true); assert.equal(limited.plans.length, 0);
});
