import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { automaticPreferences, toggleAutomaticPlace } from "./automatic-preferences";
import { dateRangeDays, editableDate, parseEditableDate, monthCells, rangeError, shiftMonth } from "./date-range";
import { addDays } from "./format";
import { experienceAllocation, toJourneyInput } from "./journey";
import { defaultInput, generateRoutes, hotelStays, schedule, selectFlyaiTrain, totals, validateInput } from "./planner";
import { reconcileCityPlans } from "./city-planner";
import { isInput, isPlan, parseDraft, parseSaved } from "./storage";
import { routeRecoveries } from "./route-recovery";
import { routeExplanation } from "./route-adjustments";
import { tripKey } from "../../shared/trip-key";
import { validateRailgoTrip, createRailgoRouteSearch } from "../../server/railgo-routes";
import { validateLiveInput } from "../../server/live-routes";
import { validateLiveResult } from "./live-route-search";
import type { FlyaiQuery, FlyaiResult, FlyaiTrainQuote } from "../../shared/flyai";
import type { RailgoResult } from "../../shared/railgo";
import type { Interest, TripInput } from "../types";
import CreateScreen from "../components/CreateScreen";
import CompareScreen from "../components/CompareScreen";
import PlanScreen from "../components/PlanScreen";
import OfferPicker from "../components/OfferPicker";

const now = new Date("2026-10-27T09:00:00Z"), noop = () => {};
const base = (): TripInput => ({ ...defaultInput(), startDate: "2026-11-01", budget: 30000 });
const automatic = (days = 10) => automaticPreferences({ ...base(), days });

test("automatic routes allocate the full holiday, all interests and contiguous nights without arrival cuts", () => {
  for (const days of [5, 7, 10, 14, 21, 28]) {
    const input = automatic(days), result = generateRoutes(input);
    assert.deepEqual(result.errors, []);
    assert.ok(result.plans.length > 0, `${days} days must produce routes`);
    for (const plan of result.plans) {
      const rows = schedule(plan, input), sum = totals(plan, input);
      assert.equal(plan.days.reduce((a, b) => a + b, 0), days);
      assert.equal(sum.tripDays, days);
      assert.equal(sum.nights, days - 1);
      assert.equal(sum.extraTransferDays, 0);
      assert.equal(rows[0].date, input.startDate);
      assert.equal(rows.at(-1)!.endDate, addDays(input.startDate, days - 1));
      assert.ok(rows.every(row => !row.arrival));
      assert.ok(isPlan(plan, input));
      const allocation = Object.values(experienceAllocation(plan.cities, input, days, plan.days)!).flat();
      for (const kind of input.interests) assert.ok(allocation.includes(kind));
      if (days >= 10) assert.ok(plan.days.every(count => count >= 2), "no one-day crumbs in an ordinary trip");
    }
  }
});

test("interests and pace set coverage and automatic stop limits without mutating the source", () => {
  const input = base(), before = structuredClone(input);
  const slow = automaticPreferences(input, { pace: "slow", interests: ["nature"] });
  const active = automaticPreferences(input, { pace: "active", interests: ["nature"] });
  assert.deepEqual(input, before);
  assert.deepEqual(automaticPreferences({ ...input, interests: ["nature"] }).interests, ["nature"]);
  assert.deepEqual(slow.journey!.daysByInterest, { city: 0, nature: 1, sea: 0 });
  assert.ok(active.journey!.maxStops > slow.journey!.maxStops);
  assert.equal(slow.seaEnd, false);
  for (const kind of ["city", "nature", "sea"] as Interest[]) {
    const selected = automaticPreferences(automatic(10), { interests: [kind] });
    assert.ok(generateRoutes(selected).plans.length > 0);
  }
  assert.ok(validateInput(automaticPreferences(automatic(), { interests: [] })).length > 0);
});

