import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { defaultInput, generateRoutes, schedule, totals, validateInput, selectFlyaiTrain } from "./planner";
import { chinaStartDate, experienceAllocation, interests, mandatoryCities, toJourneyInput, updateJourney } from "./journey";
import { isInput, isPlan, parseDraft, parseSaved } from "./storage";
import { addDays } from "./format";
import { assignVisit, cityDays, reconcileCityPlans } from "./city-planner";
import { createLiveRouteSearch } from "../../server/live-routes";
import { hotelSearchRequest } from "./hotel-search";
import CreateScreen from "../components/CreateScreen";
import CompareScreen from "../components/CompareScreen";
import PlanScreen from "../components/PlanScreen";
import type { FlyaiQuery, FlyaiResult, FlyaiTrainQuote } from "../../shared/flyai";
import type { JourneyPreferences, TripInput } from "../types";

const base = { ...toJourneyInput(defaultInput()), startDate: "2026-10-26" };
function requested(patch: Partial<JourneyPreferences>, days = 14): TripInput {
  return updateJourney({ ...base, days }, { ...base.journey!, ...patch });
}
function matches(plan: ReturnType<typeof generateRoutes>["plans"][number], input: TripInput) {
  assert.equal(isPlan(plan, input), true);
  assert.equal(totals(plan, input).tripDays, input.days);
  assert.equal(schedule(plan, input).at(-1)!.last + 1 + 2, input.days);
  const allocation = experienceAllocation(plan.cities, input, plan.days.reduce((a, b) => a + b, 0), plan.days)!;
  assert.ok(allocation);
  for (const kind of interests) assert.ok(Object.values(allocation).flat().filter(k => k === kind).length >= input.journey!.daysByInterest[kind]);
}

test("holiday includes both international flight days and domestic travel without consuming experience minimums", () => {
  const result = generateRoutes(base);
  assert.deepEqual(result.errors, []);
  assert.equal(result.plans.length, 3);
  for (const plan of result.plans) {
    matches(plan, base);
    assert.ok(plan.cities.length >= 3 && plan.cities.length <= 4);
    assert.equal(schedule(plan, base)[0].date, "2026-10-27");
    assert.equal(hotelSearchRequest(plan, base, plan.cities.length - 1, "demo").checkOut, "2026-11-08");
  }
});

test("Beijing and the Great Wall share one sleeping base; no domestic ticket is invented", () => {
  const input = { ...requested({ daysByInterest: { city: 2, nature: 1, sea: 0 }, minStops: 1, maxStops: 1,
    requiredPlaces: ["bei-wall", "bei-palace"] }, 7), required: ["bei" as const] };
  assert.deepEqual(mandatoryCities(input), ["bei"]);
  assert.deepEqual(validateInput(input), []);
  const plan = generateRoutes(input).plans[0];
  matches(plan, input);
  assert.deepEqual(plan.cities, ["bei"]);
  assert.equal(plan.tickets.length, 0);
  assert.equal(totals(plan, input).nights, 5);
  const visits = reconcileCityPlans(plan, input);
  assert.ok(cityDays(visits, input, "bei").flat().includes("bei-wall"));
  assert.ok(cityDays(visits, input, "bei").flat().includes("bei-palace"));
  assert.equal(assignVisit(visits, input, "bei", "bei-wall", null), null);
  assert.equal(isPlan(visits, input), true);
});

test("nearby required locations do not add cities and required bases respect the range", () => {
  const input = requested({ daysByInterest: { city: 0, nature: 3, sea: 0 }, minStops: 1, maxStops: 1, requiredPlaces: ["gui-yangshuo"] }, 7);
  const result = generateRoutes(input);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.plans[0].cities, ["gui"]);
  const impossible = { ...input, required: ["bei", "sha"] as TripInput["required"] };
  assert.ok(validateInput(impossible).some(message => message.includes("максимума")));
});

test("impossible allocations explain the full holiday time and do not shrink selected minimums", () => {
  const short = requested({ daysByInterest: { city: 3, nature: 4, sea: 4 }, minStops: 3, maxStops: 4 }, 10);
  assert.ok(validateInput(short).some(message => message.includes("минимум 13")));
  assert.equal(generateRoutes(short).plans.length, 0);
  const wrongPlace = requested({ daysByInterest: { city: 3, nature: 0, sea: 0 }, minStops: 1, maxStops: 1, requiredPlaces: ["bei-wall"] }, 7);
  assert.ok(validateInput(wrongPlace).some(message => message.includes("стена")));
  const tooMany = { ...requested({ daysByInterest: { city: 5, nature: 0, sea: 0 }, minStops: 3, maxStops: 4 }, 14), required: ["sha", "han", "gui"] as TripInput["required"] };
  assert.ok(validateInput(tooMany).some(message => message.includes("сочетания")));
});

test("new preferences, required visits and legacy snapshots round-trip without loss", () => {
  const input = requested({ daysByInterest: { city: 2, nature: 1, sea: 0 }, minStops: 1, maxStops: 1, requiredPlaces: ["bei-wall"] }, 7);
  const plan = reconcileCityPlans(generateRoutes(input).plans[0], input);
  const restored = parseDraft(JSON.stringify({ version: 1, input, plan, screen: "plan", routeSource: "demo" }));
  assert.deepEqual(restored?.plan, plan);
  assert.deepEqual(restored?.input.journey, input.journey);
  assert.equal(parseSaved(JSON.stringify([{ id: "trip", savedAt: new Date().toISOString(), input, plan }])).length, 1);
  const legacy = defaultInput(), oldPlan = generateRoutes(legacy).plans[0];
  assert.ok(parseDraft(JSON.stringify({ version: 1, input: legacy, plan: oldPlan, screen: "plan" }))?.plan);
  for (const journey of [null, {}, { ...input.journey, minStops: 0 }, { ...input.journey, requiredPlaces: ["unknown"] }]) assert.equal(isInput({ ...input, journey }), false);
});

