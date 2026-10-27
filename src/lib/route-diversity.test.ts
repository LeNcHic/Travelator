import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { automaticPreferences } from "./automatic-preferences";
import { defaultInput, generateRoutes, totals, rankRoutePlans, schedule } from "./planner";
import { isPlan } from "./storage";
import { destinationSetKey } from "./route-diversity";
import { alternativeTitle, routeChoiceAssessment, routeStory, stopReason } from "./route-reasons";
import { experienceAllocation } from "./journey";
import { dayMinutes } from "./city-planner";
import { hotelsIn, ticketsBetween } from "../data/catalog";
import type { RoutePlan, CityId } from "../types";
import CompareScreen from "../components/CompareScreen";
import { currentEventsForStay, type VerifiedEvent } from "../../shared/events";

const input = (days = 10) => automaticPreferences({ ...defaultInput(), startDate: "2026-11-01", days, budget: 30000 });
const noop = () => {};

test("ordinary automatic trips offer genuinely different destination sets within the same hard constraints", () => {
  for (const days of [7, 10, 14, 21, 28]) {
    const preferences = input(days), before = structuredClone(preferences), result = generateRoutes(preferences);
    assert.ok(result.plans.length >= 2 && result.plans.length <= 3, `${days} days should have several quality alternatives, without padding to three`);
    assert.equal(new Set(result.plans.map(destinationSetKey)).size, result.plans.length, `${days} days must not offer permutations as different ideas`);
    assert.ok(result.plans.every(plan => isPlan(plan, preferences) && totals(plan, preferences).tripDays === days && totals(plan, preferences).total <= preferences.budget));
    assert.deepEqual(generateRoutes(preferences), result, "deterministic ranking");
    assert.deepEqual(preferences, before);
  }
});

test("one compulsory sleeping base produces one honest route rather than artificial duplicates", () => {
  const preferences = automaticPreferences(input(7), { interests: ["city"], required: ["bei"] });
  preferences.journey = { ...preferences.journey!, minStops: 1, maxStops: 1 };
  const result = generateRoutes(preferences);
  assert.equal(result.plans.length, 1); assert.deepEqual(result.plans[0].cities, ["bei"]);
  assert.equal(result.plans[0].days[0], 7);
  const html = renderToStaticMarkup(createElement(CompareScreen, { input: preferences, ...result, routeSource: "demo", liveStatus: "idle", onRouteSource: noop, onSearch: noop, onCancel: noop, onEdit: noop, onSelect: noop }));
  assert.ok(html.includes("один подходящий набор городов"));
  assert.ok(html.includes("Почему здесь 7 дней?"));
});

test("diversity never drops compulsory cities or named places", () => {
  const preferences = input(14); preferences.required = ["bei"];
  preferences.journey!.requiredPlaces = ["bei-wall", "zjj-yuanjiajie"];
  const next = automaticPreferences(preferences), plans = generateRoutes(next).plans;
  assert.ok(plans.length);
  assert.ok(plans.every(plan => plan.cities.includes("bei") && plan.cities.includes("zjj") && isPlan(plan, next)));
});

test("each stay explanation reflects actual days, mandatory places, manual visits and free time", () => {
  const preferences = automaticPreferences(input(10), { interests: ["city", "nature"], required: ["bei"] });
  preferences.journey = { ...preferences.journey!, minStops: 1, maxStops: 1, requiredPlaces: ["bei-wall"] };
  const plan = generateRoutes(preferences).plans[0];
  const visits = Array.from({ length: 10 }, (_, index) => index === 3 ? ["bei-wall"] : []);
  const edited = { ...plan, visits: { bei: visits } }, before = structuredClone(edited);
  const reason = stopReason(edited, preferences, "bei");
  assert.equal(reason.days, 10); assert.equal(reason.freeDays, 9); assert.equal(reason.count, 1);
  assert.equal(reason.minutes, dayMinutes(["bei-wall"]));
  assert.match(reason.why, /Великая китайская стена/); assert.match(reason.daysReason, /больше обычного ориентира/);
  assert.match(reason.caveat, /9 дней остаются без назначенных посещений/); assert.deepEqual(edited, before);
});