test("mandatory places retain enough category days, required cities and visits", () => {
  const source = automaticPreferences(automatic(14), { interests: ["city"] });
  const wall = toggleAutomaticPlace(source, "bei-wall", "bei", true);
  assert.ok(wall.journey!.requiredPlaces.includes("bei-wall"));
  assert.ok(wall.interests.includes("nature"));
  assert.ok(wall.journey!.daysByInterest.nature >= 1);
  assert.ok(!source.journey!.requiredPlaces.length);
  const input = toggleAutomaticPlace(wall, "sha", "sha", false);
  const plans = generateRoutes(input).plans;
  assert.ok(plans.length);
  for (const plan of plans) {
    assert.ok(plan.cities.includes("sha") && plan.cities.includes("bei"));
    const complete = reconcileCityPlans(plan, input);
    assert.ok(complete.visits?.bei?.flat().includes("bei-wall"));
    assert.ok(isPlan(complete, input));
  }
  assert.ok(!toggleAutomaticPlace(wall, "bei-wall", "bei", true).journey!.requiredPlaces.length);
});

test("new saved plans round-trip while legacy calendars and manual visits remain intact", () => {
  for (const input of [automatic(), toJourneyInput({ ...base(), days: 14 })]) {
    const plan = reconcileCityPlans(generateRoutes(input).plans[0], input);
    const draft = { version: 1, input, plan, screen: "plan", routeSource: "demo" };
    const restored = parseDraft(JSON.stringify(draft));
    assert.deepEqual(restored?.input, input);
    assert.deepEqual(restored?.plan, plan);
    assert.deepEqual(parseSaved(JSON.stringify([{ id: "kept", savedAt: now.toISOString(), input, plan }]))[0]?.plan, plan);
    if (input.journey!.planningMode) assert.equal(schedule(plan, input)[0].date, input.startDate);
    else assert.equal(schedule(plan, input)[0].date, addDays(input.startDate, 1));
  }
  const input = automatic();
  assert.equal(isInput({ ...input, journey: { ...input.journey, planningMode: "unknown" } }), false);
  assert.equal(isInput({ ...input, journey: { ...input.journey, flexibleDates: "yes" } }), false);
  const exact = { ...input, journey: { ...input.journey!, flexibleDates: false } };
  assert.notEqual(tripKey(input), tripKey(exact));
  const { planningMode, flexibleDates, ...legacy } = input.journey!;
  assert.notEqual(tripKey(exact), tripKey({ ...input, journey: legacy }));
});

test("same-day real trains keep all days; an overnight quote cannot conflict with automatic hotel dates", () => {
  let input = automaticPreferences({ ...base(), days: 10, interests: ["city", "nature"], required: ["sha", "han"] });
  input = { ...input, transport: "train", journey: { ...input.journey!, flexibleDates: false, minStops: 2, maxStops: 2 } };
  const plan = generateRoutes(input).plans[0], row = schedule(plan, input)[0];
  assert.ok(plan);
  const date = addDays(input.startDate, row.transferStart);
  const quote: FlyaiTrainQuote = { source: "flyai", from: plan.cities[0], to: plan.cities[1], trainNumber: "G123", fromStation: "Origin", toStation: "Destination", seatClass: "二等座", departure: `${date} 09:00:00`, arrival: `${date} 10:00:00`, minutes: 60, amount: 100, currency: "CNY", priceBasis: "passenger_search_estimate", searchedAt: now.toISOString() };
  const changed = selectFlyaiTrain(plan, input, 0, quote)!;
  assert.ok(changed);
  assert.equal(totals(changed, input).tripDays, 10);
  assert.equal(totals(changed, input).nights, 9);
  assert.equal(schedule(changed, input)[0].trainQuote?.departure, quote.departure);
  assert.ok(isPlan(changed, input));
  assert.equal(selectFlyaiTrain(plan, input, 0, { ...quote, departure: `${date} 23:30:00`, arrival: `${addDays(date, 1)} 00:30:00` }), null);
});

