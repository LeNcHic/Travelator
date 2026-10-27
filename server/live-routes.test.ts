import test from "node:test";
import assert from "node:assert/strict";
import { createLiveRouteSearch, validateLiveInput } from "./live-routes.ts";
import { defaultInput, schedule, totals } from "../src/lib/planner.ts";
import { isPlan, parseDraft } from "../src/lib/storage.ts";
import { addDays } from "../src/lib/format.ts";
import type { FlyaiQuery, FlyaiResult, FlyaiTrainQuote } from "../shared/flyai.ts";
import type { TripInput } from "../src/types.ts";

const now = new Date("2026-10-25T12:00:00Z");
const input: TripInput = { ...defaultInput(), start: "sha", end: "bei", startDate: "2026-11-02", days: 7,
  budget: 12000, interests: ["city"], required: [], transport: "mixed", seaEnd: false, seaDays: 2 };
type Settings = { nightly?: number; empty?: "hotel" | "train"; trial?: boolean; overnight?: boolean;
  fare?: (q: Extract<FlyaiQuery, { kind: "train" }>) => number };
function fixture(settings: Settings = {}) {
  const calls: FlyaiQuery[] = [];
  const search = async (q: FlyaiQuery): Promise<FlyaiResult> => {
    calls.push(q);
    const result: FlyaiResult = { source: "flyai", query: q, searchedAt: now.toISOString(), access: settings.trial ? "trial" : "personal_key", limited: false, offers: [] };
    if (settings.empty === q.kind) return result;
    if (q.kind === "hotel") {
      result.offers = [100, 200].map((price, i) => ({ id: String(100 + i), name: "Live hotel", description: "Address", url: null, priceLabel: `¥${price}`,
        hotelQuote: { source: "flyai", hotelId: String(100 + i), city: q.city, name: "Live hotel", address: "Address",
          checkIn: q.checkIn, checkOut: q.checkOut, currency: "CNY", nightly: settings.nightly ?? price,
          priceBasis: "nightly_search_estimate", searchedAt: now.toISOString() } }));
    } else {
      const choices = settings.overnight ? [["D1", 100, 480, "22:00:00", "06:00:00"]] as const
        : [["D1", 100, 480, "08:00:00", "16:00:00"], ["D2", 200, 300, "09:00:00", "14:00:00"], ["G3", 400, 120, "10:00:00", "12:00:00"], ["G4", 500, 600, "08:00:00", "18:00:00"]] as const;
      result.offers = choices.map(([trainNumber, amount, minutes, dep, arr]) => {
        const quote: FlyaiTrainQuote = { source: "flyai", from: q.from, to: q.to, trainNumber, fromStation: "Origin", toStation: "Destination",
          seatClass: "二等座", departure: `${q.date} ${dep}`, arrival: `${settings.overnight ? addDays(q.date, 1) : q.date} ${arr}`, minutes,
          amount: settings.fare?.(q) ?? amount, currency: "CNY", priceBasis: "passenger_search_estimate", searchedAt: now.toISOString() };
        return { id: trainNumber, name: trainNumber, description: "Train", priceLabel: String(quote.amount), url: null, trainQuote: quote };
      });
    }
    return result;
  };
  return { search, calls };
}

test("strategies rank live combinations rather than the three demo winners", async () => {
  const f = fixture();
  const result = await createLiveRouteSearch(f.search, () => now)(input);
  assert.deepEqual(result.errors, []);
  assert.equal(result.plans.length, 3);
  const cheap = result.plans.find(p => p.id === "value")!, fast = result.plans.find(p => p.id === "fast")!, balance = result.plans.find(p => p.id === "balance")!;
  assert.equal(cheap.trainQuotes?.sha?.trainNumber, "D1");
  assert.equal(fast.trainQuotes?.sha?.trainNumber, "G3");
  assert.equal(balance.trainQuotes?.sha?.trainNumber, "D2");
  assert.equal(totals(cheap, input).total, 700);
  assert.equal(totals(fast, input).total, 1000);
  assert.equal(totals(balance, input).total, 800);
  for (const plan of result.plans) {
    assert.equal(isPlan(plan, input), true);
    assert.equal(totals(plan, input).demoTickets, 0);
    assert.equal(totals(plan, input).demoHotels, 0);
    assert.equal(schedule(plan, input).at(-1)!.last, input.days - 1);
    assert.deepEqual(parseDraft(JSON.stringify({ version: 1, input, plan, screen: "plan" }))?.plan, plan);
  }
  assert.equal(new Set(f.calls.map(q => JSON.stringify(q))).size, f.calls.length, "identical queries are reused across templates and strategies");
  assert.equal(result.partial, false);
});

test("city order is selected using live fares and fixed mandatory order is respected", async () => {
  const i: TripInput = { ...input, startDate: "2026-10-26", end: "san", days: 14, required: ["bei", "gui"], interests: ["city", "nature", "sea"], seaEnd: true, seaDays: 4 };
  const f = fixture({ fare: q => ["sha-gui", "gui-bei", "bei-san"].includes(`${q.from}-${q.to}`) ? 100 : 900 });
  const result = await createLiveRouteSearch(f.search, () => now, { requests: 200, candidates: 10000, milliseconds: 180000 })(i);
  assert.deepEqual(result.plans.find(p => p.id === "value")?.cities, ["sha", "gui", "bei", "san"]);
  const fixed = await createLiveRouteSearch(f.search, () => now, { requests: 200, candidates: 10000, milliseconds: 180000 })({ ...i, cityOrder: "fixed" });
  assert.deepEqual(fixed.plans[0]?.cities, ["sha", "bei", "gui", "san"]);
});

