import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { hotelsIn, ticketsBetween } from "../data/catalog";
import type { RoutePlan, TripInput } from "../types";
import type { FlyaiTrainQuote, RailgoTrainQuote } from "../../shared/flyai";
import { defaultInput, hotelStays, schedule, selectFlyaiTrain, selectFlyaiHotel } from "./planner";
import { toJourneyInput, updateJourney } from "./journey";
import { planTransfer } from "./plan-transfer";
import { reconcileCityPlans } from "./city-planner";
import PlanScreen from "../components/PlanScreen";
import OfferPicker from "../components/OfferPicker";

const base = { ...toJourneyInput(defaultInput()), startDate: "2026-11-02", maxTrainMinutes: 120 as const, days: 7, required: ["sha", "han"] as TripInput["required"] };
const input = updateJourney(base, { ...base.journey!, minStops: 2, maxStops: 2, daysByInterest: { city: 2, nature: 2, sea: 0 }, requiredPlaces: [] });
const plan: RoutePlan = { id: "balance", calendarMode: "shared", cities: ["sha", "han"], days: [2, 3],
  tickets: [ticketsBetween("sha", "han").find(ticket => ticket.mode === "train" && ticket.minutes <= 120)!.id],
  hotels: [hotelsIn("sha")[0].id, hotelsIn("han")[0].id] };
const quote: RailgoTrainQuote = { source: "railgo", from: "sha", to: "han", trainNumber: "G123", fromStation: "上海虹桥", toStation: "杭州东", seatClass: "二等座",
  departure: "2026-11-05 15:00:00", arrival: "2026-11-05 16:05:00", minutes: 65, amount: 73, currency: "CNY", priceBasis: "catalogue_estimate", searchedAt: "2026-10-26T12:00:00Z" };
const noop = () => {};
const render = (p = plan, i = input) => renderToStaticMarkup(createElement(PlanScreen, { input: i, plan: p, saved: false,
  onBack: noop, onSave: noop, onChange: noop, onHotel: noop, onTicket: noop, notice: "" }));

test("overview shows cities, days and the transfer in chronological order before optional details", () => {
  const selected = selectFlyaiTrain(plan, input, 0, quote)!;
  assert.ok(selected);
  const html = render(selected);
  const outbound = html.indexOf("Москва → Шанхай"), first = html.indexOf('id="tp-city-sha"');
  const transfer = html.indexOf('aria-label="Переезд: Шанхай — Ханчжоу"'), second = html.indexOf('id="tp-city-han"');
  assert.ok(outbound < first && first < transfer && transfer < second && second < html.indexOf("Ханчжоу → Москва"));
  assert.ok(html.indexOf('id="tp-stop-sha"') < transfer);
  assert.match(html, /2 дня/); assert.match(html, /3 дня/);
  assert.match(html, /5 нояб\. — 7 нояб\. 2026/);
  assert.match(html, /Первый день — переезд/);
  assert.equal((html.match(/<details[^>]* open=/g) ?? []).length, 0);
  assert.ok(!html.includes("tp-tabs"));
  assert.ok(!html.includes('aria-label="Карта маршрута:'));
  assert.ok(html.includes('aria-label="Выбрать билет: Шанхай — Ханчжоу"'));
  assert.ok(html.includes('aria-label="Выбрать гостиницу: Ханчжоу"'));
});

test("short train summary separates ride time from station allowance and labels the estimated fare", () => {
  const selected = selectFlyaiTrain(plan, input, 0, quote)!;
  const data = planTransfer(schedule(selected, input)[0], input)!;
  assert.equal(data.rideMinutes, 65); assert.equal(data.totalMinutes, 125);
  assert.equal(data.estimatedSchedule, false); assert.equal(data.estimatedPrice, true);
  assert.equal(data.source, "Расписание RailGo");
  assert.equal(data.start, "2026-11-05"); assert.equal(data.end, data.start);
  const html = render(selected);
  assert.match(html, /Поезд · 1 ч 5 мин в пути/);
  assert.match(html, /весь переезд 2 ч 5 мин/);
  assert.ok(html.includes("上海虹桥") && html.includes("杭州东") && html.includes("G123"));
  assert.match(html, /Оценка: ¥ 73/);
});

test("overnight summary preserves exact dates across New Year and destination hotel arrival", () => {
  const trip = { ...input, startDate: "2026-12-28" };
  const night = { ...quote, departure: "2026-12-31 23:30:00", arrival: "2027-01-01 00:35:00" };
  const selected = selectFlyaiTrain(plan, trip, 0, night)!;
  assert.ok(selected);
  const data = planTransfer(schedule(selected, trip)[0], trip)!;
  assert.deepEqual([data.start, data.end, data.departure, data.arrival], ["2026-12-31", "2027-01-01", "23:30", "00:35"]);
  assert.equal(data.end, hotelStays(selected, trip)[1].checkIn);
  const html = render(selected, trip);
  assert.match(html, /31 дек\. 2026 — 1 янв\. 2027/);
  assert.match(html, /прибытие 1 янв\. 2027/);
});

