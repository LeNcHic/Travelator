import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { hotelsIn, ticketsBetween } from "../data/catalog";
import { defaultInput, generateRoutes, routeSignature, schedule, totals } from "./planner";
import { toJourneyInput, updateJourney } from "./journey";
import { defaultVariant, groupRouteOptions, itineraryKey, variantTitle, variantTradeoff } from "./route-options";
import { isPlan } from "./storage";
import CompareScreen from "../components/CompareScreen";
import type { RoutePlan, TripInput } from "../types";

const base = { ...toJourneyInput(defaultInput()), startDate: "2026-11-24", days: 12, maxTrainMinutes: 120 as const, required: ["che", "xan"] as RoutePlan["cities"] };
const input = updateJourney(base, { ...base.journey!, minStops: 2, maxStops: 2, daysByInterest: { city: 5, nature: 4, sea: 0 }, requiredPlaces: ["xan-terracotta"] });
const fixture = () => {
  const initial = generateRoutes(input).plans[0];
  const [from, to] = initial.cities;
  const options = ticketsBetween(from, to).filter(ticket => ticket.mode === "air");
  const cheapTicket = [...options].sort((a, b) => a.price - b.price)[0];
  const fastTicket = [...options].sort((a, b) => a.minutes + a.overhead - b.minutes - b.overhead)[0];
  const value: RoutePlan = { ...initial, id: "value", tickets: [cheapTicket.id] };
  const fast: RoutePlan = { ...initial, id: "fast", tickets: [fastTicket.id] };
  const balance: RoutePlan = { ...fast, id: "balance" };
  assert.ok(isPlan(value, input) && isPlan(fast, input));
  return { value, fast, balance, plans: [balance, value, fast] };
};
const noop = () => {};
const render = (plans: RoutePlan[], overrides: Partial<Parameters<typeof CompareScreen>[0]> = {}) => renderToStaticMarkup(createElement(CompareScreen, {
  input, plans, errors: [], routeSource: "demo", liveStatus: "idle", onRouteSource: noop, onSearch: noop, onCancel: noop, onEdit: noop, onSelect: noop, ...overrides,
}));

test("online provider failure explains the reason beside retry while keeping route selection available", () => {
  const reason = "FlyAI временно ограничил доступ по своей системе защиты. Предварительный маршрут доступен.";
  const html = render(fixture().plans, { routeSource: "flyai", liveStatus: "error", errors: [reason] });
  assert.match(html, /role="alert"[^>]*>[\s\S]*?Не удалось уточнить предложения[\s\S]*?FlyAI временно ограничил доступ[\s\S]*?Повторить проверку/);
  assert.equal(html.split(reason).length - 1, 1);
  assert.ok(html.indexOf(reason) < html.indexOf("Что входит в расчёт"));
  assert.ok(html.includes("Выбрать маршрут"));
  assert.ok(!html.includes("Расписания и гостиницы проверены"));
});

test("same bases and dates produce one itinerary with intact price/time variants and merged exact duplicates", () => {
  const { plans, value, balance } = fixture(), before = JSON.stringify({ plans, input });
  const groups = groupRouteOptions(plans, input);
  assert.equal(groups.length, 1); assert.equal(groups[0].variants.length, 2);
  assert.deepEqual(groups[0].variants[0].labels, ["balance", "fast"]);
  assert.equal(defaultVariant(groups[0], "balance").plan, balance);
  assert.equal(defaultVariant(groups[0], "value").plan, value);
  assert.equal(variantTitle(groups[0].variants[0]), "Быстрее");
  assert.equal(variantTitle(groups[0].variants[1]), "Дешевле");
  assert.equal(routeSignature(groups[0].variants[1].plan), routeSignature(value));
  assert.equal(JSON.stringify({ plans, input }), before);
});

test("different hotels remain selectable inside the same itinerary", () => {
  const { balance } = fixture();
  const upgrade: RoutePlan = { ...balance, id: "value", hotels: balance.hotels.map((hotel, i) => i === 0 ? hotelsIn(balance.cities[0])[1].id : hotel) };
  const grouped = groupRouteOptions([balance, upgrade], input);
  assert.equal(grouped.length, 1); assert.equal(grouped[0].variants.length, 2);
  assert.equal(grouped[0].variants[1].plan.hotels[0], upgrade.hotels[0]);
  assert.ok(totals(upgrade, input).total > totals(balance, input).total);
});

