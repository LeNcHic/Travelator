import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createHotelApi } from "./api";
import { createHotelProviders, validateSearch } from "./hotels";
import { hotelSearchRequest } from "../src/lib/hotel-search";
import { defaultInput, generateRoutes, schedule, changeTicket, moveDay } from "../src/lib/planner";
import { hotelsIn, ticketsBetween } from "../src/data/catalog";
import { addDays } from "../src/lib/format";

const query = { provider: "demo", city: "sha", checkIn: "2026-12-01", checkOut: "2026-12-04", adults: 1, rooms: 1, currency: "CNY" };
const secrets = { OSTROVOK_KEY_ID: "test-private-id", OSTROVOK_API_KEY: "test-private-token" };

async function api(path: string, method: string, body?: string, headers: Record<string, string> = {}) {
  const req = Readable.from(body === undefined ? [] : [Buffer.from(body)]) as IncomingMessage;
  req.url = path; req.method = method;
  req.headers = { host: "127.0.0.1:5173", "content-type": "application/json", ...headers };
  const result = { status: 200, headers: {} as Record<string, string>, text: "", next: false };
  const res = {
    setHeader(key: string, value: string) { result.headers[key.toLowerCase()] = value; },
    set statusCode(value: number) { result.status = value; },
    end(value: string) { result.text = value; },
  } as unknown as ServerResponse;
  await createHotelApi(secrets)(req, res, () => { result.next = true; });
  return { ...result, body: result.text ? JSON.parse(result.text) : null };
}

test("hotel API rejects invalid dates, arbitrary cities and unsupported occupancy", () => {
  for (const patch of [
    { city: "unknown" }, { city: "__proto__" }, { provider: "https://example.com" },
    { checkIn: "2026-02-30" }, { checkIn: "2026-2-3" }, { checkIn: "2026-12-04" },
    { checkOut: "2026-11-30" }, { checkOut: "2027-03-01" }, { adults: 2 },
    { rooms: 0 }, { currency: "RUB" },
  ]) assert.throws(() => validateSearch({ ...query, ...patch }), { status: 400 });
  assert.deepEqual(validateSearch({ ...query, secret: "ignored", url: "https://example.com" }), query);
  assert.doesNotThrow(() => validateSearch({ ...query, checkIn: "2028-02-29", checkOut: "2028-03-01" }));
});

test("demo API returns complete stay prices and identifies its fictional source", async () => {
  const response = await api("/api/hotels/search", "POST", JSON.stringify(query));
  assert.equal(response.status, 200);
  assert.equal(response.headers["cache-control"], "no-store");
  assert.equal(response.body.isDemo, true);
  assert.equal(response.body.provider, "demo");
  assert.equal(response.body.offers.length, 3);
  for (const [index, offer] of response.body.offers.entries()) {
    assert.equal(offer.total, hotelsIn("sha")[index].nightly * 3);
    assert.equal(offer.nights, 3);
    assert.equal(offer.checkIn, query.checkIn);
    assert.equal(offer.checkOut, query.checkOut);
    assert.equal(offer.currency, "CNY");
  }
});

test("Ostrovok never silently falls back to demo, even with keys", async () => {
  assert.equal(createHotelProviders({}).ostrovok.status().state, "awaiting_access");
  assert.equal(createHotelProviders(secrets).ostrovok.status().state, "awaiting_integration");
  const response = await api("/api/hotels/search", "POST", JSON.stringify({ ...query, provider: "ostrovok" }));
  assert.equal(response.status, 503);
  assert.equal(response.body.error.code, "PROVIDER_NOT_READY");
  assert.equal(response.body.offers, undefined);
  const status = await api("/api/hotels/providers", "GET");
  assert.equal(status.body.providers[1].available, false);
  for (const value of Object.values(secrets)) {
    assert.ok(!status.text.includes(value));
    assert.ok(!response.text.includes(value));
  }
});

test("HTTP boundary validates JSON, size, method and origin; static requests pass through", async () => {
  assert.equal((await api("/api/hotels/search", "POST", "{")).status, 400);
  assert.equal((await api("/api/hotels/search", "POST", "x", { "content-type": "text/plain" })).status, 415);
  assert.equal((await api("/api/hotels/search", "POST", JSON.stringify({ padding: "a".repeat(5000) }))).status, 413);
  assert.equal((await api("/api/hotels/search", "GET")).status, 405);
  assert.equal((await api("/api/hotels/search", "POST", JSON.stringify(query), { origin: "https://other.example" })).status, 403);
  assert.equal((await api("/api/hotels/search", "POST", JSON.stringify(query), { origin: "http://127.0.0.1:5173" })).status, 200);
  assert.equal((await api("/api/unknown", "GET")).status, 404);
  assert.equal((await api("/src/App.tsx", "GET")).next, true);
  assert.equal((await api("/api/flyai/routes", "GET")).status, 405);
  assert.equal((await api("/api/flyai/routes", "POST", "{}")).status, 400);
  assert.equal((await api("/api/flyai/routes", "POST", "{}", { origin: "https://other.example" })).status, 403);
  const liveInput = { ...defaultInput(), end: "bei", interests: ["city"], seaEnd: false, days: 7 };
  assert.equal((await api("/api/flyai/routes", "POST", JSON.stringify(liveInput))).status, 503);
});

test("search dates follow hotel nights after train changes and moving a day", () => {
  const input = { ...defaultInput(), startDate: "2026-12-25", days: 28, budget: 100000 };
  const initial = generateRoutes(input).plans[0];
  assert.ok(initial);
  const moved = moveDay(initial, input, 0, 1);
  assert.ok(moved);
  assert.notEqual(hotelSearchRequest(moved, input, 0, "demo").checkOut, hotelSearchRequest(initial, input, 0, "demo").checkOut);
  const plans = [initial, moved];
  for (let i = 0; i < initial.tickets.length; i++) {
    const train = ticketsBetween(initial.cities[i], initial.cities[i + 1]).find(ticket => ticket.mode === "train")!;
    const changed = changeTicket(initial, input, i, train.id);
    if (changed) plans.push(changed);
  }
  for (const plan of plans) {
    for (const [index, row] of schedule(plan, input).entries()) {
      const request = hotelSearchRequest(plan, input, index, "demo");
      assert.equal(request.checkIn, addDays(input.startDate, row.checkIn));
      assert.equal(request.checkOut, addDays(input.startDate, row.checkOut));
      assert.equal((Date.parse(request.checkOut) - Date.parse(request.checkIn)) / 86400000, row.nights);
      validateSearch(request);
    }
  }
});
