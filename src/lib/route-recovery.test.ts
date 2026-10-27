import test from "node:test";
import assert from "node:assert/strict";
import { inputForIdea, tripIdeas } from "../data/discovery";
import { defaultInput, generateRoutes, totals } from "./planner";
import { mandatoryCities, toJourneyInput, updateJourney } from "./journey";
import { isPlan } from "./storage";
import { routeRecoveries } from "./route-recovery";
import type { TripInput } from "../types";

const base = inputForIdea({ ...toJourneyInput(defaultInput()), startDate: "2026-11-02" }, tripIdeas[0]);

test("duration recovery preserves manual minimums and required visits instead of rebalancing them", () => {
  const input = updateJourney({ ...base, days: 11 }, { ...base.journey!, requiredPlaces: ["han-westlake"] });
  assert.equal(generateRoutes(input).plans.length, 0);
  const choice = routeRecoveries(input).find(action => action.id === "longer-holiday")!;
  assert.ok(choice);
  assert.equal(choice.input.days, 12);
  assert.deepEqual(choice.input, { ...input, days: 12 });
  for (const plan of generateRoutes(choice.input).plans) {
    assert.ok(isPlan(plan, choice.input));
    assert.equal(totals(plan, choice.input).tripDays, 12);
    assert.ok(mandatoryCities(input).every(city => plan.cities.includes(city)));
  }
});

test("a disconnected train-only route can recover without changing holiday, budget or locations", () => {
  const input: TripInput = { ...base, transport: "train" };
  assert.equal(generateRoutes(input).plans.length, 0);
  const choices = routeRecoveries(input);
  const mixed = choices.find(choice => choice.id === "mixed-transport")!;
  assert.ok(mixed);
  assert.deepEqual(mixed.input, { ...input, transport: "mixed", maxTrainMinutes: 120 });
  assert.ok(generateRoutes(mixed.input).plans.every(plan => isPlan(plan, mixed.input)));
  assert.ok(!choices.some(choice => choice.id === "longer-holiday"));
});

test("budget recovery uses a checked sufficient estimate and changes only the budget", () => {
  const input = { ...base, budget: 1000 };
  assert.equal(generateRoutes(input).plans.length, 0);
  const choice = routeRecoveries(input).find(action => action.id === "higher-budget")!;
  assert.ok(choice);
  assert.ok(choice.input.budget > 1000 && choice.input.budget <= 100000);
  assert.equal(choice.input.budget % 100, 0);
  assert.deepEqual(choice.input, { ...input, budget: choice.input.budget });
  for (const plan of generateRoutes(choice.input).plans) {
    assert.ok(isPlan(plan, choice.input));
    assert.ok(totals(plan, choice.input).total <= choice.input.budget);
  }
});

test("every offered correction is feasible, non-mutating and keeps the mandatory itinerary", () => {
  const cases: TripInput[] = [
    { ...base, budget: 1000 }, { ...base, transport: "train" }, { ...base, days: 11 },
    inputForIdea({ ...base, budget: 1000 }, tripIdeas.find(idea => idea.id === "pandas")!),
  ];
  for (const input of cases) {
    const before = JSON.stringify(input), choices = routeRecoveries(input);
    assert.ok(choices.length > 0);
    assert.equal(JSON.stringify(input), before);
    for (const choice of choices) {
      assert.deepEqual(choice.input.required, input.required);
      assert.deepEqual(choice.input.journey, input.journey);
      assert.equal(choice.input.startDate, input.startDate);
      const plans = generateRoutes(choice.input).plans;
      assert.ok(plans.length > 0);
      assert.ok(plans.every(plan => isPlan(plan, choice.input)));
    }
  }
});

test("no correction is offered if it cannot fix the constraints on its own", () => {
  assert.deepEqual(routeRecoveries({ ...base, days: 5, budget: 1000 }), []);
  const tooLong = updateJourney({ ...base, days: 28 }, { ...base.journey!, minStops: 5, maxStops: 5, daysByInterest: { city: 10, nature: 10, sea: 4 } });
  assert.deepEqual(routeRecoveries(tooLong), []);
  assert.deepEqual(routeRecoveries(base), []);
});

test("incomplete form values and legacy inputs do not produce speculative recovery actions", () => {
  for (const input of [{ ...base, days: NaN }, { ...base, budget: NaN }, { ...base, startDate: "2026-02-31" }, { ...base, journey: undefined }]) {
    assert.deepEqual(routeRecoveries(input), []);
  }
});
