import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { cities, cityIds, hotelsIn } from "../data/catalog";
import { destinationScores } from "../data/destination-scores";
import { interestWeights, routeFit, sequenceAttractiveness } from "./destination-fit";
import { buildRouteGraph, weightedCityPaths, type RouteGraph } from "./route-graph";
import { defaultInput, generateRoutes, hotelStays, rankRoutePlans, routeSignature, totals } from "./planner";
import { experienceAllocation, toJourneyInput, updateJourney } from "./journey";
import { distributeExperienceDays } from "./stay-allocation";
import { isPlan } from "./storage";
import CompareScreen from "../components/CompareScreen";
import type { CityId, Interest, RoutePlan, TripInput } from "../types";

const base: TripInput = { ...toJourneyInput(defaultInput()), startDate: "2026-11-02", maxTrainMinutes: 120 };
const nature = updateJourney({ ...base, days: 5 }, { ...base.journey!, minStops: 1, maxStops: 1, daysByInterest: { city: 0, nature: 3, sea: 0 } });
const withPrice = (city: CityId, nightly: number): RoutePlan => {
  const plan: RoutePlan = { id: "balance", calendarMode: "shared", cities: [city], days: [3], tickets: [], hotels: [hotelsIn(city)[0].id] };
  const stay = hotelStays(plan, nature)[0];
  return { ...plan, hotelQuotes: { [city]: { source: "flyai", city, hotelId: "123", name: "Test hotel", address: "",
    checkIn: stay.checkIn, checkOut: stay.checkOut, nightly, currency: "CNY", priceBasis: "nightly_search_estimate", searchedAt: "2026-10-26T12:00:00Z" } } };
};

test("editorial scores cover every city and cannot grant an unsupported experience", () => {
  assert.deepEqual(Object.keys(destinationScores).sort(), [...cityIds].sort());
  for (const city of cityIds) {
    const profile = destinationScores[city];
    assert.ok(profile.appeal >= 0 && profile.appeal <= 5 && profile.reason.length > 0);
    for (const kind of ["city", "nature", "sea"] as const) {
      assert.ok(profile.experiences[kind] >= 0 && profile.experiences[kind] <= 5);
      assert.equal(profile.experiences[kind] > 0, (cities[city].experiences ?? [cities[city].interest]).includes(kind));
    }
  }
});

test("category weights follow requested days and favour different destinations for nature and sea", () => {
  const input = updateJourney(base, { ...base.journey!, daysByInterest: { city: 2, nature: 6, sea: 2 } });
  assert.deepEqual(interestWeights(input), { city: .2, nature: .6, sea: .2 });
  assert.deepEqual(interestWeights(nature), { city: 0, nature: 1, sea: 0 });
  const sea = updateJourney(nature, { ...nature.journey!, daysByInterest: { city: 0, nature: 0, sea: 3 } });
  assert.ok(sequenceAttractiveness(["zjj"], nature) > sequenceAttractiveness(["han"], nature));
  assert.ok(sequenceAttractiveness(["zjj"], nature) > sequenceAttractiveness(["san"], nature));
  assert.ok(sequenceAttractiveness(["san"], sea) > sequenceAttractiveness(["zjj"], sea));
  assert.ok(sequenceAttractiveness(["sha"], sea) < sequenceAttractiveness(["bha"], sea));
});

test("the transport graph keeps actual directed connections, selected modes and the two-hour train limit", () => {
  const graph = buildRouteGraph({ ...base, transport: "train" }, cityIds);
  assert.ok(graph.get("sha")!.some(edge => edge.to === "han"));
  assert.ok(!graph.get("sha")!.some(edge => edge.to === "san"));
  for (const [from, edges] of graph) for (const edge of edges) {
    assert.equal(edge.from, from); assert.notEqual(edge.to, from);
    assert.ok(edge.options.length > 0);
    assert.ok(edge.options.every(ticket => ticket.from === from && ticket.to === edge.to && ticket.mode === "train" && ticket.minutes <= 120));
  }
  assert.ok([...buildRouteGraph({ ...base, transport: "air" }, cityIds).values()].flat().every(edge => edge.options.every(ticket => ticket.mode === "air")));
});