test("flexible dates block providers; exact server requests retain the new calendar mode", async () => {
  const input = automatic();
  for (const validate of [validateRailgoTrip, validateLiveInput]) {
    assert.throws(() => validate(input, now), { code: "DATES_REQUIRED" });
    const exact = { ...input, journey: { ...input.journey!, flexibleDates: false } };
    assert.deepEqual(validate(exact, now).journey, exact.journey);
    assert.equal(validate(exact, now).maxTrainMinutes, 120);
  }
  let calls = 0;
  const provider = async (query: FlyaiQuery): Promise<FlyaiResult> => {
    calls++;
    assert.equal(query.kind, "hotel");
    if (query.kind !== "hotel") throw new Error("Only hotels");
    return { source: "flyai", query, searchedAt: now.toISOString(), access: "personal_key", limited: false, offers: [{ id: "123", name: "Hotel", description: "Address", url: null, priceLabel: "100", hotelQuote: { source: "flyai", hotelId: "123", city: query.city, name: "Hotel", address: "Address", checkIn: query.checkIn, checkOut: query.checkOut, nightly: 100, currency: "CNY", priceBasis: "nightly_search_estimate", distanceKm: 2, searchedAt: now.toISOString() } }] };
  };
  const search = createRailgoRouteSearch(provider, async () => { throw new Error("One city needs no train"); }, () => now);
  await assert.rejects(search(input), { code: "DATES_REQUIRED" });
  assert.equal(calls, 0);
  const exact = automaticPreferences({ ...base(), days: 7, interests: ["city"], required: ["bei"] });
  exact.journey = { ...exact.journey!, flexibleDates: false, minStops: 1, maxStops: 1 };
  const result = await search(exact);
  assert.ok(result.plans.length);
  assert.ok(calls > 0);
  validateLiveResult(result, exact);
  for (const plan of result.plans) {
    assert.equal(totals(plan, exact).tripDays, 7);
    assert.equal(totals(plan, exact).nights, 6);
    assert.equal(hotelStays(plan, exact)[0].checkIn, exact.startDate);
    assert.equal(hotelStays(plan, exact)[0].checkOut, addDays(exact.startDate, 6));
  }
});

test("a mocked RailGo route uses exact automatic stop dates and nine hotel nights for ten days", async () => {
  const input = automaticPreferences({ ...base(), days: 10, interests: ["city", "nature"], required: ["sha", "han"], transport: "train" });
  input.journey = { ...input.journey!, flexibleDates: false, minStops: 2, maxStops: 2 };
  const seen: FlyaiQuery[] = [];
  const search = createRailgoRouteSearch(async query => {
    seen.push(query);
    if (query.kind !== "hotel") throw new Error("Only hotel queries go to FlyAI");
    return { source: "flyai", query, searchedAt: now.toISOString(), access: "personal_key", limited: false, offers: [{ id: "123", name: "Hotel", description: "Address", url: null, priceLabel: "100", hotelQuote: { source: "flyai", hotelId: "123", city: query.city, name: "Hotel", address: "Address", checkIn: query.checkIn, checkOut: query.checkOut, nightly: 100, currency: "CNY", priceBasis: "nightly_search_estimate", distanceKm: 2, searchedAt: now.toISOString() } }] };
  }, async (query): Promise<RailgoResult> => ({ source: "railgo", query, searchedAt: now.toISOString(), maxMinutes: 120, trains: [{ source: "railgo", from: query.from, to: query.to, trainNumber: "G123", fromStation: "Origin", toStation: "Destination", seatClass: "二等座", departure: `${query.date} 09:00:00`, arrival: `${query.date} 10:00:00`, minutes: 60, amount: 80, currency: "CNY", priceBasis: "catalogue_estimate", searchedAt: now.toISOString() }] }), () => now);
  const result = await search(input);
  assert.ok(result.plans.length);
  validateLiveResult(result, input);
  for (const plan of result.plans) {
    const rows = schedule(plan, input), stays = hotelStays(plan, input);
    assert.equal(totals(plan, input).tripDays, 10);
    assert.equal(totals(plan, input).nights, 9);
    assert.equal(totals(plan, input).lodging, 900);
    assert.equal(rows[0].trainQuote?.departure.slice(0, 10), rows[1].date);
    assert.equal(stays[0].checkOut, stays[1].checkIn);
    assert.equal(stays[0].checkIn, input.startDate);
    assert.equal(stays[1].checkOut, "2026-11-10");
  }
  assert.ok(seen.length > 0);
});

