import test from "node:test";
import assert from "node:assert/strict";
import { cities, hotelsIn, ticketById, ticketsBetween } from "../data/catalog";
import {
  allocateDays,
  defaultInput,
  generateRoutes,
  routeSignature,
  totals,
} from "./planner";
import { isPlan, parseDraft, parseSaved } from "./storage";
import type { CityId, RoutePlan } from "../types";

test("three real objectives select different default journeys; priority only changes recommendation", () => {
  const input = defaultInput(),
    base = generateRoutes(input).plans;
  assert.deepEqual(
    base.map((p) => p.id),
    ["balance", "value", "fast"],
  );
  assert.equal(new Set(base.map(routeSignature)).size, 3);
  const cost = totals(
    base.find((p) => p.id === "value")!,
    input,
  );
  const fast = totals(
    base.find((p) => p.id === "fast")!,
    input,
  );
  const balance = totals(
    base.find((p) => p.id === "balance")!,
    input,
  );
  assert.ok(cost.total < balance.total && balance.total < fast.total);
  assert.ok(fast.minutes < balance.minutes && balance.minutes < cost.minutes);
  for (const priority of ["fast", "value", "balance"] as const) {
    const plans = generateRoutes({ ...input, priority }).plans;
    assert.equal(plans[0].id, priority);
    for (const plan of plans)
      assert.equal(
        routeSignature(plan),
        routeSignature(base.find((p) => p.id === plan.id)!),
      );
  }
});

test("automatic ordering improves an inefficient sequence while fixing start/end and required cities", () => {
  const input = {
    ...defaultInput(),
    days: 20,
    required: ["gui", "bei", "zjj"] as CityId[],
  };
  const fixed = generateRoutes({ ...input, cityOrder: "fixed" }).plans;
  const automatic = generateRoutes({ ...input, cityOrder: "auto" }).plans;
  for (const plan of fixed)
    assert.deepEqual(plan.cities, ["sha", "gui", "bei", "zjj", "san"]);
  for (const plan of automatic) {
    assert.equal(plan.cities[0], "sha");
    assert.equal(plan.cities.at(-1), "san");
    assert.deepEqual(
      [...plan.cities].sort(),
      ["sha", "gui", "bei", "zjj", "san"].sort(),
    );
    assert.ok(isPlan(plan, input));
  }
  assert.ok(
    totals(
      automatic.find((p) => p.id === "fast")!,
      input,
    ).minutes <
      totals(
        fixed.find((p) => p.id === "fast")!,
        input,
      ).minutes,
  );
  assert.ok(
    totals(
      automatic.find((p) => p.id === "value")!,
      input,
    ).total <
      totals(
        fixed.find((p) => p.id === "value")!,
        input,
      ).total,
  );
});

test("cheapest and fastest match exhaustive independent ticket-pair enumeration", () => {
  const input = {
    ...defaultInput(),
    required: ["gui"] as CityId[],
    cityOrder: "fixed" as const,
    budget: 5500,
  };
  const alternatives: { total: number; minutes: number }[] = [];
  for (const a of ticketsBetween("sha", "gui"))
    for (const b of ticketsBetween("gui", "san")) {
      const ids: CityId[] = ["sha", "gui", "san"];
      const tickets = [a.id, b.id],
        days = allocateDays(ids, tickets, input);
      if (!days) continue;
      const plan: RoutePlan = {
        id: "value",
        cities: ids,
        tickets,
        days,
        hotels: ids.map(
          (id) =>
            hotelsIn(id).reduce((best, next) =>
              best.nightly < next.nightly ? best : next,
            ).id,
        ),
      };
      const t = totals(plan, input);
      if (t.total <= input.budget) alternatives.push(t);
    }
  const { plans, errors } = generateRoutes(input);
  assert.deepEqual(errors, []);
  assert.equal(
    totals(
      plans.find((p) => p.id === "value")!,
      input,
    ).total,
    Math.min(...alternatives.map((t) => t.total)),
  );
  assert.equal(
    totals(
      plans.find((p) => p.id === "fast")!,
      input,
    ).minutes,
    Math.min(...alternatives.map((t) => t.minutes)),
  );
  assert.ok(plans.every((p) => totals(p, input).total <= input.budget));
});

test("balance is nondominated and can coincide with another winner under tight constraints", () => {
  const base = defaultInput(),
    cheap = generateRoutes(base).plans.find((p) => p.id === "value")!;
  const input = { ...base, budget: totals(cheap, base).total };
  const { plans, errors } = generateRoutes(input);
  assert.deepEqual(errors, []);
  assert.equal(plans.length, 3);
  assert.ok(new Set(plans.map(routeSignature)).size < 3);
  const balance = totals(
    plans.find((p) => p.id === "balance")!,
    input,
  );
  assert.ok(
    plans.every((p) => {
      const t = totals(p, input);
      return !(
        t.total <= balance.total &&
        t.minutes <= balance.minutes &&
        (t.total < balance.total || t.minutes < balance.minutes)
      );
    }),
  );
});

test("search explains insufficient budget and duration without exceeding either constraint", () => {
  const budget = generateRoutes({ ...defaultInput(), budget: 1000 });
  assert.equal(budget.plans.length, 0);
  assert.match(budget.errors.join(" "), /минимум ¥/);
  assert.match(budget.errors.join(" "), /Увеличьте бюджет/);
  const duration = generateRoutes({
    ...defaultInput(),
    required: ["bei", "gui", "zjj"],
    days: 7,
  });
  assert.equal(duration.plans.length, 0);
  assert.match(duration.errors.join(" "), /минимум 16 дней/);
});

test("fixed order permits useful optional cities between mandatory stops", () => {
  const input = {
    ...defaultInput(),
    start: "bei" as const,
    required: ["sha"] as CityId[],
    cityOrder: "fixed" as const,
  };
  for (const plan of generateRoutes(input).plans) {
    assert.equal(plan.cities[0], "bei");
    assert.equal(plan.cities.at(-1), "san");
    assert.ok(plan.cities.includes("sha"));
    assert.ok(plan.cities.some((id) => cities[id].interest === "nature"));
    assert.ok(plan.tickets.every((id) => ticketById(id)));
  }
});

test("old saved trips migrate without losing selected offers or fixed ordering", () => {
  const input = { ...defaultInput(), cityOrder: "fixed" as const };
  const plan = generateRoutes(input).plans.find((p) => p.id === "fast")!;
  const { priority: _priority, cityOrder: _order, ...legacyInput } = input;
  const restored = parseDraft(
    JSON.stringify({ version: 1, input: legacyInput, plan, screen: "plan" }),
  )!;
  assert.equal(restored.input.priority, "balance");
  assert.equal(restored.input.cityOrder, "fixed");
  assert.deepEqual(restored.plan, plan);
  const saved = parseSaved(
    JSON.stringify([
      { id: "legacy", savedAt: "2026-10-25", input: legacyInput, plan },
    ]),
  );
  assert.equal(saved.length, 1);
  assert.deepEqual(saved[0].plan, plan);
  assert.equal(
    parseDraft(
      JSON.stringify({
        ...restored,
        input: { ...restored.input, priority: "bogus" },
      }),
    ),
    null,
  );
});