const provider = async (q: FlyaiQuery): Promise<FlyaiResult> => ({ source: "flyai", query: q, searchedAt: "2026-10-25T12:00:00Z", access: "personal_key", limited: false,
  offers: q.kind === "hotel" ? [{ id: "100", name: "Hotel", description: "Address", priceLabel: "¥200", url: null,
    hotelQuote: { source: "flyai", hotelId: "100", city: q.city, name: "Hotel", address: "Address", checkIn: q.checkIn, checkOut: q.checkOut, nightly: 200,
      currency: "CNY", priceBasis: "nightly_search_estimate", searchedAt: "2026-10-25T12:00:00Z" } }]
    : [{ id: "G1", name: "G1", description: "Train", priceLabel: "300", url: null, trainQuote: { source: "flyai", from: q.from, to: q.to, trainNumber: "G1",
      fromStation: "Origin", toStation: "Destination", seatClass: "二等座", departure: `${q.date} 08:00:00`, arrival: `${q.date} 12:00:00`,
      minutes: 240, amount: 300, currency: "CNY", priceBasis: "passenger_search_estimate", searchedAt: "2026-10-25T12:00:00Z" } }] });

test("FlyAI search keeps full-holiday preferences, uses China arrival dates and accepts one-base trips", async () => {
  const input = requested({ daysByInterest: { city: 2, nature: 0, sea: 0 }, minStops: 2, maxStops: 2, requiredPlaces: [] }, 7);
  const result = await createLiveRouteSearch(provider, () => new Date("2026-10-25T12:00:00Z"))(input);
  assert.equal(result.plans.length, 3);
  assert.deepEqual(result.input.journey, input.journey);
  for (const plan of result.plans) {
    matches(plan, input);
    assert.equal(totals(plan, input).demoTickets, 0);
    assert.equal(totals(plan, input).demoHotels, 0);
    assert.equal(plan.hotelQuotes?.[plan.cities[0]]?.checkIn, chinaStartDate(input));
  }
  const single = requested({ daysByInterest: { city: 2, nature: 1, sea: 0 }, minStops: 1, maxStops: 1, requiredPlaces: ["bei-wall"] }, 7);
  const one = await createLiveRouteSearch(provider, () => new Date("2026-10-25T12:00:00Z"))(single);
  assert.equal(one.plans.length, 3);
  assert.deepEqual(one.plans[0].cities, ["bei"]);
  matches(one.plans[0], single);
});

test("a different train preserves its departure date, the whole holiday and requested experience minima", () => {
  const input = { ...requested({ daysByInterest: { city: 2, nature: 1, sea: 0 }, minStops: 2, maxStops: 2, requiredPlaces: ["bei-wall"] }, 10), required: ["sha", "bei"] as TripInput["required"] };
  const plan = generateRoutes(input).plans.find(p => p.cities[0] === "sha") ?? generateRoutes(input).plans[0];
  const row = schedule(plan, input)[0], date = addDays(chinaStartDate(input), row.transferStart);
  const quote: FlyaiTrainQuote = { source: "flyai", from: plan.cities[0], to: plan.cities[1], trainNumber: "D9", fromStation: "Origin", toStation: "Destination",
    seatClass: "二等座", departure: `${date} 22:00:00`, arrival: `${addDays(date, 1)} 06:00:00`, minutes: 480, amount: 300,
    currency: "CNY", priceBasis: "passenger_search_estimate", searchedAt: "2026-10-25T12:00:00Z" };
  const changed = selectFlyaiTrain(plan, input, 0, quote)!;
  assert.ok(changed);
  matches(changed, input);
  assert.equal(schedule(changed, input)[0].trainQuote?.departure, quote.departure);
});

test("short form replaces the wizard while legacy plans retain full-holiday dates and required places", () => {
  const input = requested({ daysByInterest: { city: 2, nature: 1, sea: 0 }, minStops: 1, maxStops: 1, requiredPlaces: ["bei-wall"] }, 7);
  const plans = generateRoutes(input).plans, noop = () => {};
  const form = renderToStaticMarkup(createElement(CreateScreen, { input, onChange: noop, errors: [], onSubmit: noop, routeSource: "demo", onRouteSource: noop }));
  assert.ok(!form.includes("Шаг 1 из 3"));
  assert.ok(form.includes("Города и достопримечательности"));
  assert.ok(form.includes("Природа и прогулки"));
  assert.equal((form.match(/<form/g) ?? []).length, 1);
  const comparison = renderToStaticMarkup(createElement(CompareScreen, { input, plans, errors: [], onEdit: noop, onSelect: noop, routeSource: "demo",
    onRouteSource: noop, liveStatus: "idle", onSearch: noop, onCancel: noop }));
  const detail = renderToStaticMarkup(createElement(PlanScreen, { input, plan: reconcileCityPlans(plans[0], input), saved: false,
    onBack: noop, onSave: noop, onChange: noop, onHotel: noop, onTicket: noop, notice: "" }));
  assert.ok(comparison.includes("Москва → Китай → Москва"));
  assert.ok(comparison.includes("7 дней"));
  assert.ok(detail.includes("Москва → Пекин"));
  assert.ok(detail.includes("Пекин → Москва"));
  assert.ok(detail.includes("Великая китайская стена"));
  assert.ok(detail.includes("Города и переезды"));
  assert.ok(detail.includes("Спланировать дни: Пекин"));
});
