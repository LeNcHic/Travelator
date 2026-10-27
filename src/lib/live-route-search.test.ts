import test from "node:test";
import assert from "node:assert/strict";
import { searchLiveRoutes, validateLiveResult } from "./live-route-search";
import { createLiveRouteSearch } from "../../server/live-routes";
import { createRailgoRouteSearch, validateRailgoTrip } from "../../server/railgo-routes";
import { defaultInput } from "./planner";
import { toJourneyInput } from "./journey";
import type { FlyaiQuery, FlyaiResult } from "../../shared/flyai";
import type { LiveRouteResult } from "../../shared/live-routes";
import type { TripInput } from "../types";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import PlanScreen from "../components/PlanScreen";
import CompareScreen from "../components/CompareScreen";

const input = { ...defaultInput(), startDate: "2026-11-02", end: "bei" as const, interests: ["city"] as const as ["city"], seaEnd: false, days: 7 };
const now = new Date("2026-10-25T12:00:00Z");
const provider = async (q: FlyaiQuery): Promise<FlyaiResult> => ({ source: "flyai", query: q, searchedAt: now.toISOString(), access: "personal_key", limited: false,
  offers: q.kind === "hotel" ? [{ id: "123", name: "Shanghai hotel", description: "Address", priceLabel: "¥100", url: null,
    hotelQuote: { source: "flyai", hotelId: "123", city: q.city, name: "Shanghai hotel", address: "Address", checkIn: q.checkIn, checkOut: q.checkOut,
      nightly: 100, currency: "CNY", priceBasis: "nightly_search_estimate", distanceKm: 2, searchedAt: now.toISOString() } }]
    : [{ id: "G1", name: "G1", description: "Train", priceLabel: "598", url: null,
      trainQuote: { source: "flyai", from: q.from, to: q.to, trainNumber: "G1", fromStation: "上海虹桥", toStation: "北京南", seatClass: "二等座",
        departure: `${q.date} 08:00:00`, arrival: `${q.date} 12:00:00`, minutes: 240, amount: 598, currency: "CNY",
        priceBasis: "passenger_search_estimate", searchedAt: now.toISOString() } }] });

function stream(lines: unknown[]) {
  const bytes = new TextEncoder().encode(lines.map(line => JSON.stringify(line)).join("\n") + "\n");
  return new Response(new ReadableStream({ start(controller) {
    // Cut both lines and multibyte Chinese text across arbitrary network chunks.
    for (let offset = 0; offset < bytes.length; offset += 11) controller.enqueue(bytes.slice(offset, offset + 11));
    controller.close();
  } }), { headers: { "Content-Type": "application/x-ndjson" } });
}

test("streamed progress and full Unicode route snapshots reach the client", async () => {
  const result = await createLiveRouteSearch(provider, () => now)(input);
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async () => stream([{ type: "progress", progress: { requests: 1, maxRequests: 32, message: "Ищем поезда 上海" } }, { type: "result", result }]);
  try {
    const progress: string[] = [];
    const restored = await searchLiveRoutes(input, new AbortController().signal, p => progress.push(p.message));
    assert.deepEqual(restored, result);
    assert.deepEqual(progress, ["Ищем поезда 上海"]);
    assert.equal(validateLiveResult({ ...result, input: Object.fromEntries(Object.entries(input).reverse()) as typeof input }, input), true);
    const noop = () => {};
    const planHtml = renderToStaticMarkup(createElement(PlanScreen, { input, plan: restored.plans[0], saved: false,
      onBack: noop, onSave: noop, onChange: noop, onHotel: noop, onTicket: noop, notice: "" }));
    assert.ok(planHtml.includes("上海虹桥"));
    assert.ok(planHtml.includes("G1"));
    assert.ok(planHtml.includes("Проверено частично"));
    assert.ok(planHtml.includes("поисковой ценой на одного пассажира"));
    const comparison = renderToStaticMarkup(createElement(CompareScreen, { input, plans: restored.plans, errors: [],
      routeSource: "flyai", onRouteSource: noop, liveStatus: "done", liveResult: restored, onSearch: noop, onCancel: noop,
      onEdit: noop, onSelect: noop }));
    assert.ok(comparison.includes("Обновить предложения"));
    assert.ok(comparison.includes("Расписания и гостиницы проверены"));
  } finally { globalThis.fetch = oldFetch; }
});