test("personal recommendations follow actual visits and flag overload rather than promising a comfortable schedule", () => {
  const preferences = automaticPreferences(input(5), { interests: ["city"], required: ["bei"] });
  preferences.journey = { ...preferences.journey!, minStops: 1, maxStops: 1 };
  const original = generateRoutes(preferences).plans[0];
  const empty = { ...original, visits: { bei: Array.from({length:5}, () => [] as string[]) } };
  const before = structuredClone(empty), initial = stopReason(empty, preferences, "bei");
  assert.equal(initial.count,0); assert.deepEqual(initial.highlights,[]);
  assert.ok(!initial.why.includes("В программе —"));
  assert.match(initial.load,/Места пока не добавлены/);
  const edited = { ...empty, visits: { bei: [["bei-wall","bei-palace","bei-heaven"],[],[],[],[]] } };
  const reason = stopReason(edited, preferences,"bei");
  assert.equal(reason.count,3); assert.equal(reason.freeDays,4); assert.equal(reason.overloadedDays,1);
  assert.match(reason.why,/Великая китайская стена/); assert.match(reason.caveat,/плотнее выбранного темпа/);
  assert.match(reason.daysReason,/посещения сейчас занимают только 1 день/);
  assert.deepEqual(empty,before,"writing advice never modifies a stored plan");
});

test("route narratives describe actual transport, compulsory stops and the chosen sea ending", () => {
  const preferences = automaticPreferences(input(7), { interests: ["city","nature"], required: ["sha","han"] });
  const plan: RoutePlan = { id:"balance",calendarMode:"shared",cities:["sha","han"],days:[3,4],hotels:[hotelsIn("sha")[0].id,hotelsIn("han")[0].id],tickets:[ticketsBetween("sha","han").find(ticket=>ticket.mode==="train")!.id] };
  const before=structuredClone(plan), story=routeStory(plan,preferences);
  assert.match(story.overview,/«Шанхай»/); assert.match(story.overview,/«Ханчжоу»/);
  assert.match(story.personal,/Обязательные города/);
  assert.match(story.transport,/предлагаем поезда/);
  assert.ok(!story.transport.includes("перелёты")); assert.ok(!story.transport.includes("аэропорты"));
  assert.match(story.transport,/ориентировочная/); assert.deepEqual(plan,before);
  const seaInput={...automaticPreferences(input(10),{interests:["nature","sea"],required:["gui","san"]}),seaEnd:true};
  seaInput.journey={...seaInput.journey!,minStops:2,maxStops:2};
  const seaPlan=generateRoutes(seaInput).plans[0]; assert.ok(seaPlan);
  const sea=stopReason(seaPlan,seaInput,"san");
  assert.match(sea.connection,/Завершаем путешествие у моря/);
  assert.match(routeStory(seaPlan,seaInput).personal,/Морской отдых оставили на финал/);
  const single={...plan,cities:["sha"] as CityId[],days:[7],tickets:[],hotels:[plan.hotels[0]]};
  assert.match(routeStory(single,preferences).transport,/из одной базы/);
});

test("coastal advice distinguishes a city-and-island stay from a beach stay without inventing visits", () => {
  const preferences = automaticPreferences(input(5), { interests: ["sea"] });
  const single = (city: CityId): RoutePlan => ({ id: "balance", calendarMode: "shared", cities: [city], days: [5], tickets: [], hotels: [hotelsIn(city)[0].id], visits: { [city]: Array.from({length: 5}, () => [] as string[]) } });
  const xiamen = stopReason(single("xmn"), preferences, "xmn"), sanya = stopReason(single("san"), preferences, "san");
  assert.match(xiamen.why, /старые улицы и остров Гуланъюй/);
  assert.match(sanya.why, /пляжи и свободное время/);
  for (const reason of [xiamen, sanya]) {
    assert.match(reason.daysReason, /места пока не добавлены/);
    assert.equal(reason.practical, "", "a destination highlight alone does not imply a booked or planned visit");
    assert.ok(!reason.why.includes("В текущем плане"));
  }
});

test("practical advice and concrete overload suggestions follow manual programme edits", () => {
  const preferences = automaticPreferences(input(5), { interests: ["city", "sea"] });
  const base: RoutePlan = { id: "balance", calendarMode: "shared", cities: ["xmn"], days: [5], tickets: [], hotels: [hotelsIn("xmn")[0].id], visits: { xmn: [["xmn-gulangyu", "xmn-huandao"], [], [], [], []] } };
  const overloaded = stopReason(base, preferences, "xmn");
  assert.match(overloaded.practical, /паром/);
  assert.match(overloaded.caveat, /В 1-й день остановки заложено/);
  assert.match(overloaded.caveat, /перенести на свободный 2-й день/);
  const spread = {...base, visits: {xmn: [["xmn-gulangyu"], ["xmn-huandao"], [], [], []]}};
  assert.equal(stopReason(spread, preferences, "xmn").overloadedDays, 0);
  const withoutIsland = {...base, visits: {xmn: [["xmn-huandao"], [], [], [], []]}};
  assert.equal(stopReason(withoutIsland, preferences, "xmn").practical, "");
  assert.match(stopReason(withoutIsland, preferences, "xmn").load, /4 дня остаются без назначенных посещений/);
});

