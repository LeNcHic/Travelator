import test from "node:test";
import assert from "node:assert/strict";
import { hotelsIn, ticketsBetween } from "../data/catalog";
import { defaultInput, generateRoutes, hotelStays, schedule, selectFlyaiHotel, selectFlyaiTrain, totals, validateInput } from "./planner";
import { chinaStartDate, toJourneyInput, updateJourney } from "./journey";
import { cityDayCapacity, cityDays, dayMinutes, reconcileCityPlans } from "./city-planner";
import { isPlan, parseDraft, parseSaved } from "./storage";
import { addDays } from "./format";
import type { RoutePlan, TripInput } from "../types";
import type { FlyaiQuery, FlyaiResult, RailgoTrainQuote } from "../../shared/flyai";
import { createRailgoRouteSearch } from "../../server/railgo-routes";

const initial = { ...toJourneyInput(defaultInput()), startDate: "2026-11-02", maxTrainMinutes: 120 as const };
const input: TripInput = updateJourney({ ...initial, days: 7, required: ["sha", "han"], seaEnd: false }, {
  ...initial.journey!, minStops: 2, maxStops: 2, daysByInterest: { city: 2, nature: 2, sea: 0 }, requiredPlaces: [],
});
const plan: RoutePlan = { id: "balance", calendarMode: "shared", cities: ["sha", "han"], days: [2, 3],
  tickets: [ticketsBetween("sha", "han").find(ticket => ticket.mode === "train" && ticket.minutes <= 120)!.id],
  hotels: [hotelsIn("sha")[0].id, hotelsIn("han")[0].id] };
const date = addDays(chinaStartDate(input), 2);
const quote: RailgoTrainQuote = { source: "railgo", from: "sha", to: "han", trainNumber: "G123", fromStation: "上海虹桥", toStation: "杭州东", seatClass: "二等座",
  departure: `${date} 15:00:00`, arrival: `${date} 16:05:00`, minutes: 65, amount: 73, currency: "CNY", priceBasis: "catalogue_estimate", searchedAt: "2026-10-26T12:00:00Z" };

test("seven experience days and three bases fit a ten-day holiday without two extra transfer days", () => {
  const trip = updateJourney({ ...initial, days: 10, required: ["sha", "han", "san"] }, {
    ...initial.journey!, minStops: 3, maxStops: 3, daysByInterest: { city: 2, nature: 3, sea: 2 },
  });
  assert.deepEqual(validateInput(trip), []);
  const result = generateRoutes(trip);
  assert.equal(result.plans.length, 3, result.errors.join());
  for (const route of result.plans) {
    assert.equal(route.calendarMode, "shared");
    assert.ok(isPlan(route, trip));
    assert.equal(totals(route, trip).tripDays, 10);
    assert.equal(route.days.reduce((sum, days) => sum + days, 0), 8);
    assert.equal(totals(route, trip).extraTransferDays, 0);
    assert.equal(totals(route, trip).nights, 8);
  }
});

test("same-day transfer is the destination's first day, with contiguous hotels and an unchanged return date", () => {
  const selected = selectFlyaiTrain(plan, input, 0, quote)!;
  assert.ok(selected && isPlan(selected, input));
  const rows = schedule(selected, input), stays = hotelStays(selected, input);
  assert.equal(rows[1].first, rows[0].transferStart);
  assert.equal(rows[1].date, date);
  assert.equal(stays[0].checkOut, stays[1].checkIn);
  assert.equal(stays[1].checkIn, date);
  assert.equal(stays[1].checkOut, addDays(input.startDate, input.days - 1));
  assert.equal(totals(selected, input).tripDays, input.days);
  assert.equal(totals(selected, input).nights, input.days - 2);
  assert.equal(cityDayCapacity(selected, input, 1, 0), 145);
});

test("late arrivals get no automatic visits; required sights prefer a later day and manual changes remain possible", () => {
  const late = selectFlyaiTrain(plan, input, 0, { ...quote, departure: `${date} 18:00:00`, arrival: `${date} 19:05:00` })!;
  const withRequired = updateJourney(input, { ...input.journey!, requiredPlaces: ["han-westlake"] });
  const arranged = reconcileCityPlans(late, withRequired);
  const days = cityDays(arranged, withRequired, "han");
  assert.equal(cityDayCapacity(late, input, 1, 0), 0);
  assert.deepEqual(days[0], []);
  assert.ok(days.slice(1).flat().includes("han-westlake"));
  assert.ok(isPlan(arranged, withRequired));
  const manual = { ...arranged, visits: { ...arranged.visits, han: [["han-westlake"], ...days.slice(1).map(ids => ids.filter(id => id !== "han-westlake"))] } };
  assert.ok(cityDays(manual, withRequired, "han")[0].includes("han-westlake"));
});

test("automatic arrival-day visits stay within the remaining time after travel and settling in", () => {
  const selected = selectFlyaiTrain(plan, input, 0, quote)!;
  const days = cityDays(selected, input, "han");
  assert.ok(dayMinutes(days[0]) <= cityDayCapacity(selected, input, 1, 0));
  assert.ok(cityDayCapacity(selected, input, 1, 1) > cityDayCapacity(selected, input, 1, 0));
});