test("on a small graph the bounded search agrees with exhaustive path enumeration", () => {
  const graph = buildRouteGraph({ ...base, transport: "mixed" }, ["sha", "han", "bei", "san"]);
  const input = updateJourney(base, { ...base.journey!, minStops: 2, maxStops: 3 });
  const expected: string[] = [];
  const enumerate = (path: CityId[]) => {
    if (path.length >= 2 && path.includes("bei")) expected.push(path.join());
    if (path.length === 3) return;
    const choices = path.length ? graph.get(path.at(-1)!)!.map(edge => edge.to) : [...graph.keys()];
    for (const city of choices) if (!path.includes(city)) enumerate([...path, city]);
  };
  enumerate([]);
  const actual = weightedCityPaths(graph, input, ["bei"]);
  assert.deepEqual(actual.map(ids => ids.join()).sort(), expected.sort());
  assert.deepEqual(weightedCityPaths(graph, input, ["bei"]), actual, "deterministic tie-breaking");
});

test("beam pruning retains both attractive and cheap paths without cycles or lost mandatory cities", () => {
  const graph: RouteGraph = new Map(cityIds.map(from => [from, cityIds.filter(to => from !== to).map(to => {
    const cost = to === "zjj" ? 300 : 1;
    return { from, to, cost, minutes: 60, options: [{ id: `${from}:${to}`, from, to, mode: "air", service: "fixture",
      departure: 600, minutes: 60, overhead: 0, price: cost, detail: "synthetic graph edge" }] };
  })]));
  const input = updateJourney(base, { ...base.journey!, minStops: 5, maxStops: 5, daysByInterest: { city: 1, nature: 8, sea: 1 } });
  const paths = weightedCityPaths(graph, input, ["xan", "san"]);
  assert.ok(paths.length > 0 && paths.length <= 240 + cityIds.length * 3);
  assert.ok(paths.some(ids => ids.includes("zjj")));
  assert.ok(paths.some(ids => !ids.includes("zjj") && ids[0] !== "zjj"));
  for (const ids of paths) {
    assert.equal(ids.length, 5); assert.equal(new Set(ids).size, 5);
    assert.ok(ids.includes("xan") && ids.includes("san"));
    assert.ok(ids.slice(1).every((city, index) => graph.get(ids[index])!.some(edge => edge.to === city)));
  }
});

test("day allocation favours stronger experiences when stay lengths are otherwise comparable", () => {
  const assigned = { hua: [], zjj: [] } as unknown as Record<CityId, Interest[]>;
  assert.ok(distributeExperienceDays(["hua", "zjj"], { city: 0, nature: 7, sea: 0 }, assigned));
  assert.ok(assigned.zjj.length > assigned.hua.length);
  assert.equal(assigned.zjj.length + assigned.hua.length, 7);
});

test("fixed stays use the same quality-aware flow without depending on city order or losing spare days", () => {
  const input = updateJourney({ ...base, required: ["bei", "qin", "san"] }, { ...base.journey!, minStops: 3, maxStops: 3,
    daysByInterest: { city: 3, nature: 5, sea: 4 }, requiredPlaces: ["bei-wall"] });
  const ids: CityId[] = ["bei", "qin", "san"], days = [4, 4, 4];
  const before = JSON.stringify(input), allocation = experienceAllocation(ids, input, 12, days)!;
  const reverse = experienceAllocation([...ids].reverse(), input, 12, [...days].reverse())!;
  assert.deepEqual(allocation, reverse);
  assert.ok(allocation.bei!.includes("nature"));
  assert.ok(allocation.qin!.filter(kind => kind === "nature").length > allocation.san!.filter(kind => kind === "nature").length);
  const spare = updateJourney(input, { ...input.journey!, daysByInterest: { city: 1, nature: 1, sea: 1 } });
  const filled = experienceAllocation(ids, spare, 12, days)!;
  assert.ok(filled);
  assert.ok(ids.every((city, i) => filled[city]!.length === days[i]));
  assert.ok(filled.bei!.includes("nature"), "mandatory floor stays in place even when its remaining demand is zero");
  for (const kind of ["city", "nature", "sea"] as const) assert.ok(Object.values(filled).flat().includes(kind));
  assert.equal(JSON.stringify(input), before);
});