test("client rejects stale inputs, partly demo routes, bad metadata and incomplete streams", async () => {
  const result = await createLiveRouteSearch(provider, () => now)(input);
  assert.equal(validateLiveResult(result, { ...input, budget: input.budget + 1 }), false);
  const mixed = structuredClone(result);
  delete mixed.plans[0].trainQuotes;
  assert.equal(validateLiveResult(mixed, input), false);
  assert.equal(validateLiveResult({ ...result, stats: {} } as LiveRouteResult, input), false);
  const oldFetch = globalThis.fetch;
  try {
    for (const events of [[], [{ type: "error", message: "Поиск недоступен" }], [{ type: "result", result: mixed }]]) {
      globalThis.fetch = async () => stream(events);
      await assert.rejects(searchLiveRoutes(input, new AbortController().signal, () => {}));
    }
    globalThis.fetch = async () => new Response(JSON.stringify({ error: { message: "Выберите более близкую дату" } }), { status: 400 });
    await assert.rejects(searchLiveRoutes(input, new AbortController().signal, () => {}), /более близкую/);
  } finally { globalThis.fetch = oldFetch; }
});

test("a new journey survives server sanitization and real route search with mocked providers", async () => {
  const original: TripInput = { ...toJourneyInput(defaultInput()), startDate: input.startDate, maxTrainMinutes: 120 };
  const sanitized = validateRailgoTrip(original, now);
  assert.deepEqual(sanitized, original);
  assert.notEqual(JSON.stringify(sanitized.journey), JSON.stringify(original.journey), "exercise different nested property order");
  const result = await createRailgoRouteSearch(provider, async query => ({
    source: "railgo", query, searchedAt: now.toISOString(), maxMinutes: 120, trains: [],
  }), () => now)(sanitized);
  assert.equal(result.plans.length, 3);
  assert.equal(validateLiveResult(result, original), true);
  const reordered: TripInput = {
    ...Object.fromEntries(Object.entries(result.input).reverse()) as unknown as TripInput,
    journey: {
      ...Object.fromEntries(Object.entries(result.input.journey!).reverse()) as unknown as NonNullable<TripInput["journey"]>,
      daysByInterest: { sea: 3, nature: 4, city: 3 },
    },
  };
  assert.equal(validateLiveResult({ ...result, input: reordered }, original), true);
  assert.equal(validateLiveResult(result, { ...original, days: original.days + 1 }), false);
  assert.equal(validateLiveResult(result, { ...original, journey: { ...original.journey!,
    daysByInterest: { ...original.journey!.daysByInterest, city: 2 } } }), false);
  const oldFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => stream([{ type: "result", result }]);
    assert.deepEqual(await searchLiveRoutes(original, new AbortController().signal, () => {}), result);
  } finally { globalThis.fetch = oldFetch; }
});

test("untrusted or invalid input snapshots are rejected without throwing", async () => {
  const result = await createLiveRouteSearch(provider, () => now)(input);
  for (const value of [null, {}, [], { ...input, budget: NaN }, { ...input, interests: null },
    { ...input, journey: {} }, { ...input, journey: null }, { ...input, startDate: "not-a-date" }]) {
    assert.equal(validateLiveResult({ ...result, input: value } as LiveRouteResult, input), false);
    assert.equal(validateLiveResult(result, value as TripInput), false);
  }
  assert.equal(validateLiveResult({ ...result, input: { ...result.input, unexpected: "ignored" } } as LiveRouteResult, input), true);
});
