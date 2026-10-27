import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { CITY_IDS } from "../../shared/cities";
import { cities, cityIds, hotelsIn } from "../data/catalog";
import { attractions, attractionsIn } from "../data/attractions";
import { findDestinations, destinationImages } from "../data/discovery";
import { chinaKnowledge, coastalSeasonNote } from "../data/china-knowledge";
import { defaultInput, generateRoutes, totals } from "./planner";
import { journeySequences, requiredPlaces, toJourneyInput, updateJourney } from "./journey";
import { cityDays, reconcileCityPlans } from "./city-planner";
import { isInput, isPlan, parseDraft } from "./storage";
import { validHotelQuote } from "../../shared/flyai";
import { flyaiArgs } from "../../server/flyai";
import { normalizeRailgo, validateRailgoQuery } from "../../server/railgo";
import type { CityId } from "../types";

const base = { ...toJourneyInput(defaultInput()), startDate: "2026-11-02", maxTrainMinutes: 120 as const };

test("all forty bases have consistent places, demo hotels, attributed photos or labelled illustrations and sources", () => {
  assert.equal(cityIds.length, 40);
  assert.deepEqual([...cityIds].sort(), [...CITY_IDS].sort());
  assert.equal(attractions.length, 207);
  const credits = JSON.parse(readFileSync(new URL("../../public/images/china/photo-credits.json", import.meta.url), "utf8"));
  for (const city of cityIds) {
    assert.ok(attractionsIn(city).length >= 3);
    assert.equal(hotelsIn(city).length, 3);
    assert.ok(existsSync(new URL(`../../public${destinationImages[city]}`, import.meta.url)));
    assert.ok(credits.some((credit: { path: string }) => credit.path === destinationImages[city]));
    assert.ok(chinaKnowledge[city].sources.every(source => source.url.startsWith("https://")));
  }
});

test("discovery offers ten distinct coasts and searches landmarks and Chinese names", () => {
  assert.deepEqual(findDestinations("sea").sort(), ["san", "qin", "xmn", "bha", "zhu", "hai", "dal", "qhd", "yan", "wei"].sort());
  assert.deepEqual(findDestinations("all", "терракотовая"), ["xan"]);
  assert.deepEqual(findDestinations("all", "панд"), ["che"]);
  assert.deepEqual(findDestinations("all", "厦门"), ["xmn"]);
  assert.deepEqual(findDestinations("all", "nonsense"), []);
});

test("every new required location produces valid full holidays and appears in the daily plan", () => {
  for (const city of ["qin", "xmn", "bha", "che", "xan", "hua"] as const) {
    const place = requiredPlaces.find(place => place.city === city)!;
    const input = updateJourney({ ...base, required: [city] }, { ...base.journey!, minStops: 2, maxStops: 3, requiredPlaces: [place.id], daysByInterest: { city: 2, nature: 2, sea: 2 } });
    const result = generateRoutes(input);
    assert.equal(result.errors.length, 0, `${city}: ${result.errors.join()}`);
    assert.equal(result.plans.length, 3);
    for (const plan of result.plans) {
      const full = reconcileCityPlans(plan, input);
      assert.ok(isPlan(full, input), city);
      assert.equal(totals(full, input).tripDays, input.days);
      assert.ok(cityDays(full, input, city).flat().includes(place.id));
      assert.ok(parseDraft(JSON.stringify({ version: 1, input, plan: full, screen: "plan" }))?.plan);
    }
  }
});

test("sea finish supports each coast, keeps explicit out-of-season wishes and explains the season", () => {
  for (const city of ["san", "qin", "xmn", "bha"] as const) {
    const input = updateJourney({ ...base, required: [city], seaEnd: true, days: 7 }, { ...base.journey!, minStops: 1, maxStops: 1, daysByInterest: { city: 0, nature: 0, sea: 3 } });
    assert.ok(isInput(input));
    const result = generateRoutes(input);
    assert.equal(result.plans.length, 3, city);
    assert.ok(result.plans.every(plan => plan.cities.at(-1) === city));
  }
  assert.ok(coastalSeasonNote("qin", "2026-11-02"));
  assert.equal(coastalSeasonNote("qin", "2027-08-02"), null);
  const winter = updateJourney({ ...base, startDate: "2026-12-02", days: 7 }, { ...base.journey!, minStops: 1, maxStops: 1, daysByInterest: { city: 0, nature: 0, sea: 3 } });
  assert.ok(generateRoutes(winter).plans.every(plan => plan.cities[0] === "san"));
});

test("bounded candidate search retains five mandatory bases without enumerating all twelve-city permutations", () => {
  const required: CityId[] = ["qin", "xmn", "bha", "che", "xan"];
  const input = updateJourney({ ...base, required, days: 21, startDate: "2027-08-02" }, { ...base.journey!, minStops: 5, maxStops: 5, daysByInterest: { city: 4, nature: 4, sea: 4 } });
  const candidates = journeySequences(input);
  assert.ok(candidates.length > 0);
  assert.ok(candidates.length < 1400);
  assert.ok(candidates.every(ids => required.every(city => ids.includes(city))));
  assert.equal(generateRoutes(input).plans.length, 3);
  assert.deepEqual(journeySequences(input), candidates);
});

test("new cities cross the FlyAI and RailGo boundaries without being rejected by old fixed lists", () => {
  for (const city of ["qin", "xmn", "bha", "che", "xan", "hua"] as const) {
    const args = flyaiArgs({ kind: "hotel", city, checkIn: "2026-11-02", checkOut: "2026-11-04" });
    assert.ok(args.includes(cities[city].cn));
    assert.ok(validHotelQuote({ source: "flyai", city, hotelId: "123", name: "Test", address: "", checkIn: "2026-11-02", checkOut: "2026-11-04", currency: "CNY", nightly: 200, priceBasis: "nightly_search_estimate", searchedAt: "2026-10-25T12:00:00Z" }));
    assert.equal(validateRailgoQuery({ from: "sha", to: city, date: "2026-11-02" }, new Date("2026-10-25T12:00:00Z")).to, city);
  }
  const result = normalizeRailgo([{ number: "G123", fromStationTelecode: "HGH", toStationTelecode: "NYH", fromDepart: "08:00", toArrive: "09:40", rundays: ["20261102"], timetable: [
    { station: "杭州东", stationTelecode: "HGH", depart: "08:00", day: 0 }, { station: "黄山北", stationTelecode: "NYH", arrive: "09:40", day: 0 },
  ] }], { from: "han", to: "hua", date: "2026-11-02" });
  assert.equal(result.trains.length, 1);
  assert.equal(result.trains[0].minutes, 100);
  assert.equal(result.trains[0].toStation, "黄山北");
});

test("a winter beach-only draft stays feasible and daily numbering includes the flight from Moscow", async () => {
  const { rebalancePreferences } = await import("../data/discovery");
  const { createElement } = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { default: CityPlanner } = await import("../components/CityPlanner");
  const input = rebalancePreferences({ ...base, startDate: "2026-12-02" }, ["sea"], 7);
  assert.equal(input.journey!.minStops, 1);
  assert.equal(input.journey!.maxStops, 1);
  const plan = reconcileCityPlans(generateRoutes(input).plans[0], input);
  assert.deepEqual(plan.cities, ["san"]);
  const noop = () => {};
  const html = renderToStaticMarkup(createElement(CityPlanner, { input, plan, index: 0, onCity: noop, onChange: noop, onBack: noop }));
  assert.ok(html.includes("День 2 поездки"));
});