test("a short overnight train retains its actual arrival date and train night without adding a whole arrival day", () => {
  const overnight = { ...quote, departure: `${date} 23:30:00`, arrival: `${addDays(date, 1)} 00:35:00` };
  const selected = selectFlyaiTrain(plan, input, 0, overnight)!;
  assert.ok(selected && isPlan(selected, input));
  const rows = schedule(selected, input), t = totals(selected, input);
  assert.equal(rows[0].trainQuote?.departure, overnight.departure);
  assert.equal(rows[0].transferLength, 2);
  assert.equal(rows[0].transferGap, 1);
  assert.equal(rows[1].date, addDays(date, 1));
  assert.equal(t.tripDays, input.days);
  assert.equal(t.nights, input.days - 3);
  assert.deepEqual(selected.days, [2, 2]);
  assert.deepEqual(selectFlyaiTrain(selected, input, 0, quote)!.days, plan.days);
});

test("older journey saves retain hotel dates, selected train and manual visit dates when arrival days are exposed", () => {
  let old: RoutePlan = { ...plan, calendarMode: undefined, days: [2, 2], trainQuotes: { sha: quote }, visits: { sha: [[], []], han: [["han-westlake"], []] } };
  for (const [index, stay] of hotelStays(old, input).entries()) {
    old = selectFlyaiHotel(old, input, index, { source: "flyai", hotelId: String(100 + index), city: stay.city, name: "Test", address: "",
      checkIn: stay.checkIn, checkOut: stay.checkOut, nightly: 200, currency: "CNY", priceBasis: "nightly_search_estimate", distanceKm: 2, searchedAt: quote.searchedAt })!;
  }
  assert.ok(isPlan(old, input));
  const before = JSON.stringify(old), oldRows = schedule(old, input);
  const migrated = parseDraft(JSON.stringify({ version: 1, input, plan: old, screen: "plan" }))!.plan!;
  assert.ok(isPlan(migrated, input));
  assert.equal(migrated.calendarMode, "shared");
  assert.deepEqual(migrated.days, [2, 3]);
  assert.deepEqual(hotelStays(migrated, input), hotelStays(old, input));
  assert.deepEqual(migrated.trainQuotes, old.trainQuotes);
  assert.deepEqual(migrated.visits?.han, [[], ["han-westlake"], []]);
  assert.equal(schedule(migrated, input)[1].first + 1, oldRows[1].first);
  assert.deepEqual(parseSaved(JSON.stringify([{ id: "old", savedAt: quote.searchedAt, input, plan: old }]))[0].plan, migrated);
  assert.equal(JSON.stringify(old), before);
});

test("new calendars round-trip without gaining arrival days a second time and reject an unknown calendar mode", () => {
  const snapshot = { version: 1, input, plan, screen: "plan" };
  const first = parseDraft(JSON.stringify(snapshot))!;
  const second = parseDraft(JSON.stringify(first))!;
  assert.deepEqual(second, first);
  assert.deepEqual(second.plan?.days, [2, 3]);
  assert.equal(isPlan({ ...plan, calendarMode: "unknown" }, input), false);
});

test("shared overnight arrivals cross the year boundary without moving departure or the return date", () => {
  const trip = { ...input, startDate: "2026-12-28" };
  const selected = selectFlyaiTrain(plan, trip, 0, { ...quote, departure: "2026-12-31 23:30:00", arrival: "2027-01-01 00:35:00" })!;
  assert.ok(isPlan(selected, trip));
  assert.equal(schedule(selected, trip)[1].date, "2027-01-01");
  assert.equal(hotelStays(selected, trip)[1].checkOut, "2027-01-03");
  assert.equal(totals(selected, trip).tripDays, 7);
});

test("online route search uses shared arrival dates for hotel requests and short RailGo trains", async () => {
  const trip = updateJourney({ ...initial, days: 10, required: ["sha", "han", "san"] }, {
    ...initial.journey!, minStops: 3, maxStops: 3, daysByInterest: { city: 2, nature: 3, sea: 2 },
  });
  const hotels = async (query: FlyaiQuery): Promise<FlyaiResult> => {
    assert.equal(query.kind, "hotel");
    if (query.kind !== "hotel") throw new Error("Only hotels expected");
    return { source: "flyai", query, access: "personal_key", limited: false, searchedAt: quote.searchedAt,
      offers: [{ id: "100", name: "Test", description: "", priceLabel: "200", url: null, hotelQuote: {
        source: "flyai", hotelId: "100", city: query.city, name: "Test", address: "", checkIn: query.checkIn, checkOut: query.checkOut,
        nightly: 200, currency: "CNY", priceBasis: "nightly_search_estimate", distanceKm: 2, searchedAt: quote.searchedAt,
      } }] };
  };
  const result = await createRailgoRouteSearch(hotels, async query => ({ source: "railgo", query, maxMinutes: 120, searchedAt: quote.searchedAt,
    trains: [{ ...quote, from: query.from, to: query.to, departure: `${query.date} 11:00:00`, arrival: `${query.date} 12:05:00` }],
  }), () => new Date(quote.searchedAt))(trip);
  assert.equal(result.plans.length, 3);
  for (const route of result.plans) {
    assert.equal(route.calendarMode, "shared");
    assert.ok(isPlan(route, trip));
    assert.equal(totals(route, trip).tripDays, 10);
    assert.equal(totals(route, trip).nights, 8);
    const rows = schedule(route, trip);
    rows.slice(1).forEach((row, index) => assert.equal(row.first, rows[index].transferStart));
    for (const stay of hotelStays(route, trip)) assert.equal(stay.quote?.checkIn, stay.checkIn);
  }
});
