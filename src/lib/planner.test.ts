import test from "node:test";
import assert from "node:assert/strict";
import {
  cityIds,
  cities,
  hotelsIn,
  hotelById,
  ticketById,
  ticketsBetween,
} from "../data/catalog";
import { addDays } from "./format";
import {
  allocateDays,
  changeTicket,
  defaultInput,
  generateRoutes,
  minimumDays,
  moveDay,
  replaceCity,
  schedule,
  totals,
  transferDays,
} from "./planner";
import { isPlan, parseDraft, parseSaved } from "./storage";
import type { RoutePlan, TripInput } from "../types";

// Stable existing itinerary: editing must continue to work regardless of which
// cities the new optimizer selects as its winners.
function editablePlan(input: TripInput = defaultInput()): RoutePlan {
  const ids: RoutePlan["cities"] = [
    "sha",
    ...input.required.filter((id) => id !== "zjj"),
    "zjj",
    "san",
  ];
  const tickets = ids.slice(1).map((id, i) => `${ids[i]}-${id}-air-0`);
  return {
    id: "fast",
    cities: ids,
    days: allocateDays(ids, tickets, input)!,
    tickets,
    hotels: ids.map((id) => hotelsIn(id)[1].id),
  };
}

test("default trip covers interests and accounts for every day and night", () => {
  const input = defaultInput(),
    { plans, errors } = generateRoutes(input);
  assert.deepEqual(errors, []);
  assert.equal(plans.length, 3);
  for (const plan of plans) {
    assert.ok(isPlan(plan, input));
    assert.equal(
      plan.days.reduce((a, b) => a + b, 0) + totals(plan, input).transferDays,
      14,
    );
    assert.equal(schedule(plan, input).at(-1)!.last, 13);
    assert.equal(
      totals(plan, input).nights +
        totals(plan, input).transferDays -
        plan.tickets.length,
      13,
    );
    assert.equal(plan.days[plan.cities.indexOf("san")], 4);
    assert.ok(
      input.interests.every((interest) =>
        plan.cities.some((id) => cities[id].interest === interest),
      ),
    );
  }
});

test("required cities retain their order without duplicate suggestions", () => {
  const input = {
    ...defaultInput(),
    days: 22,
    cityOrder: "fixed" as const,
    required: ["bei", "gui", "zjj"] as RoutePlan["cities"],
  };
  const result = generateRoutes(input);
  assert.equal(result.plans.length, 3);
  for (const plan of result.plans)
    assert.deepEqual(plan.cities, ["sha", "bei", "gui", "zjj", "san"]);
});

test("generated trips across endpoints and modes respect constraints", () => {
  let checked = 0;
  for (const start of cityIds)
    for (const end of cityIds.filter((c) => c !== start))
      for (const transport of ["mixed", "air", "train"] as const)
        for (const days of [7, 14, 28]) {
          const input = {
            ...defaultInput(),
            start,
            end,
            seaEnd: end === "san",
            transport,
            days,
          };
          for (const plan of generateRoutes(input).plans) {
            checked++;
            assert.ok(isPlan(plan, input), JSON.stringify({ input, plan }));
            const rows = schedule(plan, input);
            assert.equal(rows.at(-1)!.last, days - 1);
            const transitNights = plan.tickets.reduce(
              (sum, id) => sum + transferDays(ticketById(id)) - 1,
              0,
            );
            assert.equal(totals(plan, input).nights + transitNights, days - 1);
            assert.ok(rows.every((row) => row.nights >= 1));
            assert.equal(rows[0].checkIn, 0);
            if (transport !== "mixed")
              assert.ok(
                plan.tickets.every((id) => ticketById(id).mode === transport),
              );
          }
        }
  assert.ok(checked > 200);
});

test("infeasible or malformed input produces errors", () => {
  const base = defaultInput();
  for (const input of [
    {
      ...base,
      days: 7,
      required: ["bei", "gui", "zjj"] as RoutePlan["cities"],
    },
    { ...base, days: NaN },
    { ...base, days: 10.5 },
    { ...base, startDate: "2026-02-30" },
    { ...base, startDate: "" },
    { ...base, budget: 0 },
    { ...base, end: base.start },
    { ...base, seaDays: 20 },
    { ...base, interests: [] },
  ]) {
    const result = generateRoutes(input);
    assert.equal(result.plans.length, 0);
    assert.ok(result.errors.length > 0);
  }
});

