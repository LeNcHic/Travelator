import test from "node:test";
import assert from "node:assert/strict";
import { tripKey } from "../../shared/trip-key";
import { defaultInput } from "./planner";
import { toJourneyInput } from "./journey";
import type { TripInput } from "../types";

const input: TripInput = { ...toJourneyInput(defaultInput()), startDate: "2026-11-02", maxTrainMinutes: 120 };

test("trip identity ignores object property order and unknown fields without mutating inputs", () => {
  const reordered: TripInput = {
    ...Object.fromEntries(Object.entries(input).reverse()) as unknown as TripInput,
    journey: {
      ...Object.fromEntries(Object.entries(input.journey!).reverse()) as unknown as NonNullable<TripInput["journey"]>,
      daysByInterest: { sea: 3, nature: 4, city: 3 },
    },
  };
  const before = JSON.stringify(reordered);
  assert.equal(tripKey(input), tripKey(reordered));
  assert.equal(tripKey({ ...reordered, ignored: { arbitrary: true } } as TripInput), tripKey(input));
  assert.equal(JSON.stringify(reordered), before);
  assert.equal(tripKey({ ...input, maxTrainMinutes: undefined }), tripKey(Object.fromEntries(
    Object.entries(input).filter(([key]) => key !== "maxTrainMinutes"),
  ) as unknown as TripInput));
});

test("unordered preferences have stable identity while a fixed city order remains meaningful", () => {
  const unordered: TripInput = { ...input, interests: ["city", "nature", "sea"], required: ["sha", "san"],
    journey: { ...input.journey!, requiredPlaces: ["sha-bund", "san-yalong"] } };
  const reversed: TripInput = { ...unordered, interests: ["sea", "nature", "city"], required: ["san", "sha"],
    journey: { ...unordered.journey!, requiredPlaces: ["san-yalong", "sha-bund"] } };
  assert.equal(tripKey(unordered), tripKey(reversed));
  assert.notEqual(tripKey({ ...unordered, cityOrder: "fixed" }), tripKey({ ...reversed, cityOrder: "fixed" }));
  assert.deepEqual(unordered.required, ["sha", "san"]);
});

test("every supported trip and journey parameter contributes to identity", () => {
  const patches: Partial<TripInput>[] = [
    { start: "bei" }, { end: "sha" }, { startDate: "2026-11-03" }, { days: 15 }, { budget: 12001 },
    { interests: ["city", "nature"] }, { required: ["sha"] }, { seaEnd: true }, { seaDays: 4 },
    { transport: "train" }, { pace: "active" }, { priority: "fast" }, { cityOrder: "fixed" },
    { maxTrainMinutes: undefined }, { journey: undefined },
    { journey: { ...input.journey!, minStops: 2 } },
    { journey: { ...input.journey!, maxStops: 5 } },
    { journey: { ...input.journey!, requiredPlaces: ["sha-bund"] } },
    ...(["city", "nature", "sea"] as const).map(kind => ({ journey: { ...input.journey!,
      daysByInterest: { ...input.journey!.daysByInterest, [kind]: input.journey!.daysByInterest[kind] + 1 } } })),
  ];
  for (const patch of patches) assert.notEqual(tripKey({ ...input, ...patch }), tripKey(input), JSON.stringify(patch));
});
