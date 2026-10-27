import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { attractionsIn } from "../data/attractions";
import { hotelsIn, ticketsBetween } from "../data/catalog";
import { defaultInput, generateRoutes, totals } from "./planner";
import { experienceAllocation, toJourneyInput, updateJourney } from "./journey";
import { attractionInterest, cityDays } from "./city-planner";
import { routePreview } from "./route-preview";
import { routeDifference } from "./route-adjustments";
import { isPlan } from "./storage";
import CompareScreen from "../components/CompareScreen";
import type { CityId, RoutePlan, TripInput } from "../types";

const base = { ...toJourneyInput(defaultInput()), startDate: "2026-12-29", maxTrainMinutes: 120 as const };
const noop = () => {};

test("pace changes the route's rhythm while keeping the same holiday, wishes and allowed city range", () => {
  const input = updateJourney(base, { ...base.journey!, minStops: 2, maxStops: 4, daysByInterest: { city: 4, nature: 4, sea: 0 } });
  const before = JSON.stringify(input);
  const slow = generateRoutes({ ...input, pace: "slow" }).plans;
  const active = generateRoutes({ ...input, pace: "active" }).plans;
  assert.equal(slow.length, 3); assert.equal(active.length, 3);
  assert.ok(slow.every(plan => plan.cities.length < active[0].cities.length));
  for (const pace of ["slow", "balanced", "active"] as const) for (const plan of generateRoutes({ ...input, pace }).plans) {
    assert.ok(isPlan(plan, { ...input, pace }));
    assert.equal(totals(plan, input).tripDays, input.days);
    assert.ok(plan.cities.length >= 2 && plan.cities.length <= 4);
    assert.ok(totals(plan, input).total <= input.budget);
  }
  assert.equal(JSON.stringify(input), before);
});

test("pace influences day distribution for fixed bases without reducing experience minima", () => {
  const ids: CityId[] = ["bei", "han", "san"];
  const input = updateJourney({ ...base, required: ids }, { ...base.journey!, minStops: 3, maxStops: 3, daysByInterest: { city: 2, nature: 6, sea: 4 } });
  const slow = experienceAllocation(ids, { ...input, pace: "slow" }, 12)!;
  const active = experienceAllocation(ids, { ...input, pace: "active" }, 12)!;
  assert.ok(slow.han!.length > active.han!.length);
  for (const allocation of [slow, active]) {
    const actual = Object.values(allocation).flat();
    assert.equal(actual.length, 12);
    for (const kind of ["city", "nature", "sea"] as const)
      assert.ok(actual.filter(value => value === kind).length >= input.journey!.daysByInterest[kind]);
  }
});

test("slow pace remains a soft preference when mandatory bases only allow one-day stays", () => {
  const input = updateJourney({ ...base, days: 5, pace: "slow", required: ["bei", "han", "san"] }, {
    ...base.journey!, minStops: 3, maxStops: 3, daysByInterest: { city: 1, nature: 1, sea: 1 },
  });
  const result = generateRoutes(input);
  assert.equal(result.plans.length, 3, result.errors.join());
  assert.ok(result.plans.every(plan => isPlan(plan, input) && plan.days.every(days => days === 1)));
});

test("preview dates match the calendar across a year boundary and selected landmarks come first", () => {
  const input = updateJourney({ ...base, required: ["che", "xan"], days: 12 }, {
    ...base.journey!, minStops: 2, maxStops: 2, daysByInterest: { city: 5, nature: 4, sea: 0 }, requiredPlaces: ["xan-terracotta"],
  });
  const plan = generateRoutes(input).plans[0], before = JSON.stringify({ plan, input });
  const preview = routePreview(plan, input);
  assert.equal(preview[0].date, "2026-12-30");
  assert.equal(preview.at(-1)!.endDate, "2027-01-08");
  assert.equal(preview.find(row => row.city === "xan")!.highlights[0].id, "xan-terracotta");
  const chengdu = preview.find(row => row.city === "che")!;
  assert.ok(chengdu.highlights.some(place => attractionInterest(place) === "nature"));
  assert.ok(chengdu.highlights.some(place => attractionInterest(place) === "city"));
  for (const row of preview) {
    assert.ok(row.highlights.length <= 2);
    const actual = cityDays(plan, input, row.city).flat();
    assert.ok(row.highlights.every(place => place.city === row.city && actual.includes(place.id)));
  }
  assert.equal(JSON.stringify({ plan, input }), before);
});

test("a preview respects manually edited and intentionally empty city plans", () => {
  const input = { ...defaultInput(), startDate: "2026-12-29" }, generated = generateRoutes(input).plans[0];
  const city = generated.cities[0], place = attractionsIn(city).at(-1)!;
  const visits = Array.from({ length: generated.days[0] }, () => [] as string[]);
  visits.at(-1)!.push(place.id);
  const plan = { ...generated, visits: { [city]: visits } };
  assert.deepEqual(routePreview(plan, input)[0].highlights.map(place => place.id), [place.id]);
  assert.deepEqual(routePreview({ ...plan, visits: { [city]: visits.map(() => []) } }, input)[0].highlights, []);
});

test("comparison distinguishes another city, a different order, different days and only different transfers", () => {
  const input = { ...defaultInput(), startDate: "2026-11-02" };
  const fixture = (ids: CityId[], days = [3, 3, 4]): RoutePlan => ({ id: "balance", cities: ids, days,
    tickets: ids.slice(1).map((city, index) => ticketsBetween(ids[index], city)[0].id), hotels: ids.map(city => hotelsIn(city)[0].id) });
  const main = fixture(["sha", "han", "san"]);
  assert.match(routeDifference(main, fixture(["sha", "gui", "san"]), input), /Гуйлинь вместо Ханчжоу/);
  assert.match(routeDifference(main, fixture(["han", "sha", "san"]), input), /Те же города, другой порядок/);
  assert.match(routeDifference(main, fixture(["sha", "han", "san"], [4, 2, 4]), input), /другое распределение дней/);
  const options = ticketsBetween("sha", "han");
  assert.ok(options.length > 1);
  assert.match(routeDifference(main, { ...main, tickets: [options[1].id, main.tickets[1]] }, input), /другие переезды/);
  assert.doesNotMatch(routeDifference(main, main, input), /Другой|Другое|другие/);
});

test("route cards explain what to see and complete dates before the single choose action", () => {
  const input: TripInput = { ...base, required: ["che", "xan"], days: 12,
    journey: { ...base.journey!, minStops: 2, maxStops: 2, daysByInterest: { city: 5, nature: 4, sea: 0 }, requiredPlaces: ["xan-terracotta"] } };
  const result = generateRoutes(input);
  const html = renderToStaticMarkup(createElement(CompareScreen, { input, ...result, routeSource: "demo", liveStatus: "idle",
    onRouteSource: noop, onSearch: noop, onCancel: noop, onEdit: noop, onSelect: noop }));
  assert.ok(html.includes("Терракотовая армия"));
  assert.ok(html.includes("2026") && html.includes("2027"));
  assert.ok(html.indexOf("Терракотовая армия") < html.indexOf("Выбрать маршрут"));
  assert.ok(html.includes("с днём приезда"));
});
