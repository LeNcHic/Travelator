import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { cities, hotelsIn, ticketsBetween } from "../data/catalog";
import { allocateDays, defaultInput, generateRoutes, schedule, totals } from "./planner";
import { experienceAllocation, mandatoryCities, toJourneyInput, updateJourney } from "./journey";
import { routeAdjustments, routeDifference, routeExplanation } from "./route-adjustments";
import { isInput, isPlan, parseDraft } from "./storage";
import { inputForIdea, tripIdeas } from "../data/discovery";
import { tripKey } from "../../shared/trip-key";
import { validateLiveResult } from "./live-route-search";
import { createRailgoRouteSearch, validateRailgoTrip } from "../../server/railgo-routes";
import CompareScreen from "../components/CompareScreen";
import type { RoutePlan, TripInput } from "../types";
import type { FlyaiQuery, FlyaiResult } from "../../shared/flyai";

const base: TripInput = { ...toJourneyInput(defaultInput()), maxTrainMinutes: 120, startDate: "2026-11-02" };
const selectedPlan = (input: TripInput) => {
  const result = generateRoutes(input);
  assert.equal(result.errors.length, 0, result.errors.join());
  assert.equal(result.plans.length, 3);
  return result.plans[0];
};

test("fewer transfers preserve holiday, budget and every experience minimum", () => {
  const before = JSON.stringify(base), plan = selectedPlan(base);
  const action = routeAdjustments(base, plan).find(change => change.id === "fewer-stops")!;
  assert.ok(action.input);
  assert.equal(action.input.days, base.days);
  assert.equal(action.input.budget, base.budget);
  assert.deepEqual(action.input.journey!.daysByInterest, base.journey!.daysByInterest);
  for (const next of generateRoutes(action.input).plans) {
    assert.ok(next.cities.length < plan.cities.length);
    assert.ok(isPlan(next, action.input));
    assert.equal(totals(next, action.input).tripDays, base.days);
  }
  assert.equal(JSON.stringify(base), before);
});

test("mandatory cities and locations are never removed to reduce transfers", () => {
  const input = inputForIdea(base, tripIdeas[0]);
  input.journey = { ...input.journey!, requiredPlaces: ["han-westlake"] };
  const actions = routeAdjustments(input, selectedPlan(input));
  assert.equal(actions[0].input, undefined);
  assert.match(actions[0].hint, /обязательные/);
  for (const change of actions.filter(action => action.input)) {
    assert.deepEqual(mandatoryCities(change.input!), mandatoryCities(input));
    assert.deepEqual(change.input!.journey!.requiredPlaces, ["han-westlake"]);
  }
});

test("more nature increases actual allocated days, including days above the old requested minimum", () => {
  const cases = [base, inputForIdea(base, tripIdeas[0]), updateJourney({ ...base, days: 18 }, { ...base.journey!, daysByInterest: { city: 2, nature: 1, sea: 2 } })];
  for (const input of cases) {
    const plan = selectedPlan(input), before = routeExplanation(plan, input).experiences.find(item => item.kind === "nature")?.days ?? 0;
    const change = routeAdjustments(input, plan).find(action => action.id === "more-nature")!;
    assert.ok(change.input);
    assert.equal(change.input.days, input.days);
    assert.equal(change.input.startDate, input.startDate);
    assert.deepEqual(change.input.required, input.required);
    assert.ok(isInput(change.input));
    for (const next of generateRoutes(change.input).plans) {
      const actual: number = routeExplanation(next, change.input).experiences.find(item => item.kind === "nature")!.days;
      assert.ok(actual > before, `${actual} must exceed ${before}`);
      assert.ok(next.days.every(days => days >= 1));
    }
  }
});

test("nature changes preserve required visit floors and disable impossible changes", () => {
  const input = updateJourney(base, { ...base.journey!, minStops: 2, maxStops: 2, requiredPlaces: ["bei-palace", "bei-wall", "san-yalong"], daysByInterest: { city: 1, nature: 2, sea: 1 } });
  const action = routeAdjustments(input, selectedPlan(input)).find(change => change.id === "more-nature")!;
  assert.ok(action.input);
  assert.ok(action.input.journey!.daysByInterest.city >= 1);
  assert.ok(action.input.journey!.daysByInterest.sea >= 1);
  const tight = updateJourney({ ...base, days: 5 }, { ...base.journey!, minStops: 1, maxStops: 1, daysByInterest: { city: 1, nature: 2, sea: 0 }, requiredPlaces: ["bei-palace", "bei-wall"] });
  const blocked = routeAdjustments(tight, selectedPlan(tight)).find(change => change.id === "more-nature")!;
  assert.equal(blocked.input, undefined);
  assert.ok(blocked.hint.length);
});

