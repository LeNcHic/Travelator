import test from "node:test";
import assert from "node:assert/strict";
import { createFlightSearch, normalizeFlights, validateFlightQuery } from "./flights";
import { validFlightQuote, airportLabel, airlineLabel } from "../shared/flights";
import { defaultInput, generateRoutes, schedule, selectFlyaiFlight, selectFlyaiTrain, totals, changeTicket, hotelStays } from "../src/lib/planner";
import { automaticPreferences } from "../src/lib/automatic-preferences";
import { isPlan, parseDraft } from "../src/lib/storage";
import { addDays } from "../src/lib/format";
import { createRailgoRouteSearch } from "./railgo-routes";
import { validateLiveResult } from "../src/lib/live-route-search";
import { HotelApiError } from "./hotels";
import type { FlightQuery, FlightQuote, FlightResult } from "../shared/flights";
import type { FlyaiQuery, FlyaiResult } from "../shared/flyai";

const now = new Date("2026-10-27T12:00:00Z"), query: FlightQuery = { from: "sha", to: "bei", date: "2026-11-03" };
const raw = (price = "379.00") => ({ status: 0, data: { itemList: [{ ticketPrice: price, totalDuration: "135", jumpUrl: "https://router.feizhu.com/ws/test", journeys: [{ segments: [{ transportType: "飞机", depCityName: "上海", arrCityName: "北京", depDateTime: `${query.date} 21:05:00`, arrDateTime: `${query.date} 23:20:00`, depStationCode: "PVG", arrStationCode: "PKX", marketingTransportNo: "MU5185", seatClassName: "经济舱" }] }] }] } });
const quote = () => normalizeFlights(raw(), query, now, true).offers[0].quote;

test("real flight payload uses the published fare, correct airports and China wall-clock times", () => {
  const result = normalizeFlights(raw(), query, now, true);
  assert.equal(result.offers.length, 1); assert.equal(result.offers[0].quote.amount, 379);
  assert.equal(result.offers[0].quote.priceBasis, "passenger_search_fare");
  assert.equal(result.offers[0].quote.minutes, 135); assert.ok(validFlightQuote(quote()));
  assert.match(airportLabel("PVG"), /Шанхай Пудун/); assert.match(airlineLabel("MU"), /Китайские Восточные/);
  assert.equal(normalizeFlights(raw(), query, now, false).offers.length, 0);
  assert.throws(() => normalizeFlights(raw("3xx"), query, now, true), { code: "FLIGHTS_NO_VALID_FARES" });
  const mismatch = raw(); mismatch.data.itemList[0].journeys[0].segments[0].arrCityName = "广州";
  assert.throws(() => normalizeFlights(mismatch, query, now, true), { code: "FLIGHTS_NO_VALID_FARES" });
  assert.equal(validFlightQuote({ ...quote(), toAirport: "KWL" }), false);
  assert.equal(validFlightQuote({ ...quote(), minutes: 130 }), false);
  assert.equal(validFlightQuote({ ...quote(), flightNumber: 123456, airlineCode: 12 }), false);
});

test("flight input is bounded, cached, coalesced and never returns a false empty result after failure", async () => {
  assert.throws(() => validateFlightQuery({ ...query, date: "2026-02-30" }, now));
  assert.throws(() => validateFlightQuery({ ...query, date: "2026-10-26" }, now));
  assert.throws(() => validateFlightQuery({ ...query, from: "unknown" }, now));
  let calls = 0; const search = createFlightSearch(async () => { calls++; return raw(); }, () => now, "test-key");
  const [one, two] = await Promise.all([search(query), search(query)]); assert.deepEqual(one, two); assert.equal(calls, 1);
  await search(query); assert.equal(calls, 1);
  let failedCalls = 0; const retry = createFlightSearch(async () => { failedCalls++; if (failedCalls === 1) throw new Error("offline"); return raw(); }, () => now, "test-key");
  await assert.rejects(retry(query)); assert.equal((await retry(query)).offers.length, 1); assert.equal(failedCalls, 2);
});

test("FlyAI route/date search failures are distinct from malformed data and a confirmed empty result", () => {
  const unavailable = { status: 1, data: null, message: "搜索机票低价行业失败", systemMessage: null };
  assert.throws(() => normalizeFlights(unavailable, {from:"san",to:"gui",date:"2026-11-04"}, now, true), (error: unknown) => {
    assert.ok(error instanceof HotelApiError);
    assert.equal(error.status,503); assert.equal(error.code,"FLIGHTS_SEARCH_FAILED");
    assert.match(error.message,/по этому направлению на выбранную дату/);
    assert.ok(!error.message.includes(unavailable.message),"provider diagnostics stay on the server");
    return true;
  });
  assert.throws(() => normalizeFlights({status:0,data:null},query,now,true), {code:"FLIGHTS_BAD_RESPONSE"});
  assert.deepEqual(normalizeFlights({status:0,data:{itemList:[]}},query,now,true).offers,[]);
  assert.equal(normalizeFlights(raw(),query,now,true).offers.length,1,"an error on another route does not affect valid flights");
});

test("a failed FlyAI search is coalesced but never cached as zero flights; retry can recover", async () => {
  let calls=0;
  const search=createFlightSearch(async () => {
    calls++;
    return calls===1 ? {status:1,data:null,message:"搜索机票低价行业失败"} : raw();
  },()=>now,"test-key");
  const [one,two]=await Promise.allSettled([search(query),search(query)]);
  for(const result of [one,two]) { assert.equal(result.status,"rejected"); if(result.status==="rejected") assert.equal(result.reason.code,"FLIGHTS_SEARCH_FAILED"); }
  assert.equal(calls,1);
  assert.equal((await search(query)).offers.length,1);
  assert.equal(calls,2);
  await search(query); assert.equal(calls,2,"only a successful result is reused");
});

