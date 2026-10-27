import test from "node:test";
import assert from "node:assert/strict";
import { attractionsIn, attractionById } from "../data/attractions";
import { cityIds } from "../data/catalog";
import {
  assignVisit,
  cityDays,
  dayCapacity,
  dayMinutes,
  distributeVisits,
  reconcileCityPlans,
  reorderVisit,
} from "./city-planner";
import {
  changeTicket,
  defaultInput,
  generateRoutes,
  moveDay,
  replaceCity,
  schedule,
  totals,
} from "./planner";
import { isPlan, parseDraft, parseSaved } from "./storage";

const input = { ...defaultInput(), startDate: "2026-12-29" };
const fixture = () => reconcileCityPlans(generateRoutes(input).plans[0], input);

test("local suggestions respect pace, contain only unique city places and leave room for free days", () => {
  for (const city of cityIds)
    for (const pace of ["slow", "balanced", "active"] as const)
      for (const count of [1, 2, 4, 10]) {
        const days = distributeVisits(city, count, pace),
          ids = days.flat();
        assert.equal(days.length, count);
        assert.equal(new Set(ids).size, ids.length);
        assert.ok(ids.every((id) => attractionById(id)?.city === city));
        assert.ok(days.every((ids) => dayMinutes(ids) <= dayCapacity(pace)));
        if (count === 10) {
          assert.equal(ids.length, attractionsIn(city).filter(place => place.minutes <= dayCapacity(pace)).length);
          assert.ok(days.some((ids) => ids.length === 0));
        }
      }
  assert.ok(distributeVisits("bei", 1, "slow").flat().length < 6);
});

test("reordering and assigning preserve uniqueness and other cities without mutating input", () => {
  const plan = fixture(),
    before = structuredClone(plan),
    city = plan.cities[0];
  const first = cityDays(plan, input, city)[0];
  assert.ok(first.length >= 2);
  const reordered = reorderVisit(plan, input, city, 0, 0, 1)!;
  assert.deepEqual(reordered.visits![city]![0], [first[1], first[0]]);
  assert.deepEqual(plan, before);
  assert.equal(reorderVisit(plan, input, city, 0, 0, -1), null);
  assert.equal(assignVisit(plan, input, city, first[0], 99), null);
  assert.equal(assignVisit(plan, input, city, "bei-palace", 0), null);
  const moved = assignVisit(reordered, input, city, first[0], 1)!;
  assert.equal(moved.visits![city]![1].at(-1), first[0]);
  assert.equal(
    moved.visits![city]!.flat().filter((id) => id === first[0]).length,
    1,
  );
  const removed = assignVisit(moved, input, city, first[0], null)!;
  assert.ok(!removed.visits![city]!.flat().includes(first[0]));
  const other = plan.cities[1];
  assert.deepEqual(removed.visits![other], plan.visits![other]);
  assert.deepEqual(totals(removed, input), totals(plan, input));
  assert.deepEqual(schedule(removed, input), schedule(plan, input));
});

test("shorter stays merge overflow without losing places; longer stays preserve empty days", () => {
  const plan = fixture(),
    city = plan.cities[0],
    count = plan.days[0];
  const ids = attractionsIn(city).map((p) => p.id);
  plan.visits![city] = Array.from({ length: count }, (_, i) =>
    i === count - 1 ? ids : [],
  );
  const shorter = reconcileCityPlans(moveDay(plan, input, 0, -1)!, input);
  assert.equal(shorter.visits![city]!.length, count - 1);
  assert.deepEqual(shorter.visits![city]!.at(-1), ids);
  assert.ok(isPlan(shorter, input));
  const longer = reconcileCityPlans(moveDay(shorter, input, 0, 1)!, input);
  assert.deepEqual(longer.visits![city]!.flat(), ids);
  assert.deepEqual(longer.visits![city]!.at(-1), []);
  const empty = {
    ...plan,
    visits: { ...plan.visits, [city]: Array.from({ length: count }, () => []) },
  };
  assert.deepEqual(reconcileCityPlans(empty, input).visits![city]!.flat(), []);
});

test("ticket and city replacements reconcile local plans, preserving unaffected visits", () => {
  const plan = fixture(),
    city = plan.cities[0];
  const manual = reorderVisit(plan, input, city, 0, 0, 1)!;
  const ticket = `${plan.cities[0]}-${plan.cities[1]}-train-1`;
  const next = reconcileCityPlans(
    changeTicket(manual, input, 0, ticket)!,
    input,
    manual.visits,
  );
  assert.deepEqual(next.visits![city]!.flat(), manual.visits![city]!.flat());
  assert.ok(isPlan(next, input));
  const swapped = reconcileCityPlans(
    replaceCity(manual, input, 1, "zjj")!,
    input,
    manual.visits,
  );
  assert.ok(!("gui" in swapped.visits!));
  assert.deepEqual(swapped.visits!.sha!.flat(), manual.visits!.sha!.flat());
  assert.ok(
    swapped
      .visits!.zjj!.flat()
      .every((id) => attractionById(id)?.city === "zjj"),
  );
  assert.ok(isPlan(swapped, input));
});

test("local edits roundtrip through drafts and saved trips; legacy plans remain readable", () => {
  const plan = assignVisit(fixture(), input, "sha", "sha-bund", null)!;
  const snapshot = { version: 1, screen: "plan", input, plan };
  assert.deepEqual(parseDraft(JSON.stringify(snapshot))!.plan, plan);
  assert.deepEqual(
    parseSaved(
      JSON.stringify([{ id: "city", savedAt: "2026-10-25", input, plan }]),
    )[0].plan,
    plan,
  );
  const { visits: _, ...legacy } = plan;
  assert.ok(isPlan(legacy, input));
  assert.equal(cityDays(legacy, input, "sha").length, legacy.days[0]);
  for (const visits of [
    null,
    [],
    { sha: [["unknown"]] },
    { sha: [["bei-palace"], [], [], []] },
    { sha: [["sha-bund", "sha-bund"], [], [], []] },
    { bei: [[], []] },
  ]) {
    assert.equal(isPlan({ ...plan, visits }, input), false);
  }
});