test("a different day distribution or city order stays a separate route", () => {
  const { balance } = fixture();
  const differentDays = { ...balance, id: "value" as const, days: [balance.days[0] - 1, balance.days[1] + 1] };
  assert.notEqual(itineraryKey(balance, input), itineraryKey(differentDays, input));
  assert.notEqual(itineraryKey(balance, input), itineraryKey(balance, { ...input, startDate: "2026-11-25" }));
  assert.equal(groupRouteOptions([balance, differentDays], input).length, 2);
  const reversed: RoutePlan = { ...balance, id: "fast", cities: [...balance.cities].reverse(), days: [...balance.days].reverse(),
    hotels: [...balance.hotels].reverse(), tickets: [ticketsBetween(balance.cities[1], balance.cities[0]).find(ticket => ticket.mode === "air")!.id] };
  assert.equal(groupRouteOptions([balance, reversed], input).length, 2);
  const main = groupRouteOptions([differentDays, reversed, balance], { ...input, priority: "fast" });
  assert.equal(defaultVariant(main[0], "fast").plan, reversed);
});

test("night transfers with the same bases and day counts never hide different actual stop calendars", () => {
  const nightInput = updateJourney({ ...base, days: 14, maxTrainMinutes: undefined, required: ["sha", "san", "zjj"] }, {
    ...base.journey!, minStops: 3, maxStops: 3, daysByInterest: { city: 3, nature: 4, sea: 4 }, requiredPlaces: [],
  });
  const cities: RoutePlan["cities"] = ["sha", "san", "zjj"];
  const plan: RoutePlan = { id: "balance", calendarMode: "shared", cities, days: [3, 4, 4], hotels: cities.map(city => hotelsIn(city)[0].id),
    tickets: [ticketsBetween("sha", "san").find(ticket => ticket.mode === "train")!.id, ticketsBetween("san", "zjj").find(ticket => ticket.mode === "air")!.id] };
  const laterNight: RoutePlan = { ...plan, id: "fast", tickets: [ticketsBetween("sha", "san").find(ticket => ticket.mode === "air")!.id,
    ticketsBetween("san", "zjj").find(ticket => ticket.mode === "train")!.id] };
  assert.ok(isPlan(plan, nightInput) && isPlan(laterNight, nightInput));
  assert.equal(totals(plan, nightInput).tripDays, 14); assert.equal(totals(laterNight, nightInput).tripDays, 14);
  assert.notEqual(schedule(plan, nightInput)[1].date, schedule(laterNight, nightInput)[1].date);
  assert.equal(groupRouteOptions([plan, laterNight], nightInput).length, 2);
});

test("variant differences state price/time direction and identical alternatives do not invent a saving", () => {
  const { value, fast } = fixture();
  assert.match(variantTradeoff(fast, value, input), /экономии.*больше в дороге/);
  assert.match(variantTradeoff(value, fast, input), /дороже.*меньше в дороге/);
  assert.match(variantTradeoff(value, value, input), /той же цене и времени/);
});

test("one itinerary renders one choose action, a preselected native radio group and one collapsed map/explanation", () => {
  const { plans } = fixture(), html = render(plans);
  assert.equal((html.match(/<article class="route-option /g) ?? []).length, 1);
  assert.equal((html.match(/<button[^>]*aria-label="Выбрать маршрут/g) ?? []).length, 1);
  assert.equal((html.match(/type="radio"/g) ?? []).length, 2);
  assert.equal((html.match(/checked=""/g) ?? []).length, 1);
  assert.equal((html.match(/class="route-option-details"/g) ?? []).length, 1);
  assert.ok(!html.includes('class="route-option-details" open=""'));
  assert.ok(html.includes("Города и даты одинаковые"));
  assert.ok(html.includes("Ваш маршрут по Китаю"));
  assert.ok(html.includes("Карта и объяснение маршрута") && html.includes("Терракотовая армия"));
  assert.ok(!html.includes("Баланс · Быстрее"));
  assert.ok(html.indexOf("Выбрать маршрут") < html.indexOf("Уточнить предложения"));
});

test("exactly coinciding strategies need no extra selector and provider errors preserve the simple choice", () => {
  const { balance } = fixture(), plans = (["balance", "fast", "value"] as const).map(id => ({ ...balance, id }));
  const html = render(plans, { liveStatus: "error", errors: ["Provider unavailable"], currentPlan: balance });
  assert.ok(!html.includes('type="radio"'));
  assert.ok(html.includes("Один маршрут подошёл всем трём критериям"));
  assert.ok(html.includes("Продолжить мой план"));
  assert.ok(!html.includes("план с внесёнными правками"));
  assert.equal((html.match(/<button[^>]*aria-label="Выбрать маршрут/g) ?? []).length, 1);
});