test("a short-train connection is explained only when the chosen leg really qualifies", () => {
  const preferences = automaticPreferences(input(7), { interests: ["city", "nature"] });
  const plan: RoutePlan = {id:"balance", calendarMode:"shared", cities:["sha", "han"], days:[3,4], hotels:[hotelsIn("sha")[0].id,hotelsIn("han")[0].id], tickets:[ticketsBetween("sha", "han").find(ticket => ticket.mode === "train")!.id]};
  assert.match(stopReason(plan, preferences, "han").connection, /1 ч 5 мин на поезде/);
  const longer: RoutePlan = {...plan, cities:["sha", "bei"], hotels:[plan.hotels[0],hotelsIn("bei")[0].id], tickets:[ticketsBetween("sha", "bei").find(ticket => ticket.mode === "train")!.id]};
  assert.ok(!stopReason(longer, preferences, "bei").connection.includes("без длинного переезда"));
});

test("coastal advice uses the actual stay season and does not assume dates for a flexible trip", () => {
  const preferences = automaticPreferences({...input(5), startDate: "2027-01-12"}, {interests: ["sea"]});
  preferences.journey = {...preferences.journey!, flexibleDates: false};
  const plan: RoutePlan = {id: "balance", calendarMode:"shared", cities:["xmn"], days:[5], hotels:[hotelsIn("xmn")[0].id], tickets: []};
  assert.match(stopReason(plan, preferences, "xmn").caveat, /купание не предполагаем/);
  const flexible = {...preferences, journey:{...preferences.journey!, flexibleDates:true}};
  assert.ok(!stopReason(plan, flexible, "xmn").caveat.includes("купание не предполагаем"));
});

test("alternative titles never claim savings or less road time without the corresponding fact", () => {
  const preferences = input(14), [main, ...others] = generateRoutes(preferences).plans;
  for (const plan of others) {
    const title = alternativeTitle(main, plan, preferences), a = totals(main, preferences), b = totals(plan, preferences);
    if (title === "Экономнее") assert.ok(b.total < a.total);
    if (title === "Меньше времени в дороге") assert.ok(b.minutes < a.minutes);
    if (title === "Меньше переездов") assert.ok(plan.cities.length < main.cities.length);
  }
});

test("only fresh, source-verified events on exact stop dates may contribute to a route", () => {
  const now = Date.now();
  const event: VerifiedEvent = { id: "test-event", city: "sha", title: "Выставка", description: "Описание выставки", advice: "Проверьте билеты", dates: { start: "2026-11-02", end: "2026-11-03" }, source: { title: "Официальный портал", url: "https://english.shanghai.gov.cn/en-Events/test.html" }, verifiedAt: new Date(now).toISOString() };
  assert.equal(currentEventsForStay([event], "sha", "2026-11-01", "2026-11-02", now).length, 1);
  assert.equal(currentEventsForStay([event], "bei", "2026-11-01", "2026-11-02", now).length, 0);
  assert.equal(currentEventsForStay([event], "sha", "2026-11-04", "2026-11-08", now).length, 0);
  assert.equal(currentEventsForStay([{ ...event, verifiedAt: new Date(now - 7 * 3600000).toISOString() }], "sha", "2026-11-01", "2026-11-02", now).length, 0);
  assert.equal(currentEventsForStay([{ ...event, source: { ...event.source, url: "https://unknown.example/event" } }], "sha", "2026-11-01", "2026-11-02", now).length, 0);
  const flexible = input(); assert.deepEqual(generateRoutes(flexible, [event]), generateRoutes(flexible), "no invented season or date when no dates are chosen");
});

