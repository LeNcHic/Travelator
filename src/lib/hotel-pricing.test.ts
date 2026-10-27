import test from "node:test";
import assert from "node:assert/strict";
import { parseFlyaiPrice, validHotelQuote, type FlyaiHotelQuote } from "../../shared/flyai";
import { defaultInput, generateRoutes, hotelStays, totals, selectFlyaiHotel, selectDemoHotel, moveDay, changeTicket, replaceCity } from "./planner";
import { isPlan, parseDraft, parseSaved } from "./storage";
import { ticketsBetween } from "../data/catalog";
import { addDays, money } from "./format";
import type { RoutePlan, TripInput } from "../types";

const input: TripInput = { ...defaultInput(), startDate: "2026-11-02" };
const plan = generateRoutes(input).plans[0];
function quoteFor(p: RoutePlan, i: number, nightly = 428.25): FlyaiHotelQuote {
  const stay = hotelStays(p, input)[i];
  return { source: "flyai", hotelId: String(81305346 + i), city: stay.city,
    name: "Проверочная гостиница", address: "Тестовый адрес", checkIn: stay.checkIn, checkOut: stay.checkOut,
    currency: "CNY", nightly, priceBasis: "nightly_search_estimate", searchedAt: "2026-10-25T12:00:00Z" };
}

test("only complete positive CNY prices are accepted", () => {
  for (const label of ["¥2x", "5xx", "", "0", "¥0.00", "-1", "1e3", "$428", "¥428起", "NaN", "Infinity", "1,000", "1.123", "1000001"]) {
    assert.equal(parseFlyaiPrice(label), null, label);
  }
  assert.equal(parseFlyaiPrice("¥ 428.25"), 428.25);
  assert.equal(parseFlyaiPrice("598.00"), 598);
  assert.equal(money(428.25), "¥ 428,25");
});

test("real hotel replaces rather than adds to demo lodging; cents and nights survive", () => {
  const before = totals(plan, input);
  const original = hotelStays(plan, input)[0];
  const quote = quoteFor(plan, 0);
  const next = selectFlyaiHotel(plan, input, 0, quote)!;
  const after = totals(next, input);
  assert.equal(after.lodging, before.lodging - original.total + quote.nightly * original.nights);
  assert.equal(after.transit, before.transit);
  assert.equal(after.total, after.lodging + after.transit);
  assert.equal(after.liveHotels, 1);
  assert.equal(after.demoHotels, plan.cities.length - 1);
  assert.equal(plan.hotelQuotes, undefined);
  assert.equal(isPlan(next, input), true);
  const back = selectDemoHotel(next, 0, plan.hotels[0]);
  assert.deepEqual(totals(back, input), before);
});

test("quotes are date and city bound; rescheduling exposes fallback rather than reusing wrong prices", () => {
  const quote = quoteFor(plan, 0);
  assert.equal(selectFlyaiHotel(plan, input, 1, quote), null);
  assert.equal(selectFlyaiHotel(plan, input, 0, { ...quote, checkOut: addDays(quote.checkOut, 1) }), null);
  const next = selectFlyaiHotel(plan, input, 0, quote)!;
  const shifted = { ...input, startDate: addDays(input.startDate, 1) };
  assert.equal(totals(next, shifted).liveHotels, 0);
  assert.equal(totals(next, shifted).outdatedHotels, 1);
  assert.equal(totals(next, shifted).total, totals(plan, shifted).total);
  const moved = moveDay(next, input, 0, 1)!;
  assert.ok(moved);
  assert.equal(hotelStays(moved, input)[0].outdated, true);
  assert.equal(hotelStays(moved, input)[0].quote, undefined);
});

test("overnight ticket changes cannot reuse prices for shifted stays", () => {
  let quoted = plan;
  for (let i = 0; i < plan.cities.length; i++) quoted = selectFlyaiHotel(quoted, input, i, quoteFor(plan, i))!;
  let checked = 0;
  for (let leg = 0; leg < plan.tickets.length; leg++) {
   for (const ticket of ticketsBetween(plan.cities[leg], plan.cities[leg + 1])) {
    const next = changeTicket(quoted, input, leg, ticket.id);
    if (!next) continue;
    const original = hotelStays(quoted, input);
    const stays = hotelStays(next, input);
    for (const [i, stay] of stays.entries()) {
      if (stay.checkIn !== original[i].checkIn || stay.checkOut !== original[i].checkOut) {
        assert.equal(stay.quote, undefined);
        assert.equal(stay.outdated, true);
        checked++;
      }
    }
  }
  }
  assert.ok(checked > 0, "test includes a transfer that changes accommodation dates");
});

test("saved and draft trips retain price provenance; legacy trips still load", () => {
  const next = selectFlyaiHotel(plan, input, 0, quoteFor(plan, 0))!;
  const draft = parseDraft(JSON.stringify({ version: 1, screen: "plan", input, plan: next }));
  assert.deepEqual(draft?.plan, next);
  const saved = parseSaved(JSON.stringify([{ id: "trip", savedAt: "2026-10-25T12:00:00Z", input, plan: next }]));
  assert.deepEqual(saved[0].plan, next);
  assert.equal(totals(saved[0].plan, input).total, totals(next, input).total);
  assert.ok(parseDraft(JSON.stringify({ version: 1, screen: "plan", input, plan }))?.plan);
});

test("invalid persisted prices and unexpected currency cannot enter totals", () => {
  for (const change of [{ nightly: -1 }, { nightly: "428" }, { currency: "USD" }, { priceBasis: "total" },
    { checkIn: "2026-02-30" }, { checkOut: { toString: 0 } }, { searchedAt: "bad" }, { hotelId: "" }]) {
    const bad = { ...quoteFor(plan, 0), ...change };
    assert.equal(validHotelQuote(bad), false);
    const p = { ...plan, hotelQuotes: { [plan.cities[0]]: bad } } as RoutePlan;
    assert.equal(isPlan(p, input), false);
    assert.equal(totals(p, input).total, totals(plan, input).total);
  }
});

test("city replacement retains quotes for surviving cities and removes the replaced city", () => {
  const plan: RoutePlan = { id: "balance", cities: ["sha", "gui", "san"], days: [4,4,4], tickets: ["sha-gui-air-0", "gui-san-air-0"], hotels: ["sha-hotel-0", "gui-hotel-0", "san-hotel-0"] };
  const nature = plan.cities.findIndex(city => city === "gui" || city === "zjj");
  assert.ok(nature > 0);
  let quoted = plan;
  for (let i = 0; i < plan.cities.length; i++) quoted = selectFlyaiHotel(quoted, input, i, quoteFor(plan, i))!;
  const next = replaceCity(quoted, input, nature, plan.cities[nature] === "gui" ? "zjj" : "gui")!;
  assert.ok(next);
  assert.equal(next.hotelQuotes?.[plan.cities[nature]], undefined);
  assert.deepEqual(next.hotelQuotes?.sha, quoted.hotelQuotes?.sha);
});