test("day editing preserves trip length and minimum time at sea", () => {
  const input = defaultInput();
  let plan = editablePlan(input);
  const original = [...plan.days];
  plan = moveDay(plan, input, 0, 1)!;
  assert.equal(plan.days[0], original[0] + 1);
  assert.ok(isPlan(plan, input));
  assert.equal(moveDay(plan, input, plan.cities.indexOf("san"), -1), null);
  for (let i = 0; i < 20; i++) plan = moveDay(plan, input, 0, 1) ?? plan;
  assert.ok(
    plan.days.every((count, i) => count >= minimumDays(plan.cities[i], input)),
  );
  assert.ok(isPlan(plan, input));
});

test("overnight ticket reallocates sightseeing and hotel nights", () => {
  const input = defaultInput(),
    plan = editablePlan(input);
  const nightTrain = ticketsBetween("zjj", "san").find(
    (t) => t.mode === "train",
  )!;
  const updated = changeTicket(plan, input, 1, nightTrain.id)!;
  assert.ok(updated);
  assert.ok(isPlan(updated, input));
  assert.equal(totals(updated, input).nights, 12);
  assert.equal(schedule(updated, input).at(-1)!.last, 13);
  assert.equal(
    changeTicket(plan, { ...input, transport: "air" }, 1, nightTrain.id),
    null,
  );
  assert.equal(changeTicket(plan, input, 0, nightTrain.id), null);
});

test("longer ticket rejected when stops are at minimum length", () => {
  const input = { ...defaultInput(), days: 10 },
    plan = editablePlan(input);
  assert.ok(plan);
  const nightTrain = ticketsBetween("zjj", "san").find(
    (t) => t.mode === "train",
  )!;
  assert.equal(changeTicket(plan, input, 1, nightTrain.id), null);
});

test("hotel change affects only lodging cost", () => {
  const input = defaultInput(),
    plan = editablePlan(input);
  const old = hotelById(plan.hotels[0]),
    replacement = hotelsIn("sha")[2];
  const changed = {
    ...plan,
    hotels: [replacement.id, ...plan.hotels.slice(1)],
  };
  const before = totals(plan, input),
    after = totals(changed, input);
  assert.equal(after.transit, before.transit);
  assert.equal(
    after.total - before.total,
    (replacement.nightly - old.nightly) * schedule(plan, input)[0].nights,
  );
});

test("only optional cities can be replaced; adjacent tickets stay valid", () => {
  const input = defaultInput(),
    plan = editablePlan(input);
  const changed = replaceCity(plan, input, 1, "gui")!;
  assert.ok(isPlan(changed, input));
  assert.equal(changed.cities[1], "gui");
  assert.equal(replaceCity(plan, input, 0, "bei"), null);
  assert.equal(
    replaceCity(plan, { ...input, required: ["zjj"] }, 1, "gui"),
    null,
  );
  assert.equal(replaceCity(plan, input, 1, "san"), null);
});

test("restoration rejects corrupted data, unknown offers, impossible allocation", () => {
  const input = defaultInput(),
    plan = editablePlan(input);
  const snapshot = { version: 1, input, plan, screen: "plan" };
  assert.deepEqual(parseDraft(JSON.stringify(snapshot)), snapshot);
  assert.equal(parseDraft("{broken"), null);
  assert.equal(
    parseDraft(
      JSON.stringify({
        ...snapshot,
        input: { ...input, required: "not-an-array" },
      }),
    ),
    null,
  );
  for (const invalid of [
    { ...plan, days: [99, 99, 99] },
    { ...plan, tickets: ["unknown"] },
    { ...plan, hotels: ["unknown"] },
  ]) {
    const restored = parseDraft(JSON.stringify({ ...snapshot, plan: invalid }));
    assert.equal(restored!.plan, null);
    assert.equal(restored!.screen, "create");
  }
  assert.equal(
    parseSaved(
      JSON.stringify([
        { id: "1", savedAt: "2026-10-25T12:00:00Z", input, plan },
        { id: "bad" },
      ]),
    ).length,
    1,
  );
});

test("city replacement preserves manually selected tickets on unaffected legs", () => {
  const input = {
    ...defaultInput(),
    days: 18,
    required: ["bei"] as RoutePlan["cities"],
  };
  const plan = editablePlan(input);
  const edited = changeTicket(plan, input, 0, "sha-bei-train-1")!;
  const changed = replaceCity(edited, input, 2, "gui")!;
  assert.ok(isPlan(changed, input));
  assert.equal(changed.tickets[0], "sha-bei-train-1");
  assert.equal(changed.hotels[0], edited.hotels[0]);
  assert.equal(changed.hotels[1], edited.hotels[1]);
});

test("date arithmetic handles month and year boundaries", () => {
  assert.equal(addDays("2026-12-29", 5), "2027-01-03");
  assert.equal(addDays("2028-02-28", 1), "2028-02-29");
  assert.equal(
    allocateDays(["sha", "san"], ["sha-san-train-0"], {
      ...defaultInput(),
      days: 7,
    }),
    null,
  );
});