test("a fresh event can improve an otherwise comparable route, but cannot shift the trip or invent a match", () => {
  const preferences = automaticPreferences(input(8), { interests: ["city"] });
  preferences.journey!.flexibleDates = false;
  const fixture = (to: CityId): RoutePlan => {
    const ids: CityId[] = ["sha", to];
    const plan: RoutePlan = { id: "balance", calendarMode: "shared", cities: ids, days: [4, 4], tickets: [ticketsBetween("sha", to).find(ticket => ticket.mode === "air")!.id], hotels: ids.map(id => hotelsIn(id)[0].id) };
    const rows = schedule(plan, preferences);
    plan.hotelQuotes = Object.fromEntries(rows.map(row => [row.city, { source: "flyai", hotelId: "123", city: row.city, name: "Hotel", address: "Address", checkIn: row.date, checkOut: row.ticket ? rows[1].date : row.endDate, nightly: 100, currency: "CNY", priceBasis: "nightly_search_estimate", searchedAt: new Date().toISOString() }]));
    plan.flightQuotes = { sha: { source: "flyai", from: "sha", to, flightNumber: "MU1234", airlineCode: "MU", fromAirport: "PVG", toAirport: to === "bei" ? "PKX" : "XIY", cabin: "economy", departure: `${rows[1].date} 09:00:00`, arrival: `${rows[1].date} 11:00:00`, minutes: 120, amount: 200, currency: "CNY", priceBasis: "passenger_search_fare", searchedAt: new Date().toISOString() } };
    return plan;
  };
  const beijing = fixture("bei"), xian = fixture("xan");
  assert.ok(isPlan(beijing, preferences) && isPlan(xian, preferences));
  const plain = rankRoutePlans([beijing, xian], preferences).plans[0]; assert.deepEqual(plain.cities, ["sha", "bei"]);
  const event: VerifiedEvent = { id: "xian-test", city: "xan", title: "Выставка в Сиане", description: "Описание выставки", advice: "Проверьте время", dates: { start: "2026-11-05", end: "2026-11-08" }, source: { title: "Официальный портал", url: "https://wlj.xa.gov.cn/test.html" }, verifiedAt: new Date().toISOString() };
  assert.deepEqual(rankRoutePlans([beijing, xian], preferences, [event]).plans[0].cities, ["sha", "xan"]);
  assert.deepEqual(rankRoutePlans([beijing, xian], preferences, [{ ...event, dates: { start: "2026-11-09", end: "2026-11-12" } }]).plans[0].cities, plain.cities);
  assert.deepEqual(rankRoutePlans([beijing, xian], preferences, [{ ...event, verifiedAt: "2020-01-01T00:00:00Z" }]).plans[0].cities, plain.cities);
});

test("fixed stop explanations preserve the same balanced interest totals used to generate automatic days", () => {
  const preferences = automaticPreferences(input(14)); preferences.journey!.requiredPlaces = ["zjj-yuanjiajie"];
  const next = automaticPreferences(preferences), result = generateRoutes(next);
  assert.ok(result.plans.length);
  for (const plan of result.plans) {
    const allocation = Object.values(experienceAllocation(plan.cities, next, 14, plan.days)!).flat();
    const counts = next.interests.map(kind => allocation.filter(value => value === kind).length);
    assert.ok(Math.max(...counts) - Math.min(...counts) <= 1, "a mandatory two-day place is a floor, not double the interest weight");
    assert.equal(allocation.length, 14);
    for (const [index, city] of plan.cities.entries()) assert.equal(stopReason(plan, next, city).experiences.reduce((sum, item) => sum + item.days, 0), plan.days[index]);
  }
});

test("choice assessments justify the current option with measured trade-offs among shown alternatives", () => {
  const preferences = input(14), plans = generateRoutes(preferences).plans;
  const minimum = Math.min(...plans.map(plan => totals(plan, preferences).total));
  const fastest = Math.min(...plans.map(plan => totals(plan, preferences).minutes));
  for (const plan of plans) {
    const assessment = routeChoiceAssessment(plan, preferences, plans), values = totals(plan, preferences);
    assert.equal(assessment.costAboveMinimum, Math.round((values.total - minimum) * 100) / 100);
    assert.equal(assessment.minutesAboveFastest, values.minutes - fastest);
    if (assessment.strength.includes("самых доступных")) assert.equal(values.total, minimum);
    if (assessment.strength.includes("меньше всего времени")) assert.equal(values.minutes, fastest);
    if (assessment.strength.includes("ближе всего к вашим интересам")) assert.ok(assessment.fitGap < .01);
    assert.ok(!assessment.strength.includes("оптимальный"));
  }
});