test("sea finish affects every strategy, survives editing and storage, and rejects the old order", () => {
  const ids: RoutePlan["cities"] = ["san", "sha", "han"];
  const tickets = ids.slice(1).map((to, index) => ticketsBetween(ids[index], to).find(ticket => ticket.mode === "air" || ticket.minutes <= 120)!.id);
  const plan: RoutePlan = { id: "balance", calendarMode: "shared", cities: ids, tickets, days: allocateDays(ids, tickets, base)!, hotels: ids.map(city => hotelsIn(city)[0].id) };
  assert.ok(isPlan(plan, base), "exercise a valid route that does not finish at a coastal base");
  const action = routeAdjustments(base, plan).find(change => change.id === "sea-last")!;
  assert.ok(action.input?.seaEnd);
  assert.notEqual(cities[plan.cities.at(-1)!].interest, "sea");
  assert.equal(isPlan(plan, action.input), false);
  const input = updateJourney(action.input, action.input.journey!);
  assert.equal(input.seaEnd, true);
  assert.notEqual(tripKey(input), tripKey(base));
  for (const next of generateRoutes(input).plans) {
    assert.equal(cities[next.cities.at(-1)!].interest, "sea");
    assert.ok(isPlan(next, input));
    assert.ok(parseDraft(JSON.stringify({ version: 1, screen: "compare", input, plan: next }))?.input.seaEnd);
  }
  const automatic = routeAdjustments(input, selectedPlan(input)).find(change => change.id === "sea-last")!;
  assert.equal(automatic.active, true);
  assert.equal(automatic.input?.seaEnd, false);
  const noSea = updateJourney(input, { ...input.journey!, daysByInterest: { city: 3, nature: 4, sea: 0 } });
  assert.equal(noSea.seaEnd, false);
  assert.equal(routeAdjustments(noSea, selectedPlan(noSea))[2].input, undefined);
});

test("explanation reflects mixed experiences in one base and states the actual transport and calendar", () => {
  const input = updateJourney({ ...base, days: 7 }, { ...base.journey!, daysByInterest: { city: 2, nature: 1, sea: 0 }, minStops: 1, maxStops: 1, requiredPlaces: ["bei-wall"] });
  const plan = selectedPlan(input), explanation = routeExplanation(plan, input);
  assert.equal(explanation.experiences.reduce((sum, item) => sum + item.days, 0), 5);
  assert.ok(explanation.experiences.some(item => item.kind === "nature" && item.days >= 1));
  assert.deepEqual(explanation.stops[0].kinds, ["Города и культура", "Природа"]);
  assert.match(explanation.transport, /переездов между городами нет/);
  assert.match(explanation.calendar, /5 дней на месте/);
  assert.match(explanation.order, /Международные рейсы ещё не сравниваем/);
  const allocation = experienceAllocation(plan.cities, input, 5, plan.days)!;
  assert.equal(Object.values(allocation).flat().length, 5);
});

test("comparison explains both the price and time tradeoff", () => {
  const plans = generateRoutes(base).plans;
  const cheap = plans.find(plan => plan.id === "value")!, fast = plans.find(plan => plan.id === "fast")!;
  if (totals(cheap, base).total !== totals(fast, base).total) {
    assert.match(routeDifference(cheap, fast, base), /дороже/);
    assert.match(routeDifference(fast, cheap, base), /экономии/);
  }
  if (totals(cheap, base).minutes !== totals(fast, base).minutes) {
    assert.match(routeDifference(cheap, fast, base), /меньше.*в дороге/);
    assert.match(routeDifference(fast, cheap, base), /больше.*в дороге/);
  }
  assert.match(routeDifference(cheap, cheap, base), /Те же города и дни/);
  assert.doesNotMatch(routeDifference(cheap, cheap, base), /Другое распределение/);
});

test("sea finish is respected by the online RailGo route provider and the original client request", async () => {
  const input = { ...base, seaEnd: true, transport: "air" as const };
  const hotels = async (query: FlyaiQuery): Promise<FlyaiResult> => {
    assert.equal(query.kind, "hotel");
    if (query.kind !== "hotel") throw new Error("Unexpected query");
    return { source: "flyai", query, access: "personal_key", limited: false, searchedAt: "2026-10-25T12:00:00Z", offers: [{ id: "12345", name: "Test hotel", description: "", priceLabel: "200", url: null,
      hotelQuote: { source: "flyai", hotelId: "12345", name: "Test hotel", address: "", city: query.city, checkIn: query.checkIn, checkOut: query.checkOut, nightly: 200, currency: "CNY", priceBasis: "nightly_search_estimate", distanceKm: 2, searchedAt: "2026-10-25T12:00:00Z" } }] };
  };
  const now = () => new Date("2026-10-25T12:00:00Z");
  assert.equal(validateRailgoTrip(input, now()).seaEnd, true);
  const result = await createRailgoRouteSearch(hotels, async () => { throw new Error("Air mode must not query trains"); }, now)(input);
  assert.equal(result.plans.length, 3);
  assert.ok(result.plans.every(plan => cities[plan.cities.at(-1)!].interest === "sea"));
  assert.ok(validateLiveResult(result, input));
});

test("comparison shows the route choices immediately and keeps optional controls collapsed", () => {
  const noop = () => {};
  const html = renderToStaticMarkup(createElement(CompareScreen, { input: base, plans: generateRoutes(base).plans, errors: [], routeSource: "demo", onRouteSource: noop,
    liveStatus: "idle", onSearch: noop, onCancel: noop, onEdit: noop, onSelect: noop, onAdjust: noop, adjustmentNotice: "Пожелания обновлены", onUndoAdjustment: noop }));
  assert.ok(html.includes("Карта и объяснение маршрута"));
  assert.ok(html.includes("Отменить изменение"));
  assert.ok(html.includes("Подстроить варианты"));
  assert.ok(html.includes('aria-expanded="false" aria-controls="route-refine-options"'));
  assert.match(html, /<details class="route-option-details"><summary>/);
  assert.ok(html.indexOf("Выбрать маршрут") < html.indexOf("Уточнить предложения"));
  assert.ok(html.includes('aria-label="Вариант маршрута:'));
});
