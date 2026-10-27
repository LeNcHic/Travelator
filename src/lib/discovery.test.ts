import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { tripIdeas, inputForIdea, rebalancePreferences, toggleRequiredDestination } from "../data/discovery";
import { cities } from "../data/catalog";
import { defaultInput, generateRoutes, validateInput, totals } from "./planner";
import { mandatoryCities, requiredPlaces, toJourneyInput, updateJourney } from "./journey";
import { parseDraft } from "./storage";
import DiscoverScreen from "../components/DiscoverScreen";
import CompareScreen from "../components/CompareScreen";

const base = { ...toJourneyInput(defaultInput()), startDate: "2026-11-02" };
const noop = () => {};

test("all discovery ideas produce feasible full holidays and preserve the user's departure date", () => {
  for (const idea of tripIdeas) {
    const input = inputForIdea(base, idea);
    assert.equal(input.startDate, base.startDate);
    assert.deepEqual(validateInput(input), []);
    const result = generateRoutes(input);
    assert.equal(result.plans.length, 3);
    for (const plan of result.plans) {
      assert.equal(totals(plan, input).tripDays, idea.days);
      assert.ok(idea.cities.every(city => plan.cities.includes(city)));
      assert.ok(parseDraft(JSON.stringify({ version: 1, input, plan, screen: "discover" }))?.plan);
    }
  }
});

test("duration and mood changes remain feasible for short and long holidays", () => {
  for (const days of [7, 10, 14, 21, 28]) {
    const input = rebalancePreferences(base, ["city", "nature", "sea"], days, 3, 3);
    assert.deepEqual(validateInput(input), [], `${days} days`);
    assert.equal(generateRoutes(input).plans.length, 3);
  }
  const beach = rebalancePreferences(base, ["sea"], 7, 1, 1);
  assert.equal(beach.journey?.minStops, 1);
  assert.equal(beach.journey?.maxStops, 1);
  assert.ok(generateRoutes(beach).plans.every(plan => plan.cities.length === 1 && cities[plan.cities[0]].interest === "sea"));
  const long = rebalancePreferences(base, ["city", "nature", "sea"], 28, 1, 2);
  assert.deepEqual(validateInput(long), []);
});

test("country discovery offers six actual destinations and keeps the builder separate", () => {
  const html = renderToStaticMarkup(createElement(DiscoverScreen, { selected: ["sha"], onToggleCity: noop, onStart: noop, onIdea: noop }));
  for (const name of ["Шанхай", "Пекин", "Чжанцзяцзе", "Гуйлинь", "Санья", "Ханчжоу"]) assert.ok(html.includes(name));
  assert.equal((html.match(/class="destination-card(?:\s|")/g) ?? []).length, 6);
  assert.ok(html.includes("Подобрать путешествие"));
  assert.ok(!html.includes('type="date"'));
});

test("removing a destination selected through a landmark removes its city wish consistently", () => {
  const input = updateJourney({ ...base, required: ["sha"] }, { ...base.journey!, requiredPlaces: ["xan-terracotta"], daysByInterest: { city: 7, nature: 0, sea: 0 } });
  const previous = JSON.stringify(input), next = toggleRequiredDestination(input, "xan")!;
  assert.deepEqual(mandatoryCities(input), ["sha", "xan"]);
  assert.deepEqual(mandatoryCities(next), ["sha"]);
  assert.deepEqual(next.journey!.requiredPlaces, []);
  assert.deepEqual(next.journey!.daysByInterest, input.journey!.daysByInterest);
  assert.equal(JSON.stringify(input), previous);
});

test("the five-base selection limit counts cities chosen through landmarks too", () => {
  const wishes = ["sha", "bei", "zjj", "gui", "xan"] as const;
  const places = wishes.map(city => requiredPlaces.find(place => place.city === city)!.id);
  const input = updateJourney({ ...base, required: [] }, { ...base.journey!, minStops: 5, maxStops: 5, requiredPlaces: places });
  assert.equal(mandatoryCities(input).length, 5);
  assert.equal(toggleRequiredDestination(input, "che"), null);
  const next = toggleRequiredDestination(input, "xan")!;
  assert.equal(mandatoryCities(next).length, 4);
  assert.ok(toggleRequiredDestination(next, "che"));
});

test("removing a panda visit does not introduce a new city interest or rebalance custom rest minima", () => {
  const input = updateJourney({ ...base, required: [] }, { ...base.journey!, requiredPlaces: ["che-pandas"], daysByInterest: { city: 0, nature: 6, sea: 0 } });
  const next = toggleRequiredDestination(input, "che")!;
  assert.deepEqual(next.interests, ["nature"]);
  assert.deepEqual(next.journey!.daysByInterest, { city: 0, nature: 6, sea: 0 });
  assert.deepEqual(mandatoryCities(next), []);
});

test("adding a city expands the range around every mandatory base and preserves manual minima", () => {
  const input = updateJourney({ ...base, required: ["sha"] }, { ...base.journey!, minStops: 1, maxStops: 2, requiredPlaces: ["xan-terracotta"], daysByInterest: { city: 7, nature: 0, sea: 0 } });
  const next = toggleRequiredDestination(input, "bei")!;
  assert.equal(mandatoryCities(next).length, 3);
  assert.equal(next.journey!.minStops, 3);
  assert.equal(next.journey!.maxStops, 3);
  assert.deepEqual(next.journey!.daysByInterest, input.journey!.daysByInterest);
  assert.deepEqual(next.journey!.requiredPlaces, ["xan-terracotta"]);
});

test("online failures leave the preliminary plan usable, duplicates collapse, and old demo trips can request online checks", () => {
  const input = inputForIdea(base, tripIdeas[2]), plan = generateRoutes(input).plans[0];
  const plans = (["balance", "value", "fast"] as const).map(id => ({ ...plan, id }));
  for (const routeSource of ["demo", "flyai"] as const) {
    const html = renderToStaticMarkup(createElement(CompareScreen, { input, plans, errors: ["Provider unavailable"],
      routeSource, onRouteSource: noop, liveStatus: "error", onSearch: noop, onCancel: noop, onEdit: noop, onSelect: noop }));
    assert.ok(html.includes("Выбрать маршрут"));
    assert.ok(html.includes("Повторить проверку"));
    assert.ok(html.includes("Provider unavailable"));
    assert.ok(html.includes("Предварительная оценка"));
    assert.equal((html.match(/<article class="route-option /g) ?? []).length, 1);
    assert.ok(html.includes("Один маршрут подошёл всем трём критериям"));
  }
});