test("expired quotes fall back to the current calendar, while FlyAI retains its search-price label", () => {
  const flyai: FlyaiTrainQuote = { ...quote, source: "flyai", priceBasis: "passenger_search_estimate" };
  const selected = selectFlyaiTrain(plan, input, 0, flyai)!;
  const live = planTransfer(schedule(selected, input)[0], input)!;
  assert.equal(live.estimatedPrice, false); assert.equal(live.source, "Расписание FlyAI");
  const shifted = { ...input, startDate: "2026-11-03" };
  const data = planTransfer(schedule(selected, shifted)[0], shifted)!;
  assert.equal(data.estimatedSchedule, true); assert.equal(data.estimatedPrice, true);
  assert.equal(data.start, "2026-11-06"); assert.equal(data.source, "Тестовое расписание");
  assert.ok(!render(selected, shifted).includes("G123"));
});

test("a single-base trip invents no domestic transfer and viewing preserves manual visits", () => {
  const trip = updateJourney({ ...base, required: ["bei"] }, { ...base.journey!, minStops: 1, maxStops: 1,
    daysByInterest: { city: 2, nature: 1, sea: 0 }, requiredPlaces: ["bei-wall"] });
  const single: RoutePlan = { id: "balance", calendarMode: "shared", cities: ["bei"], days: [5], tickets: [], hotels: [hotelsIn("bei")[0].id],
    visits: { bei: [[], ["bei-wall"], [], [], []] } };
  const before = JSON.stringify({ single, trip });
  const html = render(single, trip);
  assert.equal(planTransfer(schedule(single, trip)[0], trip), null);
  assert.match(html, /Без переездов/);
  assert.ok(!html.includes('aria-label="Переезд:'));
  assert.ok(html.includes("Великая китайская стена"));
  assert.ok(html.includes('aria-label="Спланировать дни: Пекин"'));
  assert.deepEqual(reconcileCityPlans(single, trip).visits, single.visits);
  assert.equal(JSON.stringify({ single, trip }), before);
});

test("ticket details open the current transport: flight alternatives for air and RailGo for a short train", () => {
  const picker = (p: RoutePlan, trip = input) => renderToStaticMarkup(createElement(OfferPicker, {
    type: "ticket", index: 0, input: trip, plan: p, onClose: noop, onChange: noop,
  }));
  const flightTrip = updateJourney({ ...base, required: ["sha", "bei"] }, { ...base.journey!, minStops: 2, maxStops: 2,
    daysByInterest: { city: 5, nature: 0, sea: 0 }, requiredPlaces: [] });
  const air: RoutePlan = { ...plan, cities: ["sha", "bei"], hotels: [hotelsIn("sha")[0].id, hotelsIn("bei")[0].id], tickets: ["sha-bei-air-0"] };
  const flightHtml = picker(air, flightTrip), trainHtml = picker(plan);
  assert.ok(flightHtml.includes('aria-pressed="true">Авиабилеты · реальные'));
  assert.ok(flightHtml.includes("Найти авиабилеты"));
  assert.ok(!flightHtml.includes("Найти поезда до 2 часов"));
  assert.ok(trainHtml.includes('aria-pressed="true">RailGo'));
  assert.ok(trainHtml.includes("Найти поезда до 2 часов"));
});

test("hotel origin and the actual search timestamp are visible before opening city details", () => {
  const stay = hotelStays(plan,input)[0];
  const quoted = selectFlyaiHotel(plan,input,0,{source:"flyai",hotelId:"123456",city:"sha",name:"上海测试酒店",address:"",
    checkIn:stay.checkIn,checkOut:stay.checkOut,currency:"CNY",nightly:264,priceBasis:"nightly_search_estimate",searchedAt:"2026-10-27T06:39:50Z"})!;
  assert.ok(quoted);
  const html = render(quoted), summary = html.slice(html.indexOf('id="tp-city-sha"'),html.indexOf('id="tp-stop-sha"'));
  assert.ok(summary.includes('hotel-source-flyai'));
  assert.ok(summary.includes('FlyAI / Fliggy'));
  assert.ok(summary.includes('2026-10-27T06:39:50Z'));
  assert.match(summary,/27\.10\.2026, 09:39 МСК/);
  assert.ok(html.includes('上海测试酒店'),'original hotel names are preserved');
  assert.ok(html.includes('Предложение из поиска Fliggy'));
  assert.ok(html.includes('hotel-source-demo'),'other stops remain explicitly unverified');
});

test("a hotel quote for different stay dates cannot retain a live offer badge or search timestamp", () => {
  const stay = hotelStays(plan,input)[0];
  const quoted = selectFlyaiHotel(plan,input,0,{source:"flyai",hotelId:"123456",city:"sha",name:"Shanghai fixture",address:"",
    checkIn:stay.checkIn,checkOut:stay.checkOut,currency:"CNY",nightly:264,priceBasis:"nightly_search_estimate",searchedAt:"2026-10-27T06:39:50Z"})!;
  const html = render(quoted,{...input,startDate:"2026-11-03"});
  assert.ok(html.includes('hotel-source-outdated'));
  assert.ok(html.includes('Даты изменились · учтена тестовая цена'));
  assert.ok(!html.includes('hotel-source-flyai'));
  assert.ok(!html.includes('2026-10-27T06:39:50Z'));
  assert.equal(hotelStays(quoted,{...input,startDate:"2026-11-03"})[0].quote,undefined);
});
