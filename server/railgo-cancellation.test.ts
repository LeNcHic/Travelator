import test from "node:test";
import assert from "node:assert/strict";
import { createRailgoRouteSearch } from "./railgo-routes.ts";
import { defaultInput } from "../src/lib/planner.ts";
import type { FlyaiQuery, FlyaiResult } from "../shared/flyai.ts";
import type { TripInput } from "../src/types.ts";

const now = new Date("2026-10-25T12:00:00Z");
const input: TripInput = { ...defaultInput(), startDate: "2026-11-02", start: "sha", end: "bei",
  interests: ["city"], seaEnd: false, days: 7 };

function hotelResult(query: FlyaiQuery): FlyaiResult {
  assert.equal(query.kind, "hotel");
  if (query.kind !== "hotel") throw new Error("Only hotels expected");
  return { source: "flyai", query, access: "personal_key", limited: false, searchedAt: now.toISOString(),
    offers: [{ id: "123", name: "Mock hotel", description: "Address", priceLabel: "100", url: null,
      hotelQuote: { source: "flyai", hotelId: "123", city: query.city, name: "Mock hotel", address: "Address",
        checkIn: query.checkIn, checkOut: query.checkOut, nightly: 100, currency: "CNY",
        priceBasis: "nightly_search_estimate", distanceKm: 2, searchedAt: now.toISOString() } }] };
}

function deferred() {
  let release!: () => void;
  const promise = new Promise<void>(resolve => { release = resolve; });
  return { promise, release };
}

test("cancellation permits retry before the old provider finishes, and old cleanup cannot release the new lease", async () => {
  const firstGate = deferred(), secondGate = deferred(), controller = new AbortController();
  let calls = 0;
  const run = createRailgoRouteSearch(async query => {
    calls++;
    if (calls === 1) await firstGate.promise;
    else if (calls === 2) await secondGate.promise;
    return hotelResult(query);
  }, async query => ({ source: "railgo", query, searchedAt: now.toISOString(), maxMinutes: 120, trains: [] }), () => now);
  const first = run(input, { signal: controller.signal });
  assert.equal(calls, 1);
  controller.abort();
  const second = run(input);
  assert.equal(calls, 2, "retry reaches its provider while the cancelled provider remains pending");
  await assert.rejects(run(input), { code: "ROUTE_SEARCH_BUSY" });
  firstGate.release();
  await assert.rejects(first, { name: "AbortError" });
  await assert.rejects(run(input), { code: "ROUTE_SEARCH_BUSY" }, "old finally must preserve the retry's lease");
  secondGate.release();
  assert.equal((await second).plans.length, 3);
  assert.equal((await run(input)).plans.length, 3, "completion releases its own lease normally");
});

test("an already cancelled search neither calls providers nor acquires a lease", async () => {
  const controller = new AbortController();
  controller.abort();
  let calls = 0;
  const run = createRailgoRouteSearch(async query => { calls++; return hotelResult(query); },
    async query => ({ source: "railgo", query, searchedAt: now.toISOString(), maxMinutes: 120, trains: [] }), () => now);
  await assert.rejects(run(input, { signal: controller.signal }), { name: "AbortError" });
  assert.equal(calls, 0);
  assert.equal((await run(input)).plans.length, 3);
});
