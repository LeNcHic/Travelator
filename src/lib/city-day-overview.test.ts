import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { hotelsIn, ticketsBetween } from "../data/catalog";
import type { TripInput, RoutePlan } from "../types";
import type { RailgoTrainQuote } from "../../shared/flyai";
import { dayOverview, visitMoveOptions } from "./city-day-overview";
import { assignVisit, cityDays, dayMinutes, reorderVisit } from "./city-planner";
import { defaultInput, schedule, selectFlyaiTrain, totals } from "./planner";
import { toJourneyInput, updateJourney } from "./journey";
import { isPlan, parseDraft } from "./storage";
import CityPlanner from "../components/CityPlanner";
import VisitMoveDialog from "../components/VisitMoveDialog";

const base = { ...toJourneyInput(defaultInput()), startDate: "2026-12-28", days: 7, required: ["sha", "han"] as TripInput["required"], maxTrainMinutes: 120 as const };
const input = updateJourney(base, { ...base.journey!, minStops: 2, maxStops: 2, daysByInterest: { city: 2, nature: 2, sea: 0 }, requiredPlaces: ["han-westlake"] });
const initial: RoutePlan = { id: "balance", calendarMode: "shared", cities: ["sha", "han"], days: [2, 3],
  tickets: [ticketsBetween("sha", "han").find(ticket => ticket.mode === "train")!.id], hotels: [hotelsIn("sha")[0].id, hotelsIn("han")[0].id],
  visits: { sha: [["sha-bund", "sha-yuyuan"], ["sha-fuxing"]], han: [[], ["han-westlake"], ["han-lingyin", "han-longjing"]] } };
const quote: RailgoTrainQuote = { source: "railgo", from: "sha", to: "han", trainNumber: "G123", fromStation: "上海虹桥", toStation: "杭州东", seatClass: "二等座",
  departure: "2026-12-31 18:00:00", arrival: "2026-12-31 19:05:00", minutes: 65, amount: 73, currency: "CNY", priceBasis: "catalogue_estimate", searchedAt: "2026-10-26T12:00:00Z" };
const plan = selectFlyaiTrain(initial, input, 0, quote)!;
const noop = () => {};
const render = (p = plan, index = 1) => renderToStaticMarkup(createElement(CityPlanner, { plan: p, input, index, onCity: noop, onChange: noop, onBack: noop }));

test("daily total separates visit time from the educational allowance and handles an empty arrival day", () => {
  assert.deepEqual(dayOverview(["sha-bund", "sha-yuyuan"], 360), { count: 2, visits: 210, transfers: 30, minutes: 240, capacity: 360, overloaded: false });
  assert.equal(dayOverview(["han-lingyin", "han-longjing"], 240).overloaded, true);
  assert.deepEqual(dayOverview([], 0), { count: 0, visits: 0, transfers: 0, minutes: 0, capacity: 0, overloaded: false });
});

test("move previews match actual edits, respect the arrival window and preserve the whole trip", () => {
  assert.equal(isPlan(plan, input), true);
  const before = JSON.stringify({ plan, input });
  const options = visitMoveOptions(plan, input, "han", "han-westlake");
  assert.equal(options.length, 3); assert.equal(options[0].capacity, 0); assert.equal(options[0].overloaded, true);
  assert.equal(options[1].current, true); assert.equal(options[1].minutes, 180);
  assert.equal(options[2].minutes, 570); assert.equal(options[2].overloaded, true);
  for (const option of options.filter(item => !item.current)) {
    const moved = assignVisit(plan, input, "han", "han-westlake", option.day)!;
    assert.equal(dayMinutes(cityDays(moved, input, "han")[option.day]), option.minutes);
    assert.equal(cityDays(moved, input, "han").flat().filter(id => id === "han-westlake").length, 1);
    assert.deepEqual(moved.visits?.sha, plan.visits?.sha);
    assert.deepEqual(schedule(moved, input), schedule(plan, input));
    assert.deepEqual(totals(moved, input), totals(plan, input));
  }
  assert.equal(JSON.stringify({ plan, input }), before);
});

test("unassigned places use the same load calculation without editing or accepting a foreign city", () => {
  const options = visitMoveOptions(plan, input, "sha", "sha-tower");
  assert.equal(options[0].minutes, 390); assert.equal(options[0].overloaded, true);
  assert.equal(options[1].minutes, 210); assert.equal(options[1].current, false);
  assert.deepEqual(visitMoveOptions(plan, input, "han", "sha-tower"), []);
  assert.deepEqual(visitMoveOptions(plan, input, "bei", "bei-wall"), []);
  assert.deepEqual(visitMoveOptions(plan, input, "han", "unknown"), []);
});

test("city screen leads with the agenda and duration, with map and settings closed", () => {
  const html = render(plan, 0);
  assert.match(html, /≈ 4 ч/); assert.match(html, /3 ч 30 мин на посещения/);
  assert.match(html, /30 мин условно между местами/);
  assert.ok(html.includes("Набережная Вайтань") && html.includes("Сад Юйюань"));
  assert.ok(html.indexOf('aria-label="Посещения по порядку"') < html.indexOf("Места на карте"));
  assert.ok(html.includes('aria-label="Перенести: Набережная Вайтань"'));
  assert.ok(html.includes('aria-label="Позже: Набережная Вайтань"'));
  assert.ok(!html.includes('aria-label="Карта достопримечательностей:'));
  assert.ok(!html.includes("tv-city-view-switch"));
  assert.equal((html.match(/<details[^>]* open=/g) ?? []).length, 0);
  assert.match(html, /role="tablist" aria-label="Дни в городе"/);
  assert.match(html, /aria-selected="true" tabindex="0"/);
});

test("arrival and New Year dates remain explicit without silently scheduling visits", () => {
  const html = render();
  assert.ok(html.includes("31 дек. 2026 — 2 янв. 2027"));
  assert.ok(html.includes("День приезда."));
  assert.ok(html.includes("19:05") && html.includes("заселение и отдых"));
  assert.ok(html.includes("Посещений пока нет"));
  assert.ok(html.includes("1 янв.") && html.includes("2 янв."));
  assert.ok(!html.includes('aria-label="Посещения по порядку"'));
});

test("move dialog shows the resulting time, current day and warnings, and protects required places", () => {
  const dialog = (id: string) => renderToStaticMarkup(createElement(VisitMoveDialog, { plan, input, index: 1, id, onChoose: noop, onClose: noop }));
  const mandatory = dialog("han-westlake");
  assert.match(mandatory, /Будет ≈ 9 ч 30 мин/);
  assert.match(mandatory, /Больше ориентира 6 ч/);
  assert.match(mandatory, /день приезда/);
  assert.match(mandatory, /Сейчас здесь/);
  assert.ok(mandatory.includes("Обязательное место можно перенести"));
  assert.ok(!mandatory.includes("Пока оставить без дня"));
  assert.ok(dialog("han-lingyin").includes("Пока оставить без дня"));
  assert.equal(assignVisit(plan, input, "han", "han-westlake", null), null);
});

test("a move and reorder can be restored with the city snapshot, keeping other cities, trains and persistence", () => {
  const snapshot = cityDays(plan, input, "han").map(ids => [...ids]);
  const moved = assignVisit(plan, input, "han", "han-westlake", 2)!;
  const reordered = reorderVisit(moved, input, "han", 2, 2, -1)!;
  const restored = { ...reordered, visits: { ...reordered.visits, han: snapshot } };
  assert.deepEqual(restored, plan);
  assert.deepEqual(parseDraft(JSON.stringify({ version: 1, input, plan: restored, screen: "plan" }))?.plan, plan);
});
