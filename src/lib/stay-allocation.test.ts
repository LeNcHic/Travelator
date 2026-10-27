import test from "node:test";
import assert from "node:assert/strict";
import { defaultInput, generateRoutes, hotelStays, rankRoutePlans, routeSignature, totals } from "./planner";
import { experienceAllocation, mandatoryCities, toJourneyInput, updateJourney } from "./journey";
import { isPlan } from "./storage";
import { stayNotes, stayPenalty } from "./route-quality";
import { rebalancePreferences } from "../data/discovery";
import { cityIds } from "../data/catalog";
import { destinationProfiles } from "../data/destination-profiles";
import type { RoutePlan, TripInput } from "../types";

const base = { ...toJourneyInput(defaultInput()), startDate: "2026-11-02", maxTrainMinutes: 120 as const };
const trip = updateJourney({ ...base, required: ["bei", "han", "san"] }, {
  ...base.journey!, minStops: 3, maxStops: 3, daysByInterest: { city: 1, nature: 10, sea: 1 }, requiredPlaces: [],
});

test("nature is spread across compatible bases instead of ten days in Hangzhou and one elsewhere", () => {
  const result = generateRoutes(trip);
  assert.equal(result.plans.length, 3, result.errors.join());
  for (const plan of result.plans) {
    assert.ok(isPlan(plan, trip));
    const days = Object.fromEntries(plan.cities.map((city, i) => [city, plan.days[i]]));
    assert.ok(days.han <= destinationProfiles.han.max);
    assert.ok(plan.days.every(days => days >= 2));
    assert.equal(totals(plan, trip).tripDays, trip.days);
    const allocation = experienceAllocation(plan.cities, trip, 12, plan.days)!;
    assert.equal(Object.values(allocation).flat().filter(kind => kind === "nature").length, 10);
    assert.ok(allocation.bei!.includes("nature"));
    assert.ok(allocation.san!.includes("nature"));
  }
});

test("price cannot promote a badly concentrated stay over an affordable well-paced trip", () => {
  const good = generateRoutes(trip).plans[0];
  let bad: RoutePlan = { ...good, days: good.cities.map(city => city === "han" ? 10 : 1), hotelQuotes: undefined };
  bad.hotelQuotes = Object.fromEntries(hotelStays(bad, trip).map(stay => [stay.city, {
    source: "flyai", city: stay.city, hotelId: "123", name: "Test", address: "", checkIn: stay.checkIn, checkOut: stay.checkOut,
    nightly: 1, currency: "CNY", priceBasis: "nightly_search_estimate", searchedAt: "2026-10-26T12:00:00Z",
  }]));
  assert.ok(isPlan(bad, trip));
  assert.ok(totals(bad, trip).total < totals(good, trip).total);
  assert.ok(stayPenalty(bad, trip) > stayPenalty(good, trip));
  const ranked = rankRoutePlans([bad, good], trip);
  assert.ok(ranked.plans.every(plan => routeSignature(plan) === routeSignature(good)));
});

test("a deliberately chosen single-base beach holiday remains valid even for fourteen days", () => {
  const input = updateJourney({ ...base, days: 16, required: ["san"] }, {
    ...base.journey!, minStops: 1, maxStops: 1, daysByInterest: { city: 0, nature: 0, sea: 14 },
  });
  const result = generateRoutes(input);
  assert.equal(result.plans.length, 3);
  assert.ok(result.plans.every(plan => isPlan(plan, input) && plan.days[0] === 14));
  assert.equal(stayPenalty(result.plans[0], input), 0);
  assert.deepEqual(stayNotes(result.plans[0], input), []);
});

test("mandatory short stops remain feasible and their rushed pace is explained", () => {
  const input = updateJourney({ ...base, days: 5, required: ["bei", "han", "san"] }, {
    ...base.journey!, minStops: 3, maxStops: 3, daysByInterest: { city: 1, nature: 1, sea: 1 },
  });
  const result = generateRoutes(input);
  assert.equal(result.plans.length, 3);
  assert.ok(result.plans.every(plan => isPlan(plan, input) && plan.days.every(days => days === 1)));
  assert.equal(stayNotes(result.plans[0], input).length, 3);
});

test("allocation preserves requested visit floors, user inputs and every mandatory base", () => {
  const input = updateJourney({ ...trip, required: ["bei", "han", "san"] }, {
    ...trip.journey!, daysByInterest: { city: 2, nature: 7, sea: 3 }, requiredPlaces: ["bei-wall", "han-westlake", "san-yalong"],
  });
  const before = JSON.stringify(input), result = generateRoutes(input);
  assert.equal(result.plans.length, 3);
  for (const plan of result.plans) {
    assert.ok(isPlan(plan, input));
    assert.ok(mandatoryCities(input).every(city => plan.cities.includes(city)));
    const allocation = experienceAllocation(plan.cities, input, 12, plan.days)!;
    assert.ok(allocation.bei!.includes("nature") && allocation.han!.includes("nature") && allocation.san!.includes("sea"));
  }
  assert.equal(JSON.stringify(input), before);
});

test("short and long route matrices keep the full holiday, requested experiences and valid profiles", () => {
  for (const city of cityIds) assert.ok(destinationProfiles[city].min >= 2 && destinationProfiles[city].max >= destinationProfiles[city].min);
  const cases: { days: number; kinds: TripInput["interests"] }[] = [5, 7, 10, 14, 21, 28].flatMap(days =>
    [(["city"] as const), (["nature"] as const), (["sea"] as const), (["city", "nature", "sea"] as const)].map(kinds => ({ days, kinds: [...kinds] })));
  for (const sample of cases) {
    const input = rebalancePreferences(base, sample.kinds, sample.days, 1, 3), result = generateRoutes(input);
    assert.ok(result.plans.length > 0, JSON.stringify(sample) + result.errors.join());
    for (const plan of result.plans) {
      assert.ok(isPlan(plan, input));
      assert.equal(totals(plan, input).tripDays, sample.days);
      assert.ok(totals(plan, input).total <= input.budget);
    }
  }
});