function preferences() {
  const input = automaticPreferences({ ...defaultInput(), startDate: "2026-11-01", days: 10, budget: 30000, interests: ["city"], required: ["sha", "bei"], transport: "air" });
  input.journey = { ...input.journey!, flexibleDates: false, minStops: 2, maxStops: 2 }; return input;
}
function forLeg(input: ReturnType<typeof preferences>, plan: ReturnType<typeof generateRoutes>["plans"][number]): FlightQuote {
  const row = schedule(plan, input)[0], from = row.city, to = plan.cities[1], date = addDays(input.startDate, row.transferStart);
  return { ...quote(), from, to, fromAirport: from === "sha" ? "PVG" : "PKX", toAirport: to === "bei" ? "PKX" : "PVG", departure: `${date} 09:00:00`, arrival: `${date} 11:15:00` };
}

test("selected flight replaces the estimate, retains ten days and nine nights and round-trips through saved data", () => {
  const input = preferences(), original = generateRoutes(input).plans[0], before = structuredClone(original), fare = forLeg(input, original);
  const selected = selectFlyaiFlight(original, input, 0, fare)!;
  assert.ok(selected); assert.equal(totals(selected, input).transit, 379); assert.equal(totals(selected, input).liveFlights, 1);
  assert.equal(totals(selected, input).demoTickets, 0); assert.equal(totals(selected, input).tripDays, 10); assert.equal(totals(selected, input).nights, 9);
  assert.equal(schedule(selected, input)[0].flightQuote?.flightNumber, "MU5185"); assert.ok(isPlan(selected, input));
  assert.deepEqual(parseDraft(JSON.stringify({ version: 1, screen: "plan", input, plan: selected }))?.plan, selected);
  assert.deepEqual(original, before);
  const demo = changeTicket(selected, input, 0, selected.tickets[0])!; assert.equal(totals(demo, input).liveFlights, 0);
  assert.equal(selectFlyaiFlight(original, input, 0, { ...fare, departure: `${fare.departure.slice(0, 10)} 23:00:00`, arrival: `${addDays(fare.departure.slice(0, 10), 1)} 01:15:00` }), null);
});

test("route search combines real flights and hotel prices; failed flights never become invented online offers", async () => {
  const input = preferences(); let flightCalls = 0;
  const hotels = async (q: FlyaiQuery): Promise<FlyaiResult> => {
    if (q.kind !== "hotel") throw new Error("Only hotels");
    return { source: "flyai", query: q, searchedAt: now.toISOString(), access: "personal_key", limited: false, offers: [{ id: "123", name: "Original hotel name", description: "Address", url: null, priceLabel: "100", hotelQuote: { source: "flyai", hotelId: "123", city: q.city, name: "Original hotel name", address: "Address", checkIn: q.checkIn, checkOut: q.checkOut, nightly: 100, currency: "CNY", priceBasis: "nightly_search_estimate", distanceKm: 2, searchedAt: now.toISOString() } }] };
  };
  const flights = async (q: FlightQuery): Promise<FlightResult> => {
    flightCalls++; return { source: "flyai", query: q, searchedAt: now.toISOString(), access: "personal_key", limited: false, offers: [{ url: null, quote: { ...quote(), from: q.from, to: q.to, fromAirport: q.from === "sha" ? "PVG" : "PKX", toAirport: q.to === "bei" ? "PKX" : "PVG", departure: `${q.date} 09:00:00`, arrival: `${q.date} 11:15:00`, amount: 379 } }] };
  };
  const search = createRailgoRouteSearch(hotels, async () => { throw new Error("No short rail"); }, () => now, undefined, flights);
  const result = await search(input); assert.ok(result.plans.length); assert.ok(flightCalls > 0); assert.ok(validateLiveResult(result, input));
  for (const plan of result.plans) { assert.equal(totals(plan, input).liveFlights, 1); assert.equal(totals(plan, input).total, 1279); assert.equal(hotelStays(plan, input)[0].checkIn, input.startDate); }
  const unavailable = createRailgoRouteSearch(hotels, async () => { throw new Error("No train"); }, () => now, undefined, async () => { throw new Error("Offline"); });
  const failed = await unavailable(input); assert.equal(failed.plans.length, 0); assert.ok(failed.warnings.some(message => message.includes("авиабилетов")));
  let restrictedCalls = 0;
  const restricted = createRailgoRouteSearch(hotels, async () => { throw new Error("No train"); }, () => now, undefined, async () => {
    restrictedCalls++; throw new HotelApiError(503, "FLYAI_ACCESS_RESTRICTED", "Доступ ограничен");
  });
  await assert.rejects(restricted(input), { code: "FLYAI_ACCESS_RESTRICTED" });
  assert.equal(restrictedCalls, 1, "A provider restriction must immediately stop the search");
  for (const distanceKm of [undefined, 65]) {
    const outsideBase = createRailgoRouteSearch(async q => {
      const response = await hotels(q);
      response.offers[0].hotelQuote!.distanceKm = distanceKm;
      return response;
    }, async () => { throw new Error("No train"); }, () => now, undefined, flights);
    assert.equal((await outsideBase(input)).plans.length, 0, "Unknown or distant hotels must not make a route look cheaper");
  }
});