test("balance can choose richer nature over a slightly cheaper city while value and fast retain their meaning", () => {
  const cheap = withPrice("han", 400), richer = withPrice("zjj", 410);
  assert.ok(isPlan(cheap, nature) && isPlan(richer, nature));
  assert.ok(totals(cheap, nature).total < totals(richer, nature).total);
  const inputBefore = JSON.stringify(nature), plansBefore = JSON.stringify([cheap, richer]);
  const result = rankRoutePlans([cheap, richer], nature);
  assert.equal(result.plans.find(plan => plan.id === "value")!.cities[0], "han");
  assert.equal(result.plans.find(plan => plan.id === "fast")!.cities[0], "han");
  assert.equal(result.plans.find(plan => plan.id === "balance")!.cities[0], "zjj");
  const evaluate = (plan: RoutePlan) => routeFit(plan, nature, experienceAllocation(plan.cities, nature, 3, plan.days));
  assert.ok(evaluate(richer).total > evaluate(cheap).total);
  assert.equal(JSON.stringify(nature), inputBefore); assert.equal(JSON.stringify([cheap, richer]), plansBefore);
  const expensive = withPrice("zjj", 1000);
  assert.equal(rankRoutePlans([cheap, expensive], nature).plans.find(plan => plan.id === "balance")!.cities[0], "han");
  assert.ok(rankRoutePlans([cheap, richer], { ...nature, budget: 1210 }).plans.every(plan => plan.cities[0] === "han"));
  const outlier = withPrice("han", 5000);
  const enlarged = rankRoutePlans([outlier, richer, cheap], { ...nature, budget: 100000 });
  assert.equal(routeSignature(enlarged.plans.find(plan => plan.id === "balance")!), routeSignature(result.plans.find(plan => plan.id === "balance")!));
});

test("complete routes and explanations retain mandatory places, exact calendars, budget and bounded interest scores", () => {
  const noop = () => {};
  for (const distribution of [{ city: 2, nature: 8, sea: 2 }, { city: 7, nature: 2, sea: 3 }, { city: 2, nature: 2, sea: 8 }]) {
    const input = updateJourney({ ...base, required: ["bei"] }, { ...base.journey!, minStops: 3, maxStops: 4,
      daysByInterest: distribution, requiredPlaces: ["bei-wall"] });
    const result = generateRoutes(input);
    assert.equal(result.plans.length, 3, result.errors.join());
    for (const plan of result.plans) {
      assert.ok(isPlan(plan, input) && plan.cities.includes("bei"));
      assert.equal(totals(plan, input).tripDays, input.days);
      assert.ok(totals(plan, input).total <= input.budget);
      const allocation = experienceAllocation(plan.cities, input, plan.days.reduce((a, b) => a + b), plan.days)!;
      assert.ok(allocation.bei!.includes("nature"));
      const fit = routeFit(plan, input, allocation);
      assert.ok(Number.isFinite(fit.total) && fit.total >= 0 && fit.total <= 100);
    }
    const html = renderToStaticMarkup(createElement(CompareScreen, { input, ...result, routeSource: "demo", liveStatus: "idle",
      onRouteSource: noop, onSearch: noop, onCancel: noop, onEdit: noop, onSelect: noop }));
    assert.ok(html.includes("Великая китайская стена"), "the required highlight remains visible in the recommendation");
    assert.ok(html.includes("Карта и объяснение маршрута"));
    assert.ok(html.includes("Выбрать маршрут"));
  }
});