test("one form and relative-day results never present placeholder dates or Moscow flights as chosen", () => {
  const input = automatic(), plans = generateRoutes(input).plans;
  const form = renderToStaticMarkup(createElement(CreateScreen, { input, onChange: noop, errors: [], onSubmit: noop, home: true, routeSource: "demo", onRouteSource: noop }));
  assert.equal((form.match(/<form/g) ?? []).length, 1);
  for (const label of ["Спланируйте путешествие под себя", "На сколько дней?", "Что вам интересно в поездке?", "Какой темп вам подходит?", "Подобрать маршрут", "Первое доступное направление"]) assert.ok(form.includes(label), label);
  for (const label of ["Шаг 1 из 3", "Как разделим дни", "Москва", "Что происходит на эти даты", "Открыть Китай"]) assert.ok(!form.includes(label), label);
  const comparison = renderToStaticMarkup(createElement(CompareScreen, { input, plans, errors: [], onEdit: noop, onSelect: noop, routeSource: "demo", onRouteSource: noop, liveStatus: "idle", onSearch: noop, onCancel: noop }));
  const detail = renderToStaticMarkup(createElement(PlanScreen, { input, plan: reconcileCityPlans(plans[0], input), saved: false, onBack: noop, onSave: noop, onChange: noop, onHotel: noop, onTicket: noop, notice: "" }));
  for (const html of [comparison, detail]) {
    assert.ok(html.includes("Даты уточним позже"));
    assert.ok(!html.includes("Москв"));
    assert.ok(!html.includes("с днём приезда"));
  }
  assert.ok(comparison.includes("Указать даты"));
  assert.ok(detail.includes("Дни 1–"));
  assert.deepEqual(routeExplanation(plans[0], input).seasonalNotes, []);
  const picker = renderToStaticMarkup(createElement(OfferPicker, { type: "hotel", index: 0, input, plan: plans[0], onChange: noop, onClose: noop, onDates: noop }));
  assert.ok(picker.includes("Для поиска предложений нужны точные даты"));
  assert.ok(!picker.includes("Найти гостиницы"));
});

test("duration recovery keeps flexible dates unspecified while preserving required locations", () => {
  const source = automaticPreferences({ ...base(), days: 5, interests: ["city", "nature"] });
  const input = automaticPreferences({ ...source, journey: { ...source.journey!, requiredPlaces: ["zjj-yuanjiajie", "hua-mountains", "bei-wall", "sha-bund"] } });
  assert.equal(generateRoutes(input).plans.length, 0);
  const recovery = routeRecoveries(input).find(item => item.id === "longer-holiday");
  assert.ok(recovery);
  assert.ok(!recovery.hint.includes("Возвращение"));
  assert.ok(!recovery.message.includes("Возвращение"));
  assert.equal(recovery.input.journey!.flexibleDates, true);
  assert.deepEqual(recovery.input.journey!.requiredPlaces, input.journey!.requiredPlaces);
  assert.ok(generateRoutes(recovery.input).plans.length);
});

test("date ranges are inclusive across months, years and daylight-saving boundaries and reject invalid input", () => {
  assert.equal(dateRangeDays("2026-12-28", "2027-01-06"), 10);
  assert.equal(dateRangeDays("2027-03-27", "2027-04-02"), 7);
  assert.equal(dateRangeDays("2026-02-30", "2026-03-10"), null);
  assert.equal(dateRangeDays("2026-11-10", "2026-11-01"), null);
  assert.equal(rangeError("2026-11-01", "2026-11-05", "2026-10-27"), "");
  assert.ok(rangeError("2026-11-01", "2026-11-04", "2026-10-27"));
  assert.ok(rangeError("2026-11-01", "2026-11-29", "2026-10-27"));
  assert.ok(rangeError("2026-10-26", "2026-11-05", "2026-10-27"));
  assert.equal(shiftMonth("2026-12-31", 1), "2027-01-01");
  const cells = monthCells("2026-11-01");
  assert.equal(cells[6], "2026-11-01");
  assert.equal(cells.filter(Boolean).length, 30);
  assert.equal(parseEditableDate("06.01.2027"), "2027-01-06");
  assert.equal(parseEditableDate("30.02.2027"), "");
  assert.equal(parseEditableDate("06.01."), "");
  assert.equal(editableDate("2027-01-06"), "06.01.2027");
});
