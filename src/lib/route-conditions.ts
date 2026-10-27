import { isFreshWeather, weatherSuitability, type WeatherDay } from "../../shared/weather";
import { currentEventsForStay, type VerifiedEvent } from "../../shared/events";
import { schedule } from "./planner";
import { experienceAllocation } from "./journey";
import { attractionsIn } from "../data/attractions";
import { cities } from "../data/catalog";
import { hasExactDates } from "./trip-timing";
import { addDays } from "./format";
import type { RoutePlan, TripInput } from "../types";
import { algorithmSettings } from "./algorithm-settings";

export function conditionsEvaluator(input: TripInput, weather: WeatherDay[] = [], events: VerifiedEvent[] = []) {
  const map = new Map(weather.filter(day => isFreshWeather(day)).map(day => [day.city + ":" + day.date, day]));
  const cache = new Map<string, ReturnType<typeof evaluate>>();
  function evaluate(plan: RoutePlan) {
    const rows = schedule(plan, input), allocation = experienceAllocation(plan.cities, input, plan.days.reduce((a,b) => a+b,0), plan.days);
    let penalty = 0, forecast = 0, seasonal = 0, historical = 0, unknown = 0, favourable = 0, rainRisk = 0;
    const matches: VerifiedEvent[] = [], explanations: string[] = [];
    if (hasExactDates(input)) for (const [index, row] of rows.entries()) {
      const places = attractionsIn(row.city), indoors = places.filter(place => /Музей|Галерея/.test(place.category)).length / Math.max(1, places.length);
      for (let local = 0; local < plan.days[index]; local++) {
        const date = addDays(row.date, local), day = map.get(row.city + ":" + date);
        const kind = allocation?.[row.city]?.[local] ?? cities[row.city].interest;
        const score = day ? weatherSuitability(day, kind, indoors) : null;
        if (!day || score === null) { unknown++; penalty += weather.length ? algorithmSettings.weights.unknownWeather : 0; continue; }
        if (day.kind === "forecast") { forecast++; if (score >= 65) favourable++; if ((day.rainChance ?? 0) >= 60 || (day.rainMm ?? 0) >= 8) rainRisk++; }
        if (day.kind === "seasonal") seasonal++;
        if (day.kind === "historical") historical++;
        const weight = day.kind === "forecast" ? algorithmSettings.weights.forecastWeather : day.kind === "seasonal" ? algorithmSettings.weights.seasonalWeather : algorithmSettings.weights.historicalWeather;
        // A weak seasonal estimate cannot outweigh a comparable full forecast.
        penalty += weight * (50 - score) / 100 * (kind === "city" ? .5 : 1);
      }
      matches.push(...currentEventsForStay(events,row.city,row.date,row.endDate).filter(event => input.interests.includes(event.interest ?? "city")));
    }
    if (forecast) explanations.push(`Прогноз: ${forecast} из ${input.days} дней; из них ${favourable} выглядят более подходящими для выбранных занятий по модели приложения.`);
    if (seasonal) explanations.push(`Для ${seasonal} дней есть только сезонная оценка по истории, не прогноз.`);
    if (unknown) explanations.push(`Для ${unknown} дней оценка погоды неизвестна.`);
    if (matches.length) explanations.push(`С датами остановок совпадают ${matches.length} подходящих мероприятий; билеты не подтверждены.`);
    return { penalty: penalty / Math.max(1,input.days), forecast, seasonal, historical, unknown, favourable, rainRisk, matches,
      eventBonus: Math.min(algorithmSettings.weights.maxEvents, algorithmSettings.weights.event * new Set(matches.map(event => event.id)).size), explanations };
  }
  return (plan: RoutePlan) => {
    const key = JSON.stringify([plan.cities, plan.days, plan.trainQuotes, plan.flightQuotes]);
    if (!cache.has(key)) cache.set(key,evaluate(plan));
    return cache.get(key)!;
  };
}