test("overnight templates search their actual dates and hotel nights exclude nights on the train", async () => {
  const f = fixture({ overnight: true });
  const result = await createLiveRouteSearch(f.search, () => now)(input);
  assert.equal(result.plans.length, 3);
  const plan = result.plans[0], rows = schedule(plan, input), t = totals(plan, input);
  assert.equal(rows[0].transferLength, 2);
  assert.equal(t.nights, 5);
  assert.equal(t.lodging, 500);
  assert.equal(t.total, 600);
  assert.equal(plan.hotelQuotes?.bei?.checkIn, rows[0].trainQuote?.arrival.slice(0, 10));
  assert.ok(f.calls.some(q => q.kind === "train" && q.date === rows[0].trainQuote?.departure.slice(0, 10)));
  assert.equal(isPlan(plan, input), true);
});

test("missing hotels or trains never produce a partly fictional route", async () => {
  for (const empty of ["hotel", "train"] as const) {
    const f = fixture({ empty });
    const result = await createLiveRouteSearch(f.search, () => now)(input);
    assert.deepEqual(result.plans, []);
    assert.ok(result.errors[0].includes("Полный маршрут"));
  }
});

test("masked and mismatching offers are excluded; no full estimates means no result", async () => {
  const f = fixture();
  const search = async (q: FlyaiQuery) => {
    const result = await f.search(q);
    result.limited = true;
    result.offers.forEach(offer => {
      delete offer.trainQuote; delete offer.hotelQuote; offer.priceLabel = "5xx";
    });
    return result;
  };
  const result = await createLiveRouteSearch(search, () => now)(input);
  assert.equal(result.plans.length, 0);
  assert.equal(result.partial, true);
  assert.ok(result.warnings.some(w => w.includes("скрыта")));
});

test("budget constraints apply to live totals and report the minimum found estimate", async () => {
  const f = fixture({ nightly: 300 });
  const result = await createLiveRouteSearch(f.search, () => now)({ ...input, budget: 1000 });
  assert.equal(result.plans.length, 0);
  assert.ok(result.errors[0].includes("1 900") || result.errors[0].includes("1 900"));
});

test("request budget returns complete partial winners, not mixed-price candidates", async () => {
  const f = fixture();
  const result = await createLiveRouteSearch(f.search, () => now, { requests: 3, candidates: 10000, milliseconds: 180000 })(input);
  assert.equal(result.stats.requests, 3);
  assert.equal(f.calls.length, 3);
  assert.equal(result.partial, true);
  assert.equal(result.plans.length, 3);
  assert.ok(result.warnings.some(w => w.includes("предел")));
});

test("validation blocks unsupported transport, past dates and unavailable departure windows before requests", async () => {
  const f = fixture(), run = createLiveRouteSearch(f.search, () => now);
  for (const patch of [{ startDate: "2026-12-01" }, { startDate: "2026-10-24" }, { transport: "air" }, { required: ["unknown"] }, { days: 1 }]) {
    await assert.rejects(run({ ...input, ...patch }), { status: 400 });
  }
  assert.equal(f.calls.length, 0);
  assert.equal(validateLiveInput({ ...input, apiKey: "ignored", limit: 999 }, now).start, "sha");
  assert.equal("apiKey" in validateLiveInput({ ...input, apiKey: "ignored" }, now), false);
});

test("trial access stops immediately, and provider failures are surfaced without fallback", async () => {
  const f = fixture({ trial: true });
  await assert.rejects(createLiveRouteSearch(f.search, () => now)(input), { code: "PERSONAL_KEY_REQUIRED" });
  assert.equal(f.calls.length, 1);
  const result = await createLiveRouteSearch(async () => { throw new Error("private diagnostics"); }, () => now)(input);
  assert.equal(result.plans.length, 0);
  assert.equal(result.partial, true);
  assert.ok(result.warnings.some(w => w.includes("Не удалось")));
  assert.ok(!JSON.stringify(result).includes("private diagnostics"));
});

test("cancellation stops further provider calls and releases the running search", async () => {
  const f = fixture(), controller = new AbortController();
  let abort = true;
  const run = createLiveRouteSearch(async q => {
    const data = await f.search(q); if (abort) controller.abort(); return data;
  }, () => now);
  await assert.rejects(run(input, { signal: controller.signal }), { name: "AbortError" });
  assert.equal(f.calls.length, 1);
  abort = false;
  assert.equal((await run(input)).plans.length, 3);
});

test("parallel full searches are bounded and progress contains no credentials", async () => {
  const f = fixture();
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const run = createLiveRouteSearch(async q => { await gate; return f.search(q); }, () => now);
  const progress: string[] = [];
  const pending = run(input, { onProgress: p => progress.push(p.message) });
  await assert.rejects(run(input), { status: 409 });
  release();
  await pending;
  assert.ok(progress.some(p => p.includes("поезда")));
  assert.ok(progress.some(p => p.includes("гостиницы")));
});
